/* eslint-disable no-undef */
const ADAPTER = "tractive-next";
const CONTROL_DEFS = [
    { key: "liveTrackingActive", label: "Live-Tracking" },
    { key: "ledActive", label: "LED" },
    { key: "buzzerActive", label: "Buzzer" },
];

const maps = {};
/** @type {Record<string, { index: number, rangeFrom: number, rangeTo: number, showHeat: boolean, showTrack: boolean }>} */
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

function flattenPositionItems(list) {
    const items = [];
    list.forEach((item) => {
        if (Array.isArray(item)) {
            items.push(...flattenPositionItems(item));
            return;
        }
        if (item && typeof item === "object") {
            const nested = item.positions || item.points;
            if (Array.isArray(nested)) {
                items.push(...flattenPositionItems(nested));
                return;
            }
        }
        items.push(item);
    });
    return items;
}

function collectFromList(list) {
    const points = [];
    flattenPositionItems(list).forEach((item) => {
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
            points = collectFromList(payload.segments);
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
        setStatus("Socket.io could not be loaded.", "bad");
        return;
    }

    const url = getSocketUrl();
    socket = url ? io.connect(url) : io.connect();

    const timeout = setTimeout(() => {
        setStatus("No response from the ioBroker socket.", "bad");
    }, 8000);

    socket.on("connect", () => {
        clearTimeout(timeout);
        callback();
    });

    socket.on("connect_error", (error) => {
        clearTimeout(timeout);
        setStatus(`Socket error: ${error && error.message ? error.message : error}`, "bad");
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
            setStatus(`Failed to load states: ${err}`, "bad");
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
        setStatus(`Connected · last update: ${formatTime(lastUpdate)}`, "ok");
    } else {
        setStatus("Adapter reports: not connected", "bad");
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
        allPoints: [],
    };
    setTimeout(() => map.invalidateSize(), 100);
    return maps[mapId];
}

function normalizeHistoryUi(ui, pointCount) {
    const max = Math.max(0, pointCount - 1);
    if (typeof ui.rangeFrom !== "number" || !Number.isFinite(ui.rangeFrom)) {
        ui.rangeFrom = 0;
    }
    if (typeof ui.rangeTo !== "number" || !Number.isFinite(ui.rangeTo)) {
        ui.rangeTo = max;
    }
    ui.rangeFrom = Math.max(0, Math.min(Math.round(ui.rangeFrom), max));
    ui.rangeTo = Math.max(0, Math.min(Math.round(ui.rangeTo), max));
    if (ui.rangeFrom > ui.rangeTo) {
        const swap = ui.rangeFrom;
        ui.rangeFrom = ui.rangeTo;
        ui.rangeTo = swap;
    }
    if (typeof ui.index !== "number" || !Number.isFinite(ui.index)) {
        ui.index = ui.rangeTo;
    }
    ui.index = Math.max(ui.rangeFrom, Math.min(Math.round(ui.index), ui.rangeTo));
    if (typeof ui.showHeat !== "boolean") {
        ui.showHeat = false;
    }
    if (typeof ui.showTrack !== "boolean") {
        ui.showTrack = true;
    }
    return ui;
}

function visibleHistoryPoints(allPoints, ui) {
    return allPoints.slice(ui.rangeFrom, ui.rangeTo + 1);
}

function applyHistoryLayers(mapId, allPoints, ui) {
    const entry = maps[mapId];
    if (!entry || !allPoints.length) {
        return;
    }

    clearMapLayers(entry);
    entry.allPoints = allPoints;
    normalizeHistoryUi(ui, allPoints.length);
    const points = visibleHistoryPoints(allPoints, ui);
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

    const point = allPoints[ui.index];
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

function updateHistoryRangeLabels(trackerId, allPoints, ui) {
    const points = visibleHistoryPoints(allPoints, ui);
    const meta = document.getElementById(`history-meta-${trackerId}`);
    if (meta && points.length) {
        const dist = computeTrackDistanceKm(points);
        const total = allPoints.length;
        const rangeLabel =
            ui.rangeFrom === 0 && ui.rangeTo === total - 1
                ? `${points.length} points · ${dist} km`
                : `${points.length}/${total} points · ${dist} km`;
        meta.textContent = `${rangeLabel} · ${formatTime(points[0].timeMs)} – ${formatTime(points[points.length - 1].timeMs)}`;
    }

    const fromEl = document.getElementById(`history-from-${trackerId}`);
    if (fromEl) {
        fromEl.textContent = formatTime(allPoints[ui.rangeFrom].timeMs);
    }
    const toEl = document.getElementById(`history-to-${trackerId}`);
    if (toEl) {
        toEl.textContent = formatTime(allPoints[ui.rangeTo].timeMs);
    }
    const current = document.getElementById(`history-current-${trackerId}`);
    if (current) {
        current.textContent = formatTime(allPoints[ui.index].timeMs);
    }

    const fromSlider = document.getElementById(`history-range-from-${trackerId}`);
    if (fromSlider && Number(fromSlider.value) !== ui.rangeFrom) {
        fromSlider.value = String(ui.rangeFrom);
    }
    const toSlider = document.getElementById(`history-range-to-${trackerId}`);
    if (toSlider && Number(toSlider.value) !== ui.rangeTo) {
        toSlider.value = String(ui.rangeTo);
    }
    const playSlider = document.getElementById(`history-slider-${trackerId}`);
    if (playSlider) {
        playSlider.min = String(ui.rangeFrom);
        playSlider.max = String(ui.rangeTo);
        if (Number(playSlider.value) !== ui.index) {
            playSlider.value = String(ui.index);
        }
    }
}

function setPlaybackIndex(trackerId, mapId, index) {
    const entry = maps[mapId];
    const ui = historyUi[trackerId];
    if (!entry || !ui || !entry.allPoints.length) {
        return;
    }
    normalizeHistoryUi(ui, entry.allPoints.length);
    ui.index = Math.max(ui.rangeFrom, Math.min(Math.round(index), ui.rangeTo));
    const point = entry.allPoints[ui.index];
    if (entry.playMarker) {
        entry.playMarker.setLatLng([point.lat, point.lon]);
    }
    updateHistoryRangeLabels(trackerId, entry.allPoints, ui);
}

function setHistoryRange(trackerId, mapId, which, value) {
    const entry = maps[mapId];
    const ui = historyUi[trackerId];
    if (!entry || !ui || !entry.allPoints.length) {
        return;
    }
    const max = entry.allPoints.length - 1;
    const next = Math.max(0, Math.min(Math.round(value), max));
    if (which === "from") {
        ui.rangeFrom = next;
        if (ui.rangeFrom > ui.rangeTo) {
            ui.rangeTo = ui.rangeFrom;
        }
    } else {
        ui.rangeTo = next;
        if (ui.rangeTo < ui.rangeFrom) {
            ui.rangeFrom = ui.rangeTo;
        }
    }
    if (ui.index < ui.rangeFrom) {
        ui.index = ui.rangeFrom;
    }
    if (ui.index > ui.rangeTo) {
        ui.index = ui.rangeTo;
    }
    applyHistoryLayers(mapId, entry.allPoints, ui);
    updateHistoryRangeLabels(trackerId, entry.allPoints, ui);
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
            title="${enableCommands ? "Toggle" : "enableCommands is disabled in the instance settings"}">
            <span class="control-label">${escapeHtml(control.label)}</span>
            <span class="control-state">${on ? "ON" : "OFF"}</span>
        </button>
    `;
}

function historySectionHtml(trackerId, points, distanceKm) {
    if (!points.length) {
        return `<div class="tracker-history"><h6>Day track (24h)</h6><div class="history-empty">No history points available.</div></div>`;
    }

    const ui = historyUi[trackerId] || {
        index: points.length - 1,
        rangeFrom: 0,
        rangeTo: points.length - 1,
        showHeat: false,
        showTrack: true,
    };
    historyUi[trackerId] = ui;
    normalizeHistoryUi(ui, points.length);

    const visible = visibleHistoryPoints(points, ui);
    const fullDist =
        typeof distanceKm === "number" && Number.isFinite(distanceKm)
            ? distanceKm
            : computeTrackDistanceKm(points);
    const dist = ui.rangeFrom === 0 && ui.rangeTo === points.length - 1 ? fullDist : computeTrackDistanceKm(visible);
    const rangeLabel =
        ui.rangeFrom === 0 && ui.rangeTo === points.length - 1
            ? `${visible.length} points · ${dist} km`
            : `${visible.length}/${points.length} points · ${dist} km`;

    return `
        <div class="tracker-history" data-tracker="${escapeAttr(trackerId)}">
            <h6>Day track (24h)</h6>
            <div class="history-meta" id="history-meta-${escapeAttr(trackerId)}">${rangeLabel} · ${formatTime(visible[0].timeMs)} – ${formatTime(visible[visible.length - 1].timeMs)}</div>
            <div class="history-toolbar">
                <label><input type="checkbox" class="history-toggle-track" data-tracker="${escapeAttr(trackerId)}" ${ui.showTrack ? "checked" : ""}/> Show path</label>
                <label><input type="checkbox" class="history-toggle-heat" data-tracker="${escapeAttr(trackerId)}" ${ui.showHeat ? "checked" : ""}/> Heatmap</label>
            </div>
            <div class="history-range-label">Time range (from – to)</div>
            <div class="history-dual-range">
                <input class="history-range-from" id="history-range-from-${escapeAttr(trackerId)}" type="range" min="0" max="${points.length - 1}" value="${ui.rangeFrom}" data-tracker="${escapeAttr(trackerId)}" aria-label="Range from"/>
                <input class="history-range-to" id="history-range-to-${escapeAttr(trackerId)}" type="range" min="0" max="${points.length - 1}" value="${ui.rangeTo}" data-tracker="${escapeAttr(trackerId)}" aria-label="Range to"/>
            </div>
            <div class="history-time history-range-time">
                <span id="history-from-${escapeAttr(trackerId)}">${formatTime(points[ui.rangeFrom].timeMs)}</span>
                <span id="history-to-${escapeAttr(trackerId)}">${formatTime(points[ui.rangeTo].timeMs)}</span>
            </div>
            <div class="history-range-label">Playback</div>
            <input class="history-slider" id="history-slider-${escapeAttr(trackerId)}" type="range" min="${ui.rangeFrom}" max="${ui.rangeTo}" value="${ui.index}" data-tracker="${escapeAttr(trackerId)}" aria-label="Playback position"/>
            <div class="history-time">
                <span id="history-current-${escapeAttr(trackerId)}">${formatTime(points[ui.index].timeMs)}</span>
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
                ? `${batteryLevel}%${batteryState ? ` (${batteryState})` : ""}${charging ? " · charging" : ""}`
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
                    : `<div class="controls-hint">Controls disabled – enable “Enable tracker commands” in the instance settings.</div>`
            }
            ${historySectionHtml(device.trackerId, points, distanceKm)}
            <div class="tracker-meta">
                <div class="meta-row"><span class="meta-label">Latitude</span><span class="meta-value">${hasCoords ? lat : "–"}</span></div>
                <div class="meta-row"><span class="meta-label">Longitude</span><span class="meta-value">${hasCoords ? lon : "–"}</span></div>
                <div class="meta-row"><span class="meta-label">Radius</span><span class="meta-value">${typeof accuracy === "number" ? `${accuracy} m` : "–"}</span></div>
                <div class="meta-row"><span class="meta-label">Last seen</span><span class="meta-value">${formatTime(lastSeen)}</span></div>
                <div class="meta-row"><span class="meta-label">Battery</span><span class="meta-value ${batteryClass(batteryLevel)}">${escapeHtml(batteryText)}</span></div>
                <div class="meta-row"><span class="meta-label">Sensor</span><span class="meta-value">${escapeHtml(String(sensorUsed || "–"))}</span></div>
                <div class="meta-row"><span class="meta-label">Address</span><span class="meta-value">${escapeHtml(String(address || "–"))}</span></div>
                <div class="meta-row"><span class="meta-label">Map</span><span class="meta-value">${
                    osmMapUrl
                        ? `<a href="${escapeAttr(osmMapUrl)}" target="_blank" rel="noopener noreferrer">Open OpenStreetMap</a>`
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
            document.getElementById(mapId).textContent = "No position available";
        }
    });
}

