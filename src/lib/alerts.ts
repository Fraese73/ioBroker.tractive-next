export interface AlertSnapshotInput {
    trackerState: string;
    batteryLevel: number;
    lastSeenMs: number;
    nowMs: number;
}

export interface AlertSnapshot {
    trackerOffline: boolean;
    lowBattery: boolean;
    noRecentPosition: boolean;
    minutesSinceLastSeen: number | null;
}

export const LOW_BATTERY_THRESHOLD = 20;
export const STALE_POSITION_MINUTES = 6 * 60;

export function isTrackerStateOffline(state: string): boolean {
    const normalized = state.trim().toUpperCase();
    if (!normalized) {
        return false;
    }

    return (
        normalized.includes('OFFLINE') ||
        normalized.includes('DISCONNECTED') ||
        normalized.includes('NOT_CONNECTED') ||
        normalized.includes('UNREACHABLE') ||
        normalized.includes('NO_SIGNAL')
    );
}

export function buildAlertSnapshot(input: AlertSnapshotInput): AlertSnapshot {
    const lowBattery = Number.isFinite(input.batteryLevel) && input.batteryLevel <= LOW_BATTERY_THRESHOLD;
    const trackerOffline = isTrackerStateOffline(input.trackerState);

    let minutesSinceLastSeen: number | null = null;
    if (Number.isFinite(input.lastSeenMs) && input.lastSeenMs > 0) {
        minutesSinceLastSeen = Math.max(0, Math.round((input.nowMs - input.lastSeenMs) / 60_000));
    }

    const noRecentPosition = minutesSinceLastSeen === null || minutesSinceLastSeen >= STALE_POSITION_MINUTES;

    return {
        trackerOffline,
        lowBattery,
        noRecentPosition,
        minutesSinceLastSeen,
    };
}
