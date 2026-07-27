/* eslint-disable no-undef */
const ADAPTER = "tractive-next";
const CONTROL_DEFS = [
    { key: "liveTrackingActive", label: "Live-Tracking" },
    { key: "ledActive", label: "LED" },
    { key: "buzzerActive", label: "Buzzer" },
];

const maps = {};
/** @type {Record<string, { index: number, showHeat: boolean, showTrack: boolean }>} */
const historyUi = {};
let socket = null;
let enableCommands = false;

function setStatus(text, kind) {
    const el = document.getElementById("connection-status");
    if (!el) {
        return;
    }
    el.textContent = text;
    el.className = "connection-status" + (kind ? ` ${kind}` : "");
}

function getQuery() {
    const query = {};
    (window.location.search || "")
        .replace(/^\?/, "")
        .split("&")
        .forEach((part) => {
            if (!part) {
                return;
            }
            const [key, value] = part.split("=");
            query[decodeURIComponent(key)] = value === undefined ? true : decodeURIComponent(value);
        });
    return query;
}

function getInstance() {
    const query = getQuery();
    if (query.instance !== undefined && query.instance !== true) {
        return Number(query.instance) || 0;
    }
    return 0;
}

function getSocketUrl() {
    const query = getQuery();
    const port = parseInt(window.location.port, 10);
    // Admin/dev-server often proxies tabs on ports 3000-3020 while socket stays on 8081.
    if (port >= 3000 && port <= 3020) {
        return `${window.location.protocol}//${query.host || window.location.hostname}:${query.port || 8081}`;
    }
    return undefined;
}

function formatTime(ms) {
    if (!ms || typeof ms !== "number") {
        return "–";
    }
    try {
        return new Date(ms).toLocaleString();
    } catch (e) {
        return String(ms);
    }
}

function batteryClass(level) {
    if (typeof level !== "number") {
        return "";
    }
    if (level >= 60) {
        return "battery-ok";
    }
    if (level >= 30) {
        return "battery-warn";
    }
    return "battery-low";
}

function val(states, id) {
    const state = states[id];
    return state ? state.val : null;
}

function controlStateId(trackerId, key) {
    const instance = getInstance();
    return `${ADAPTER}.${instance}.${trackerId}.controls.${key}`;
}

function historyStateId(trackerId, key) {
    const instance = getInstance();
    return `${ADAPTER}.${instance}.${trackerId}.history.${key}`;
}

function toTimeMs(raw) {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
        return null;
    }
    return n < 1e12 ? Math.round(n * 1000) : Math.round(n);
}

function pointFromUnknown(value) {
    if (!value || typeof value !== "object") {
        return null;
    }
    let lat = NaN;
    let lon = NaN;
    if (Array.isArray(value.latlong) && value.latlong.length >= 2) {
        lat = Number(value.latlong[0]);
        lon = Number(value.latlong[1]);
    } else {
        lat = Number(value.lat ?? value.latitude);
        lon = Number(value.lon ?? value.lng ?? value.longitude);
    }
    const timeMs = toTimeMs(value.time ?? value.time_pos ?? value.ts ?? value.timestamp);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || timeMs === null) {
        return null;
    }
    return { lat, lon, timeMs };
}

function collectFromList(list) {
    const points = [];
    list.forEach((item) => {
        const point = pointFromUnknown(item);
        if (point) {
            points.push(point);
        }
    });
    return points;
}

function extractTrackPoints(payload) {
    let points = [];
    if (Array.isArray(payload)) {
        points = collectFromList(payload);
    } else if (payload && typeof payload === "object") {
        if (Array.isArray(payload.positions)) {
            points = collectFromList(payload.positions);
        } else if (Array.isArray(payload.segments)) {
            payload.segments.forEach((segment) => {
                const list = segment && (segment.positions || segment.points);
                if (Array.isArray(list)) {
                    points = points.concat(collectFromList(list));
                }
            });
        }
    }
    points.sort((a, b) => a.timeMs - b.timeMs);
    return points.filter((point, index) => {
        if (index === 0) {
            return true;
        }
        const prev = points[index - 1];
        return point.timeMs !== prev.timeMs || point.lat !== prev.lat || point.lon !== prev.lon;
    });
}

