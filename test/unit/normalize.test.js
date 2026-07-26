'use strict';

const { expect } = require('chai');
const { normalizeValue, sanitizeId, toMilliseconds, isUnixTimestampField } = require('../../build/lib/normalize');
const { formatApiError, getApiCode, getAxiosStatus } = require('../../build/lib/errors');
const { isMissingEndpointError, isTransientSectionError } = require('../../build/lib/apiAvailability');
const { AxiosError } = require('axios');

describe('normalizeValue', () => {
    it('uses field hints for known null values', () => {
        expect(normalizeValue('temperature_state', null)).to.deep.equal({
            value: null,
            type: 'string',
            role: 'text',
        });
        expect(normalizeValue('battery_level', null)).to.deep.equal({
            value: null,
            type: 'number',
            role: 'value.battery',
        });
        expect(normalizeValue('charging_state', null)).to.deep.equal({
            value: null,
            type: 'boolean',
            role: 'indicator',
        });
    });

    it('falls back to string/state for unknown null fields', () => {
        expect(normalizeValue('future_unknown_field', null)).to.deep.equal({
            value: null,
            type: 'string',
            role: 'state',
        });
    });

    it('maps primitive types', () => {
        expect(normalizeValue('online', true)).to.include({ type: 'boolean', role: 'indicator', value: true });
        expect(normalizeValue('count', 12)).to.include({ type: 'number', role: 'value', value: 12 });
        expect(normalizeValue('name', 'Rex')).to.include({ type: 'string', role: 'text', value: 'Rex' });
    });

    it('stringifies objects and arrays as json', () => {
        expect(normalizeValue('latlong', [1, 2])).to.deep.equal({
            value: '[1,2]',
            type: 'string',
            role: 'json',
        });
        expect(normalizeValue('address', { city: 'Berlin' }).role).to.equal('json');
    });

    it('converts unix timestamp fields to milliseconds', () => {
        const result = normalizeValue('time_pos', 1_700_000_000);
        expect(result).to.deep.equal({
            value: 1_700_000_000_000,
            type: 'number',
            role: 'value.time',
        });
    });

    it('does not treat large non-time numbers as timestamps', () => {
        expect(normalizeValue('battery_level', 1_700_000_000)).to.include({
            type: 'number',
            role: 'value',
            value: 1_700_000_000,
        });
    });
});

describe('timestamp helpers', () => {
    it('detects timestamp keys', () => {
        expect(isUnixTimestampField('time_pos', 1_700_000_000)).to.equal(true);
        expect(isUnixTimestampField('created_at', 1_700_000_000)).to.equal(true);
        expect(isUnixTimestampField('foo', 1_700_000_000)).to.equal(false);
    });

    it('converts seconds and keeps milliseconds', () => {
        expect(toMilliseconds(1_700_000_000)).to.equal(1_700_000_000_000);
        expect(toMilliseconds(1_700_000_000_000)).to.equal(1_700_000_000_000);
    });
});

describe('sanitizeId', () => {
    it('replaces dots, spaces and special characters', () => {
        expect(sanitizeId('foo.bar baz!')).to.equal('foo_bar_baz');
    });
});

describe('API error helpers', () => {
    function axiosError(status, data) {
        return new AxiosError(
            'Request failed',
            AxiosError.ERR_BAD_RESPONSE,
            {},
            {},
            {
                status,
                data,
                statusText: 'Error',
                headers: {},
                config: {},
            },
        );
    }

    it('redacts sensitive fields in formatApiError', () => {
        const text = formatApiError(
            axiosError(401, {
                code: 1,
                access_token: 'secret-token',
                password: 'hunter2',
            }),
        );
        expect(text).to.include('HTTP 401');
        expect(text).to.include('[redacted]');
        expect(text).to.not.include('secret-token');
        expect(text).to.not.include('hunter2');
    });

    it('extracts status and api code', () => {
        const error = axiosError(404, { code: 4002 });
        expect(getAxiosStatus(error)).to.equal(404);
        expect(getApiCode(error)).to.equal(4002);
    });

    it('classifies missing and transient endpoint errors', () => {
        expect(isMissingEndpointError(axiosError(404, {}))).to.equal(true);
        expect(isMissingEndpointError(axiosError(400, {}))).to.equal(true);
        expect(isMissingEndpointError(axiosError(403, {}))).to.equal(true);
        expect(isMissingEndpointError(axiosError(200, { code: 4002 }))).to.equal(true);
        expect(isMissingEndpointError(axiosError(500, {}))).to.equal(false);

        expect(isTransientSectionError(axiosError(429, {}))).to.equal(true);
        expect(isTransientSectionError(axiosError(503, {}))).to.equal(true);
        expect(isTransientSectionError(axiosError(404, {}))).to.equal(false);
    });
});
