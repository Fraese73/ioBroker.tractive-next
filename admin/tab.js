/* eslint-disable no-undef */
const ADAPTER = "tractive-next";
const maps = {};
let socket = null;

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
                // Fallback: overview channels
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

function ensureMap(mapId, lat, lon, accuracy) {
    if (typeof L === "undefined") {
        return;
    }

    if (maps[mapId]) {
        maps[mapId].setView([lat, lon], maps[mapId].getZoom());
        maps[mapId].marker.setLatLng([lat, lon]);
        if (maps[mapId].circle) {
            maps[mapId].circle.setLatLng([lat, lon]);
            maps[mapId].circle.setRadius(typeof accuracy === "number" && accuracy > 0 ? accuracy : 30);
        }
        setTimeout(() => maps[mapId].invalidateSize(), 50);
        return;
    }

    const map = L.map(mapId, {
        zoomControl: false,
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

    maps[mapId] = map;
    maps[mapId].marker = marker;
    maps[mapId].circle = circle;
    setTimeout(() => map.invalidateSize(), 100);
}

function renderCards(devices, states) {
    const grid = document.getElementById("tracker-grid");
    const empty = document.getElementById("empty-state");
    const instance = getInstance();

    grid.innerHTML = "";
    Object.keys(maps).forEach((key) => {
        try {
            maps[key].remove();
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

        const card = document.createElement("div");
        card.className = "tracker-card";
        card.innerHTML = `
            <h5>${escapeHtml(String(name))}</h5>
            <div class="tracker-map" id="${mapId}"></div>
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

        if (hasCoords) {
            ensureMap(mapId, lat, lon, accuracy);
        } else {
            document.getElementById(mapId).textContent = "Keine Position verfügbar";
        }
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
    loadTrackers((devices) => {
        loadOverviewStates(devices, (states) => {
            renderConnection(states);
            renderCards(devices, states);
            if (!devices.length) {
                setStatus("Verbunden, aber keine Tracker-Objekte gefunden.", "bad");
            }
        });
    });
}

function init() {
    $("#refresh-btn").on("click", refresh);
    connectSocket(() => {
        setStatus("Socket verbunden, lade Daten…", "ok");
        refresh();
        setInterval(refresh, 30000);
    });
}

$(init);