function haversineKm(a, b) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const r = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

function computeTrackDistanceKm(points) {
    if (points.length < 2) {
        return 0;
    }
    let sum = 0;
    for (let i = 1; i < points.length; i++) {
        sum += haversineKm(points[i - 1], points[i]);
    }
    return Math.round(sum * 100) / 100;
}

function parsePositionsJson(raw) {
    if (!raw) {
        return [];
    }
    if (typeof raw === "object") {
        return extractTrackPoints(raw);
    }
    if (typeof raw !== "string") {
        return [];
    }
    try {
        return extractTrackPoints(JSON.parse(raw));
    } catch (e) {
        return [];
    }
}

function connectSocket(callback) {
    if (typeof io === "undefined") {
        setStatus("Socket.io konnte nicht geladen werden.", "bad");
        return;
    }

    const url = getSocketUrl();
    socket = url ? io.connect(url) : io.connect();

    const timeout = setTimeout(() => {
        setStatus("Keine Antwort vom ioBroker-Socket.", "bad");
    }, 8000);

    socket.on("connect", () => {
        clearTimeout(timeout);
        callback();
    });

    socket.on("connect_error", (error) => {
        clearTimeout(timeout);
        setStatus(`Socket-Fehler: ${error && error.message ? error.message : error}`, "bad");
    });

    socket.on("reconnect", () => {
        refresh();
    });
}

function loadEnableCommands(callback) {
    const instance = getInstance();
    socket.emit("getObject", `system.adapter.${ADAPTER}.${instance}`, (err, obj) => {
        if (err) {
            console.error(err);
            enableCommands = false;
            callback(false);
            return;
        }
        enableCommands = Boolean(obj && obj.native && obj.native.enableCommands);
        callback(enableCommands);
    });
}

function loadTrackers(callback) {
    const instance = getInstance();
    const prefix = `${ADAPTER}.${instance}.`;

    socket.emit(
        "getObjectView",
        "system",
        "device",
        {
            startkey: prefix,
            endkey: `${prefix}\u9999`,
        },
        (err, result) => {
            if (err) {
                console.error(err);
                loadTrackersFromOverviewChannels(callback);
                return;
            }

            const devices = (result && result.rows ? result.rows : [])
                .map((row) => row.value)
                .filter(Boolean)
                .map((obj) => {
                    const id = obj._id || "";
                    const trackerId = id.slice(prefix.length).split(".")[0];
                    return {
                        id,
                        trackerId,
                        name: (obj.common && obj.common.name) || trackerId,
                    };
                })
                .filter((device) => device.trackerId && device.trackerId !== "info");

            if (!devices.length) {
                loadTrackersFromOverviewChannels(callback);
                return;
            }

            callback(devices);
        },
    );
}

function loadTrackersFromOverviewChannels(callback) {
    const instance = getInstance();
    const prefix = `${ADAPTER}.${instance}.`;

    socket.emit(
        "getObjectView",
        "system",
        "channel",
        {
            startkey: prefix,
            endkey: `${prefix}\u9999`,
        },
        (err, result) => {
            if (err) {
                console.error(err);
                callback([]);
                return;
            }

            const devices = (result && result.rows ? result.rows : [])
                .map((row) => row.value)
                .filter((obj) => obj && obj._id && /\.overview$/.test(obj._id))
                .map((obj) => {
                    const rest = obj._id.slice(prefix.length);
                    const trackerId = rest.replace(/\.overview$/, "");
                    return {
                        id: `${prefix}${trackerId}`,
                        trackerId,
                        name: trackerId,
                    };
                });

            callback(devices);
        },
    );
}

