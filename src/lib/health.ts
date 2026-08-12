export interface HealthOverviewStates {
    minutesActive: number | null;
    minutesGoal: number | null;
    minutesDaySleep: number | null;
    minutesNightSleep: number | null;
    minutesCalm: number | null;
    minutesRest: number | null;
    barkStatus: string | null;
    restingHeartRateStatus: string | null;
    restingRespiratoryRateStatus: string | null;
    alertsUnseen: number | null;
    activityDataSyncedAt: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function asNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Flatten Tractive health_overview payloads into stable overview values. */
export function extractHealthOverview(payload: unknown): HealthOverviewStates {
    const root = asRecord(payload) ?? {};
    const content = asRecord(root.content) ?? root;
    const activity = asRecord(content.activity);
    const sleep = asRecord(content.sleep);
    const rest = asRecord(content.rest);
    const bark = asRecord(content.bark);
    const heart = asRecord(content.restingHeartRate);
    const respiratory = asRecord(content.restingRespiratoryRate);
    const alerts = asRecord(content.healthAlerts);

    return {
        minutesActive: asNumber(activity?.minutesActive),
        minutesGoal: asNumber(activity?.minutesGoal),
        minutesDaySleep: asNumber(sleep?.minutesDaySleep),
        minutesNightSleep: asNumber(sleep?.minutesNightSleep),
        minutesCalm: asNumber(sleep?.minutesCalm),
        minutesRest: asNumber(rest?.minutesRest ?? rest?.minutes),
        barkStatus: asString(bark?.status),
        restingHeartRateStatus: asString(heart?.status),
        restingRespiratoryRateStatus: asString(respiratory?.status),
        alertsUnseen: asNumber(alerts?.unseenCount),
        activityDataSyncedAt: asString(content.activityDataSyncedAt),
    };
}

export function resolveTrackerIdFromPet(details: unknown): string | null {
    const root = asRecord(details);
    if (!root) {
        return null;
    }

    const direct = asString(root.device_id) || asString(root.tracker_id);
    if (direct) {
        return direct;
    }

    const device = asRecord(root.device);
    const nested = asString(device?._id) || asString(device?.hw_id);
    return nested;
}

import { extractTrackPoints } from './history';

export function countPositionPoints(payload: unknown): number {
    return extractTrackPoints(payload).length;
}