function updateControlButton(button, active) {
    const on = Boolean(active);
    button.dataset.active = on ? "1" : "0";
    button.classList.toggle("on", on);
    const stateEl = button.querySelector(".control-state");
    if (stateEl) {
        stateEl.textContent = on ? "ON" : "OFF";
    }
}

function toggleControl(trackerId, controlKey, currentlyActive, button) {
    if (!enableCommands) {
        setStatus("Controls are disabled (enableCommands).", "bad");
        return;
    }
    if (!socket || !socket.connected) {
        setStatus("Socket not connected.", "bad");
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
            setStatus(`Command failed: ${err}`, "bad");
            return;
        }
        setStatus(`Command sent: ${controlKey} → ${next ? "ON" : "OFF"}`, "ok");
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
        setStatus("Socket not connected.", "bad");
        return;
    }

    setStatus("Loading trackers…");
    loadEnableCommands(() => {
        loadTrackers((devices) => {
            loadOverviewStates(devices, (states) => {
                renderConnection(states);
                renderCards(devices, states);
                if (!devices.length) {
                    setStatus("Connected, but no tracker objects found.", "bad");
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

    $("#tracker-grid").on("input", ".history-range-from", function onHistoryRangeFrom() {
        const trackerId = this.getAttribute("data-tracker");
        const mapId = `map-${trackerId}`;
        setHistoryRange(trackerId, mapId, "from", Number(this.value) || 0);
    });

    $("#tracker-grid").on("input", ".history-range-to", function onHistoryRangeTo() {
        const trackerId = this.getAttribute("data-tracker");
        const mapId = `map-${trackerId}`;
        setHistoryRange(trackerId, mapId, "to", Number(this.value) || 0);
    });

    $("#tracker-grid").on("change", ".history-toggle-track, .history-toggle-heat", function onHistoryToggle() {
        const trackerId = this.getAttribute("data-tracker");
        const ui = historyUi[trackerId];
        const mapId = `map-${trackerId}`;
        const entry = maps[mapId];
        if (!ui || !entry || !entry.allPoints.length) {
            return;
        }
        const trackEl = document.querySelector(`.history-toggle-track[data-tracker="${trackerId}"]`);
        const heatEl = document.querySelector(`.history-toggle-heat[data-tracker="${trackerId}"]`);
        ui.showTrack = Boolean(trackEl && trackEl.checked);
        ui.showHeat = Boolean(heatEl && heatEl.checked);
        applyHistoryLayers(mapId, entry.allPoints, ui);
        updateHistoryRangeLabels(trackerId, entry.allPoints, ui);
    });

    connectSocket(() => {
        setStatus("Socket connected, loading data…", "ok");
        refresh();
        setInterval(refresh, 30000);
    });
}

$(init);