function loadOverviewStates(devices, callback) {
    const instance = getInstance();
    const ids = [];

    devices.forEach((device) => {
        const base = `${ADAPTER}.${instance}.${device.trackerId}.overview`;
        [
            "name",
            "latitude",
            "longitude",
            "accuracy",
            "lastSeen",
            "batteryLevel",
            "batteryState",
            "charging",
            "sensorUsed",
            "address",
            "osmMapUrl",
        ].forEach((key) => ids.push(`${base}.${key}`));

        CONTROL_DEFS.forEach((control) => {
            ids.push(controlStateId(device.trackerId, control.key));
        });

        ["positionsJson", "distanceKm", "pointCount", "timeFrom", "timeTo"].forEach((key) => {
            ids.push(historyStateId(device.trackerId, key));
        });
    });

    ids.push(`${ADAPTER}.${instance}.info.connection`);
    ids.push(`${ADAPTER}.${instance}.info.lastUpdate`);

    if (!ids.length) {
        callback({});
        return;
    }

    socket.emit("getStates", ids, (err, states) => {
        if (err) {
            console.error(err);
            setStatus(`States konnten nicht geladen werden: ${err}`, "bad");
            callback({});
            return;
        }
        callback(states || {});
    });
}

function renderConnection(states) {
    const instance = getInstance();
    const connected = val(states, `${ADAPTER}.${instance}.info.connection`);
    const lastUpdate = val(states, `${ADAPTER}.${instance}.info.lastUpdate`);

    if (connected) {
        setStatus(`Verbunden · letzter Update: ${formatTime(lastUpdate)}`, "ok");
    } else {
        setStatus("Adapter meldet: nicht verbunden", "bad");
    }
}

function clearMapLayers(mapEntry) {
    if (!mapEntry) {
        return;
    }
    if (mapEntry.trackLine) {
        mapEntry.map.removeLayer(mapEntry.trackLine);
        mapEntry.trackLine = null;
    }
    if (mapEntry.heatLayer) {
        mapEntry.map.removeLayer(mapEntry.heatLayer);
        mapEntry.heatLayer = null;
    }
    if (mapEntry.playMarker) {
        mapEntry.map.removeLayer(mapEntry.playMarker);
        mapEntry.playMarker = null;
    }
}

function ensureMap(mapId, lat, lon, accuracy) {
    if (typeof L === "undefined") {
        return null;
    }

    if (maps[mapId]) {
        maps[mapId].map.setView([lat, lon], maps[mapId].map.getZoom());
        maps[mapId].marker.setLatLng([lat, lon]);
        if (maps[mapId].circle) {
            maps[mapId].circle.setLatLng([lat, lon]);
            maps[mapId].circle.setRadius(typeof accuracy === "number" && accuracy > 0 ? accuracy : 30);
        }
        setTimeout(() => maps[mapId].map.invalidateSize(), 50);
        return maps[mapId];
    }

    const map = L.map(mapId, {
        zoomControl: true,
        attributionControl: false,
    }).setView([lat, lon], 16);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([lat, lon]).addTo(map);
    const circle = L.circle([lat, lon], {
        radius: typeof accuracy === "number" && accuracy > 0 ? accuracy : 30,
        color: "#2196f3",
        fillColor: "#2196f3",
        fillOpacity: 0.15,
        weight: 2,
    }).addTo(map);

    maps[mapId] = {
        map,
        marker,
        circle,
        trackLine: null,
        heatLayer: null,
        playMarker: null,
        points: [],
    };
    setTimeout(() => map.invalidateSize(), 100);
    return maps[mapId];
}

