export interface TrackPoint {
    lat: number;
    lon: number;
    timeMs: number;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function toTimeMs(raw: unknown): number | null {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
        return null;
    }
    return n < 1e12 ? Math.round(n * 1000) : Math.round(n);
}

function pointFromUnknown(value: unknown): TrackPoint | null {
    const rec = asRecord(value);
    if (!rec) {
        return null;
    }

    let lat = Number.NaN;
    let lon = Number.NaN;
    const latlong = rec.latlong;
    if (Array.isArray(latlong) && latlong.length >= 2) {
        lat = Number(latlong[0]);
        lon = Number(latlong[1]);
    } else {
        lat = Number(rec.lat ?? rec.latitude);
        lon = Number(rec.lon ?? rec.lng ?? rec.longitude);
    }

    const timeMs = toTimeMs(rec.time ?? rec.time_pos ?? rec.ts ?? rec.timestamp);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || timeMs === null) {
        return null;
    }
    return { lat, lon, timeMs };
}

/**
 * Flatten Tractive json_segments payloads: [[point, point], [point]] → [point, ...].
 * Also accepts already-flat point arrays and nested segment objects.
 */
function flattenPositionItems(list: unknown[]): unknown[] {
    const items: unknown[] = [];
    for (const item of list) {
        if (Array.isArray(item)) {
            items.push(...flattenPositionItems(item));
            continue;
        }
        const rec = asRecord(item);
        const nested = rec?.positions ?? rec?.points;
        if (Array.isArray(nested)) {
            items.push(...flattenPositionItems(nested));
            continue;
        }
        items.push(item);
    }
    return items;
}

function collectFromList(list: unknown[]): TrackPoint[] {
    const points: TrackPoint[] = [];
    for (const item of flattenPositionItems(list)) {
        const point = pointFromUnknown(item);
        if (point) {
            points.push(point);
        }
    }
    return points;
}

/** Normalize Tractive position history (array / positions / json_segments) into sorted points. */
export function extractTrackPoints(payload: unknown): TrackPoint[] {
    let points: TrackPoint[] = [];

    if (Array.isArray(payload)) {
        points = collectFromList(payload);
    } else {
        const root = asRecord(payload);
        if (root) {
            if (Array.isArray(root.positions)) {
                points = collectFromList(root.positions);
            } else if (Array.isArray(root.segments)) {
                points = collectFromList(root.segments);
            }
        }
    }

    points.sort((a, b) => a.timeMs - b.timeMs);
    // Drop exact duplicates that sometimes appear at segment borders.
    return points.filter((point, index) => {
        if (index === 0) {
            return true;
        }
        const prev = points[index - 1];
        return point.timeMs !== prev.timeMs || point.lat !== prev.lat || point.lon !== prev.lon;
    });
}

function haversineKm(a: TrackPoint, b: TrackPoint): number {
    const toRad = (deg: number): number => (deg * Math.PI) / 180;
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

export function computeTrackDistanceKm(points: TrackPoint[]): number {
    if (points.length < 2) {
        return 0;
    }
    let sum = 0;
    for (let i = 1; i < points.length; i++) {
        sum += haversineKm(points[i - 1], points[i]);
    }
    return Math.round(sum * 100) / 100;
}

/** Index of the latest point at or before `timeMs`, or 0 if before the first point. */
export function findTrackIndexAtTime(points: TrackPoint[], timeMs: number): number {
    if (!points.length) {
        return -1;
    }
    if (timeMs <= points[0].timeMs) {
        return 0;
    }
    if (timeMs >= points[points.length - 1].timeMs) {
        return points.length - 1;
    }
    let lo = 0;
    let hi = points.length - 1;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (points[mid].timeMs <= timeMs) {
            lo = mid;
        } else {
            hi = mid - 1;
        }
    }
    return lo;
}
