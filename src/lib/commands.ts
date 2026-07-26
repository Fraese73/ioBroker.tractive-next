export type TrackerCommand = 'live_tracking' | 'led_control' | 'buzzer_control';

export const CONTROL_COMMANDS: Record<string, TrackerCommand> = {
    liveTrackingActive: 'live_tracking',
    ledActive: 'led_control',
    buzzerActive: 'buzzer_control',
};

export function buildTrackerCommandPath(trackerId: string, command: TrackerCommand, active: boolean): string {
    const action = active ? 'on' : 'off';
    return `/tracker/${trackerId}/command/${command}/${action}`;
}

export function parseControlStateId(id: string): { trackerId: string; controlKey: string } | null {
    const match = id.match(/\.([^.]+)\.controls\.(liveTrackingActive|ledActive|buzzerActive)$/);
    if (!match) {
        return null;
    }
    return { trackerId: match[1], controlKey: match[2] };
}