function applyHistoryLayers(mapId, points, ui) {
    const entry = maps[mapId];
    if (!entry || !points.length) {
        return;
    }

    clearMapLayers(entry);
    entry.points = points;
    const latLngs = points.map((p) => [p.lat, p.lon]);

    if (ui.showTrack) {
        entry.trackLine = L.polyline(latLngs, {
            color: "#2196f3",
            weight: 4,
            opacity: 0.85,
        }).addTo(entry.map);
    }

    if (ui.showHeat && typeof L.heatLayer === "function") {
        entry.heatLayer = L.heatLayer(
            points.map((p) => [p.lat, p.lon, 0.6]),
            { radius: 22, blur: 18, maxZoom: 17 },
        ).addTo(entry.map);
    }

    const idx = Math.max(0, Math.min(ui.index, points.length - 1));
    const point = points[idx];
    entry.playMarker = L.circleMarker([point.lat, point.lon], {
        radius: 9,
        color: "#0d47a1",
        fillColor: "#42a5f5",
        fillOpacity: 1,
        weight: 2,
    }).addTo(entry.map);

    if (entry.trackLine) {
        entry.map.fitBounds(entry.trackLine.getBounds(), { padding: [24, 24] });
    } else {
        entry.map.setView([point.lat, point.lon], entry.map.getZoom());
    }
}

function setPlaybackIndex(trackerId, mapId, index) {
    const entry = maps[mapId];
    const ui = historyUi[trackerId];
    if (!entry || !ui || !entry.points.length) {
        return;
    }
    const idx = Math.max(0, Math.min(index, entry.points.length - 1));
    ui.index = idx;
    const point = entry.points[idx];
    if (entry.playMarker) {
        entry.playMarker.setLatLng([point.lat, point.lon]);
    }
    const current = document.getElementById(`history-current-${trackerId}`);
    if (current) {
        current.textContent = formatTime(point.timeMs);
    }
    const slider = document.getElementById(`history-slider-${trackerId}`);
    if (slider && Number(slider.value) !== idx) {
        slider.value = String(idx);
    }
}

function controlButtonHtml(trackerId, control, active) {
    const on = Boolean(active);
    const disabledAttr = enableCommands ? "" : " disabled";
    const onClass = on ? " on" : "";
    return `
        <button type="button"
            class="control-btn${onClass}"
            data-tracker="${escapeAttr(trackerId)}"
            data-control="${escapeAttr(control.key)}"
            data-active="${on ? "1" : "0"}"
            ${disabledAttr}
            title="${enableCommands ? "Umschalten" : "enableCommands ist in den Instanz-Einstellungen deaktiviert"}">
            <span class="control-label">${escapeHtml(control.label)}</span>
            <span class="control-state">${on ? "AN" : "AUS"}</span>
        </button>
    `;
}

function historySectionHtml(trackerId, points, distanceKm) {
    if (!points.length) {
        return `<div class="tracker-history"><h6>Tagesverlauf (24h)</h6><div class="history-empty">Keine Verlaufspunkte verfügbar.</div></div>`;
    }

    const ui = historyUi[trackerId] || { index: points.length - 1, showHeat: false, showTrack: true };
    historyUi[trackerId] = ui;
    if (ui.index >= points.length) {
        ui.index = points.length - 1;
    }

    const first = points[0];
    const last = points[points.length - 1];
    const dist =
        typeof distanceKm === "number" && Number.isFinite(distanceKm)
            ? distanceKm
            : computeTrackDistanceKm(points);

    return `
        <div class="tracker-history" data-tracker="${escapeAttr(trackerId)}">
            <h6>Tagesverlauf (24h)</h6>
            <div class="history-meta">${points.length} Punkte · ${dist} km · ${formatTime(first.timeMs)} – ${formatTime(last.timeMs)}</div>
            <div class="history-toolbar">
                <label><input type="checkbox" class="history-toggle-track" data-tracker="${escapeAttr(trackerId)}" ${ui.showTrack ? "checked" : ""}/> Weg anzeigen</label>
                <label><input type="checkbox" class="history-toggle-heat" data-tracker="${escapeAttr(trackerId)}" ${ui.showHeat ? "checked" : ""}/> Heatmap</label>
            </div>
            <input class="history-slider" id="history-slider-${escapeAttr(trackerId)}" type="range" min="0" max="${points.length - 1}" value="${ui.index}" data-tracker="${escapeAttr(trackerId)}"/>
            <div class="history-time">
                <span>${formatTime(first.timeMs)}</span>
                <span id="history-current-${escapeAttr(trackerId)}">${formatTime(points[ui.index].timeMs)}</span>
                <span>${formatTime(last.timeMs)}</span>
            </div>
        </div>
    `;
}

