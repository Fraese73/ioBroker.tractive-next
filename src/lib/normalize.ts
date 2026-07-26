export type CommonType = 'number' | 'string' | 'boolean';

export interface NormalizedValue {
    value: string | number | boolean | null;
    type: CommonType;
    role: string;
}

/** Known API fields keep a concrete type even while the value is still null. */
const NULL_FIELD_HINTS: Record<string, { type: CommonType; role: string }> = {
    temperature_state: { type: 'string', role: 'text' },
    battery_level: { type: 'number', role: 'value.battery' },
    battery_state: { type: 'string', role: 'text' },
    charging_state: { type: 'boolean', role: 'indicator' },
    clip_mounted_state: { type: 'boolean', role: 'indicator' },
    power_saving_zone_id: { type: 'string', role: 'text' },
    pos_uncertainty: { type: 'number', role: 'value' },
    sensor_used: { type: 'string', role: 'text' },
    latlong: { type: 'string', role: 'json' },
    address: { type: 'string', role: 'json' },
    time: { type: 'number', role: 'value.time' },
    time_pos: { type: 'number', role: 'value.time' },
    time_rcvd: { type: 'number', role: 'value.time' },
    hw_id: { type: 'string', role: 'text' },
    model_number: { type: 'string', role: 'text' },
    _type: { type: 'string', role: 'text' },
    _version: { type: 'string', role: 'text' },
};

export function sanitizeId(value: string): string {
    return value.replace(/[.\s]+/g, '_').replace(/[^A-Za-z0-9_-]/g, '');
}

export function toMilliseconds(value: number): number {
    // Tractive timestamps are typically Unix seconds; ioBroker value.time expects ms.
    return value < 10_000_000_000 ? Math.round(value * 1000) : Math.round(value);
}

export function isUnixTimestampField(key: string, value: number): boolean {
    if (!Number.isFinite(value) || value <= 0) {
        return false;
    }

    const keyHint =
        /(?:^|_)(time|timestamp|date|expires|created|updated|last_seen|time_pos|time_rcvd)(?:_|$)/i.test(key) ||
        /_(at|ts)$/i.test(key) ||
        /^(time|timestamp|date)$/i.test(key);

    if (!keyHint) {
        return false;
    }

    // Unix seconds (~2001–2286) or milliseconds in the same era.
    return (
        (value >= 1_000_000_000 && value < 10_000_000_000) || (value >= 1_000_000_000_000 && value < 10_000_000_000_000)
    );
}

export function normalizeValue(key: string, value: unknown): NormalizedValue {
    if (value === null || value === undefined) {
        const hint = NULL_FIELD_HINTS[key];
        if (hint) {
            return { value: null, type: hint.type, role: hint.role };
        }
        // Unknown nullable fields stay string until a concrete value arrives.
        return { value: null, type: 'string', role: 'state' };
    }
    if (typeof value === 'boolean') {
        return { value, type: 'boolean', role: 'indicator' };
    }
    if (typeof value === 'number') {
        if (isUnixTimestampField(key, value)) {
            return {
                value: toMilliseconds(value),
                type: 'number',
                role: 'value.time',
            };
        }
        return { value, type: 'number', role: 'value' };
    }
    if (typeof value === 'string') {
        return { value, type: 'string', role: 'text' };
    }
    return { value: JSON.stringify(value), type: 'string', role: 'json' };
}
