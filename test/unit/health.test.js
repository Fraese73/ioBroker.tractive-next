'use strict';

const { expect } = require('chai');
const { countPositionPoints, extractHealthOverview, resolveTrackerIdFromPet } = require('../../build/lib/health');

describe('extractHealthOverview', () => {
    it('reads nested content payload', () => {
        const result = extractHealthOverview({
            content: {
                activityDataSyncedAt: '2025-09-24T12:48:44Z',
                activity: { minutesActive: 6, minutesGoal: 30 },
                sleep: { minutesDaySleep: 1, minutesNightSleep: 2, minutesCalm: 3 },
                rest: { minutesRest: 4 },
                bark: { status: 'NORMAL' },
                restingHeartRate: { status: 'LOWER' },
                restingRespiratoryRate: { status: 'NORMAL' },
                healthAlerts: { unseenCount: 0 },
            },
            message: 'health_overview',
        });

        expect(result).to.deep.include({
            minutesActive: 6,
            minutesGoal: 30,
            minutesDaySleep: 1,
            minutesNightSleep: 2,
            minutesCalm: 3,
            minutesRest: 4,
            barkStatus: 'NORMAL',
            restingHeartRateStatus: 'LOWER',
            restingRespiratoryRateStatus: 'NORMAL',
            alertsUnseen: 0,
            activityDataSyncedAt: '2025-09-24T12:48:44Z',
        });
    });

    it('tolerates missing sections', () => {
        expect(extractHealthOverview({})).to.deep.equal({
            minutesActive: null,
            minutesGoal: null,
            minutesDaySleep: null,
            minutesNightSleep: null,
            minutesCalm: null,
            minutesRest: null,
            barkStatus: null,
            restingHeartRateStatus: null,
            restingRespiratoryRateStatus: null,
            alertsUnseen: null,
            activityDataSyncedAt: null,
        });
    });
});

describe('resolveTrackerIdFromPet', () => {
    it('resolves direct and nested tracker ids', () => {
        expect(resolveTrackerIdFromPet({ device_id: 'ABC123' })).to.equal('ABC123');
        expect(resolveTrackerIdFromPet({ tracker_id: 'XYZ' })).to.equal('XYZ');
        expect(resolveTrackerIdFromPet({ device: { _id: 'NESTED' } })).to.equal('NESTED');
        expect(resolveTrackerIdFromPet({})).to.equal(null);
    });
});

describe('countPositionPoints', () => {
    it('counts valid track points in arrays and segment payloads', () => {
        expect(
            countPositionPoints([
                { latlong: [1, 2], time: 1000 },
                { latlong: [3, 4], time: 2000 },
            ]),
        ).to.equal(2);
        expect(
            countPositionPoints({
                positions: [
                    { lat: 1, lon: 2, time: 1000 },
                    { lat: 3, lon: 4, time: 2000 },
                    { lat: 5, lon: 6, time: 3000 },
                ],
            }),
        ).to.equal(3);
        expect(
            countPositionPoints({
                segments: [
                    {
                        positions: [
                            { latlong: [1, 2], time: 1000 },
                            { latlong: [3, 4], time: 2000 },
                        ],
                    },
                    { points: [{ latlong: [5, 6], time: 3000 }] },
                ],
            }),
        ).to.equal(3);
        expect(
            countPositionPoints([
                [
                    { latlong: [1, 2], time: 1000 },
                    { latlong: [3, 4], time: 2000 },
                ],
            ]),
        ).to.equal(2);
        expect(countPositionPoints({})).to.equal(0);
        expect(countPositionPoints([{ a: 1 }, { a: 2 }])).to.equal(0);
    });
});