function renderCards(devices, states) {
    const grid = document.getElementById("tracker-grid");
    const empty = document.getElementById("empty-state");
    const instance = getInstance();

    grid.innerHTML = "";
    Object.keys(maps).forEach((key) => {
        try {
            maps[key].map.remove();
        } catch (e) {
            // ignore
        }
        delete maps[key];
    });

    if (!devices.length) {
        empty.classList.remove("hide");
        return;
    }

    empty.classList.add("hide");

    devices.forEach((device) => {
        const base = `${ADAPTER}.${instance}.${device.trackerId}.overview`;
        const name = val(states, `${base}.name`) || device.name;
        const lat = val(states, `${base}.latitude`);
        const lon = val(states, `${base}.longitude`);
        const accuracy = val(states, `${base}.accuracy`);
        const lastSeen = val(states, `${base}.lastSeen`);
        const batteryLevel = val(states, `${base}.batteryLevel`);
        const batteryState = val(states, `${base}.batteryState`);
        const charging = val(states, `${base}.charging`);
        const sensorUsed = val(states, `${base}.sensorUsed`);
        const address = val(states, `${base}.address`);
        const osmMapUrl = val(states, `${base}.osmMapUrl`);
        const mapId = `map-${device.trackerId}`;
        const hasCoords = typeof lat === "number" && typeof lon === "number";
        const batteryText =
            typeof batteryLevel === "number"
                ? `${batteryLevel}%${batteryState ? ` (${batteryState})` : ""}${charging ? " · lädt" : ""}`
                : batteryState || "–";

        const points = parsePositionsJson(val(states, historyStateId(device.trackerId, "positionsJson")));
        const distanceKm = val(states, historyStateId(device.trackerId, "distanceKm"));

        const controlsHtml = CONTROL_DEFS.map((control) => {
            const active = val(states, controlStateId(device.trackerId, control.key));
            return controlButtonHtml(device.trackerId, control, active);
        }).join("");

        const card = document.createElement("div");
        card.className = "tracker-card";
        card.innerHTML = `
            <h5>${escapeHtml(String(name))}</h5>
            <div class="tracker-map" id="${mapId}"></div>
            <div class="tracker-controls">${controlsHtml}</div>
            ${
                enableCommands
                    ? ""
                    : `<div class="controls-hint">Steuerung deaktiviert – in den Instanz-Einstellungen „Enable tracker commands“ aktivieren.</div>`
            }
            ${historySectionHtml(device.trackerId, points, distanceKm)}
            <div class="tracker-meta">
                <div class="meta-row"><span class="meta-label">Latitude</span><span class="meta-value">${hasCoords ? lat : "–"}</span></div>
                <div class="meta-row"><span class="meta-label">Longitude</span><span class="meta-value">${hasCoords ? lon : "–"}</span></div>
                <div class="meta-row"><span class="meta-label">Radius</span><span class="meta-value">${typeof accuracy === "number" ? `${accuracy} m` : "–"}</span></div>
                <div class="meta-row"><span class="meta-label">Zuletzt gesehen</span><span class="meta-value">${formatTime(lastSeen)}</span></div>
                <div class="meta-row"><span class="meta-label">Batterie</span><span class="meta-value ${batteryClass(batteryLevel)}">${escapeHtml(batteryText)}</span></div>
                <div class="meta-row"><span class="meta-label">Sensor</span><span class="meta-value">${escapeHtml(String(sensorUsed || "–"))}</span></div>
                <div class="meta-row"><span class="meta-label">Adresse</span><span class="meta-value">${escapeHtml(String(address || "–"))}</span></div>
                <div class="meta-row"><span class="meta-label">Karte</span><span class="meta-value">${
                    osmMapUrl
                        ? `<a href="${escapeAttr(osmMapUrl)}" target="_blank" rel="noopener noreferrer">OpenStreetMap öffnen</a>`
                        : "–"
                }</span></div>
            </div>
        `;
        grid.appendChild(card);

        const startLat = hasCoords ? lat : points.length ? points[points.length - 1].lat : null;
        const startLon = hasCoords ? lon : points.length ? points[points.length - 1].lon : null;
        if (typeof startLat === "number" && typeof startLon === "number") {
            ensureMap(mapId, startLat, startLon, accuracy);
            if (points.length) {
                applyHistoryLayers(mapId, points, historyUi[device.trackerId]);
            }
        } else {
            document.getElementById(mapId).textContent = "Keine Position verfügbar";
        }
    });
}

