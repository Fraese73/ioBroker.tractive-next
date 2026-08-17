'use strict';

const { expect } = require('chai');
const { extractGeofenceStates } = require('../../build/lib/geofences');

describe('extractGeofenceStates', () => {
    it('reads array payloads', () => {
        const result = extractGeofenceStates([
            {
                _id: 'gf_1',
                name: 'Home',
                active: true,
                entered_at: 1_786_000_000,
                left_at: 1_786_000_300,
            },
        ]);

        expect(result).to.deep.equal([
            {
                id: 'gf_1',
                name: 'Home',
                active: true,
                enteredAt: 1_786_000_000_000,
                leftAt: 1_786_000_300_000,
            },
        ]);
    });

    it('reads nested items payloads and alternate keys', () => {
        const result = extractGeofenceStates({
            items: [
                {
                    id: 'abc',
                    title: 'Park',
                    is_active: 'false',
                    entry_time: 1_700_000_000_000,
                    exit_time: 1_700_000_060_000,
                },
            ],
        });

        expect(result).to.deep.equal([
            {
                id: 'abc',
                name: 'Park',
                active: false,
                enteredAt: 1_700_000_000_000,
                leftAt: 1_700_000_060_000,
            },
        ]);
    });

    it('falls back to generated id and null values', () => {
        const result = extractGeofenceStates([{ foo: 'bar' }]);
        expect(result).to.deep.equal([
            {
                id: 'idx_1',
                name: null,
                active: null,
                enteredAt: null,
                leftAt: null,
            },
        ]);
    });
});
