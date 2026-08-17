'use strict';

const { expect } = require('chai');
const {
    buildAlertSnapshot,
    isTrackerStateOffline,
    LOW_BATTERY_THRESHOLD,
    STALE_POSITION_MINUTES,
} = require('../../build/lib/alerts');

describe('isTrackerStateOffline', () => {
    it('detects known offline state fragments', () => {
        expect(isTrackerStateOffline('OFFLINE')).to.equal(true);
        expect(isTrackerStateOffline('device_disconnected')).to.equal(true);
        expect(isTrackerStateOffline('not_connected')).to.equal(true);
        expect(isTrackerStateOffline('unreachable')).to.equal(true);
    });

    it('keeps normal tracker states online', () => {
        expect(isTrackerStateOffline('OPERATIONAL')).to.equal(false);
        expect(isTrackerStateOffline('LIVE_TRACKING')).to.equal(false);
        expect(isTrackerStateOffline('')).to.equal(false);
    });
});

describe('buildAlertSnapshot', () => {
    it('sets lowBattery at threshold', () => {
        const snapshot = buildAlertSnapshot({
            trackerState: 'OPERATIONAL',
            batteryLevel: LOW_BATTERY_THRESHOLD,
            lastSeenMs: Date.now(),
            nowMs: Date.now(),
        });
        expect(snapshot.lowBattery).to.equal(true);
    });

    it('marks stale positions after threshold minutes', () => {
        const nowMs = Date.now();
        const snapshot = buildAlertSnapshot({
            trackerState: 'OPERATIONAL',
            batteryLevel: 80,
            lastSeenMs: nowMs - STALE_POSITION_MINUTES * 60_000,
            nowMs,
        });
        expect(snapshot.noRecentPosition).to.equal(true);
        expect(snapshot.minutesSinceLastSeen).to.equal(STALE_POSITION_MINUTES);
    });

    it('marks missing position timestamps as stale', () => {
        const snapshot = buildAlertSnapshot({
            trackerState: 'OPERATIONAL',
            batteryLevel: 80,
            lastSeenMs: 0,
            nowMs: Date.now(),
        });
        expect(snapshot.noRecentPosition).to.equal(true);
        expect(snapshot.minutesSinceLastSeen).to.equal(null);
    });
});