function updateControlButton(button, active) {
    const on = Boolean(active);
    button.dataset.active = on ? "1" : "0";
    button.classList.toggle("on", on);
    const stateEl = button.querySelector(".control-state");
    if (stateEl) {
        stateEl.textContent = on ? "AN" : "AUS";
    }
}

function toggleControl(trackerId, controlKey, currentlyActive, button) {
    if (!enableCommands) {
        setStatus("Steuerung ist deaktiviert (enableCommands).", "bad");
        return;
    }
    if (!socket || !socket.connected) {
        setStatus("Socket nicht verbunden.", "bad");
        return;
    }

    const next = !currentlyActive;
    const id = controlStateId(trackerId, controlKey);
    button.disabled = true;
    updateControlButton(button, next);

    socket.emit("setState", id, { val: next, ack: false }, (err) => {
        button.disabled = !enableCommands;
        if (err) {
            console.error(err);
            updateControlButton(button, currentlyActive);
            setStatus(`Befehl fehlgeschlagen: ${err}`, "bad");
            return;
        }
        setStatus(`Befehl gesendet: ${controlKey} → ${next ? "AN" : "AUS"}`, "ok");
    });
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function escapeAttr(text) {
    return escapeHtml(text).replace(/'/g, "&#39;");
}

function refresh() {
    if (!socket || !socket.connected) {
        setStatus("Socket nicht verbunden.", "bad");
        return;
    }

    setStatus("Lade Tracker…");
    loadEnableCommands(() => {
        loadTrackers((devices) => {
            loadOverviewStates(devices, (states) => {
                renderConnection(states);
                renderCards(devices, states);
                if (!devices.length) {
                    setStatus("Verbunden, aber keine Tracker-Objekte gefunden.", "bad");
                }
            });
        });
    });
}

function init() {
    $("#refresh-btn").on("click", refresh);
    $("#tracker-grid").on("click", ".control-btn", function onControlClick() {
        const button = this;
        const trackerId = button.getAttribute("data-tracker");
        const controlKey = button.getAttribute("data-control");
        const currentlyActive = button.getAttribute("data-active") === "1";
        if (!trackerId || !controlKey) {
            return;
        }
        toggleControl(trackerId, controlKey, currentlyActive, button);
    });

    $("#tracker-grid").on("input", ".history-slider", function onHistorySlider() {
        const trackerId = this.getAttribute("data-tracker");
        const mapId = `map-${trackerId}`;
        setPlaybackIndex(trackerId, mapId, Number(this.value) || 0);
    });

    $("#tracker-grid").on("change", ".history-toggle-track, .history-toggle-heat", function onHistoryToggle() {
        const trackerId = this.getAttribute("data-tracker");
        const ui = historyUi[trackerId];
        const mapId = `map-${trackerId}`;
        const entry = maps[mapId];
        if (!ui || !entry) {
            return;
        }
        const trackEl = document.querySelector(`.history-toggle-track[data-tracker="${trackerId}"]`);
        const heatEl = document.querySelector(`.history-toggle-heat[data-tracker="${trackerId}"]`);
        ui.showTrack = Boolean(trackEl && trackEl.checked);
        ui.showHeat = Boolean(heatEl && heatEl.checked);
        applyHistoryLayers(mapId, entry.points, ui);
        setPlaybackIndex(trackerId, mapId, ui.index);
    });

    connectSocket(() => {
        setStatus("Socket verbunden, lade Daten…", "ok");
        refresh();
        setInterval(refresh, 30000);
    });
}

$(init);
