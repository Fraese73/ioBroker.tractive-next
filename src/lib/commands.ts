export type TrackerCommand = 'live_tracking' | 'led_control' | 'buzzer_control';

export type ControlStateKey = 'liveTrackingActive' | 'ledActive' | 'buzzerActive';

export const CONTROL_COMMANDS: Record<ControlStateKey, TrackerCommand> = {
    liveTrackingActive: 'live_tracking',
    ledActive: 'led_control',
    buzzerActive: 'buzzer_control',
};

/** Keep optimistic control values this long when the API still reports a stale `active`. */
export const COMMAND_STATUS_GRACE_MS = 90_000;

export function buildTrackerCommandPath(trackerId: string, command: TrackerCommand, active: boolean): string {
    const action = active ? 'on' : 'off';
    return `/tracker/${trackerId}/command/${command}/${action}`;
}

export function parseControlStateId(id: string): { trackerId: string; controlKey: ControlStateKey } | null {
    const match = id.match(/\.([^.]+)\.controls\.(liveTrackingActive|ledActive|buzzerActive)$/);
    if (!match) {
        return null;
    }
    return { trackerId: match[1], controlKey: match[2] as ControlStateKey };
}

/**
 * Prefer the requested value while Tractive still reports `pending`.
 * Otherwise use `active` from the command response when present.
 */
export function resolveCommandReportedActive(
    requested: boolean,
    result: { active?: unknown; pending?: unknown },
): boolean {
    if (result.pending) {
        return requested;
    }
    if (typeof result.active === 'boolean') {
        return result.active;
    }
    return requested;
}

export function controlPendingKey(trackerId: string, controlKey: ControlStateKey): string {
    return `${trackerId}.${controlKey}`;
}

/**
 * While a command is pending confirmation, keep the desired value instead of the
 * still-stale poll value. Clear when the poll catches up or the grace window ends.
 */
export function resolvePolledControlActive(
    polled: boolean | null,
    pending: { desired: boolean; until: number } | undefined,
    now = Date.now(),
): { value: boolean | null; clearPending: boolean } {
    if (!pending) {
        return { value: polled, clearPending: false };
    }
    if (now > pending.until) {
        return { value: polled, clearPending: true };
    }
    if (polled === pending.desired) {
        return { value: polled, clearPending: true };
    }
    return { value: pending.desired, clearPending: false };
}
