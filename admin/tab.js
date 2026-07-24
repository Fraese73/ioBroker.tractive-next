/* global socket provided by Admin tab iframe */
/* eslint-disable no-undef */

const ADAPTER = "tractive-next";
const maps = {};

function getInstance() {
    const match = (window.location.search || "").match(/[?&]instance=(\d+)/);
    if (match) {
        return Number(match[1]);
    }
    return 0;
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
            include_docs: true,
        },
        (err, result) => {
            if (err) {
                console.error(err);
                callback([]);
                return;
            }

            const devices = (result && result.rows ? result.rows : [])
                .map((row) => row.value || row.doc)
                .filter(Boolean)
                .map((obj) => {
                    const id = obj._id || "";
                    const trackerId = id.slice(prefix.length);
                    return {
                        id,
                        trackerId,
                        name: (obj.common && obj.common.name) || trackerId,
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
    const el = document.getElementById("connection-status");

    if (connected) {
        el.textContent = `Verbunden · letzter Update: ${formatTime(lastUpdate)}`;
        el.className = "connection-status ok";
    } else {
        el.textContent = "Nicht verbunden";
        el.className = "connection-status bad";
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
            maps[mapId].circle.setRadius(typeof accuracy === "number" ? accuracy : 30);
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
    loadTrackers((devices) => {
        loadOverviewStates(devices, (states) => {
            renderConnection(states);
            renderCards(devices, states);
        });
    });
}

function init() {
    $("#refresh-btn").on("click", refresh);
    refresh();
    setInterval(refresh, 30000);
}

if (typeof systemLang === "undefined") {
    // optional
}

if (typeof socket !== "undefined") {
    init();
} else {
    // Wait briefly for Admin to inject socket
    const timer = setInterval(() => {
        if (typeof socket !== "undefined") {
            clearInterval(timer);
            init();
        }
    }, 100);
    setTimeout(() => clearInterval(timer), 10000);
}
