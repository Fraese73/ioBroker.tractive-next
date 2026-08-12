'use strict';

const { expect } = require('chai');
const { computeTrackDistanceKm, extractTrackPoints, findTrackIndexAtTime } = require('../../build/lib/history');

describe('extractTrackPoints', () => {
    it('reads flat arrays with latlong/time', () => {
        const points = extractTrackPoints([
            { latlong: [52.5, 13.4], time: 1_700_000_000 },
            { latlong: [52.51, 13.41], time: 1_700_000_100 },
        ]);
        expect(points).to.have.length(2);
        expect(points[0].lat).to.equal(52.5);
        expect(points[0].timeMs).to.equal(1_700_000_000_000);
    });

    it('reads nested json_segments arrays ([[points]])', () => {
        const points = extractTrackPoints([
            [
                { latlong: [48.74, 9.12], time: 1_786_506_502 },
                { latlong: [48.739, 9.126], time: 1_786_506_526 },
            ],
        ]);
        expect(points).to.have.length(2);
        expect(points[0].lat).to.equal(48.74);
        expect(points[0].timeMs).to.equal(1_786_506_502_000);
    });

    it('reads json_segments payloads', () => {
        const points = extractTrackPoints({
            segments: [
                {
                    positions: [
                        { latlong: [1, 2], time: 100 },
                        { latlong: [1.1, 2.1], time: 200 },
                    ],
                },
                { points: [{ lat: 1.2, lon: 2.2, time: 300 }] },
            ],
        });
        expect(points).to.have.length(3);
        expect(points[2].lat).to.equal(1.2);
    });

    it('sorts and drops duplicate border points', () => {
        const points = extractTrackPoints([
            { latlong: [1, 2], time: 200 },
            { latlong: [1, 2], time: 200 },
            { latlong: [3, 4], time: 100 },
        ]);
        expect(points).to.deep.equal([
            { lat: 3, lon: 4, timeMs: 100_000 },
            { lat: 1, lon: 2, timeMs: 200_000 },
        ]);
    });
});

describe('computeTrackDistanceKm', () => {
    it('returns 0 for short tracks', () => {
        expect(computeTrackDistanceKm([])).to.equal(0);
        expect(computeTrackDistanceKm([{ lat: 1, lon: 2, timeMs: 1 }])).to.equal(0);
    });

    it('computes a positive distance for two points', () => {
        const km = computeTrackDistanceKm([
            { lat: 52.5, lon: 13.4, timeMs: 1 },
            { lat: 52.51, lon: 13.41, timeMs: 2 },
        ]);
        expect(km).to.be.greaterThan(0);
    });
});

describe('findTrackIndexAtTime', () => {
    const points = [
        { lat: 1, lon: 1, timeMs: 1000 },
        { lat: 2, lon: 2, timeMs: 2000 },
        { lat: 3, lon: 3, timeMs: 3000 },
    ];

    it('finds nearest previous point', () => {
        expect(findTrackIndexAtTime(points, 500)).to.equal(0);
        expect(findTrackIndexAtTime(points, 2000)).to.equal(1);
        expect(findTrackIndexAtTime(points, 2500)).to.equal(1);
        expect(findTrackIndexAtTime(points, 9000)).to.equal(2);
        expect(findTrackIndexAtTime([], 1)).to.equal(-1);
    });
});
