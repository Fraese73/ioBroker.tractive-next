import { toMilliseconds } from './normalize';

export interface GeofenceState {
    id: string;
    name: string | null;
    active: boolean | null;
    enteredAt: number | null;
    leftAt: number | null;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function asString(value: unknown): string | null {
    if (typeof value === 'string' && value.length > 0) {
        return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }
    return null;
}

function asBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return value === 1 ? true : value === 0 ? false : null;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'on', 'active', 'inside', 'in'].includes(normalized)) {
            return true;
        }
        if (['0', 'false', 'no', 'off', 'inactive', 'outside', 'out'].includes(normalized)) {
            return false;
        }
    }
    return null;
}

function asTimeMs(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return null;
    }
    return toMilliseconds(value);
}

function collectItems(payload: unknown): Record<string, unknown>[] {
    if (Array.isArray(payload)) {
        return payload.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item));
    }
    const root = asRecord(payload);
    if (!root) {
        return [];
    }

    const nested =
        (Array.isArray(root.items) && root.items) ||
        (Array.isArray(root.geofences) && root.geofences) ||
        (Array.isArray(root.data) && root.data) ||
        null;
    if (nested) {
        return nested.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item));
    }

    return [root];
}

/** Normalize variable Tractive geofence payloads into stable states. */
export function extractGeofenceStates(payload: unknown): GeofenceState[] {
    const items = collectItems(payload);
    const result: GeofenceState[] = [];

    items.forEach((item, index) => {
        const id =
            asString(item._id) ||
            asString(item.id) ||
            asString(item.geofence_id) ||
            asString(item.uuid) ||
            `idx_${index + 1}`;

        const name = asString(item.name) || asString(item.title) || asString(item.label);
        const active =
            asBoolean(item.active) ??
            asBoolean(item.is_active) ??
            asBoolean(item.enabled) ??
            asBoolean(item.inside) ??
            asBoolean(item.in_geofence);

        const enteredAt =
            asTimeMs(item.entered_at) ??
            asTimeMs(item.entry_time) ??
            asTimeMs(item.enter_time) ??
            asTimeMs(item.last_entered_at) ??
            asTimeMs(item.time_entered);

        const leftAt =
            asTimeMs(item.left_at) ??
            asTimeMs(item.exit_time) ??
            asTimeMs(item.leave_time) ??
            asTimeMs(item.last_left_at) ??
            asTimeMs(item.time_left);

        result.push({
            id,
            name,
            active,
            enteredAt,
            leftAt,
        });
    });

    return result;
}
