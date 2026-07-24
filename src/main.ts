import * as utils from '@iobroker/adapter-core';
import type { AxiosInstance } from 'axios';
import axios, { AxiosError } from 'axios';

interface AdapterConfig {
    email: string;
    password: string;
    interval: number;
}

interface AuthResponse {
    access_token: string;
    user_id: string;
    expires_at: number;
}

type ApiRecord = Record<string, unknown>;

class TractiveNext extends utils.Adapter {
    declare config: AdapterConfig;

    private readonly clientId = '5f9be055d8912eb21a4cd7ba';
    private readonly http: AxiosInstance;
    private accessToken = '';
    private userId = '';
    private expiresAt = 0;
    private timer?: ioBroker.Timeout;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({ ...options, name: 'tractive-next' });

        this.http = axios.create({
            baseURL: 'https://graph.tractive.com/3',
            timeout: 20_000,
            headers: { 'Content-Type': 'application/json' },
        });

        this.on('ready', () => void this.onReady());
        this.on('unload', (callback) => this.onUnload(callback));
    }

    private async onReady(): Promise<void> {
        await this.ensureInstanceObjects();
        await this.setStateAsync('info.connection', false, true);

        if (!this.config.email || !this.config.password) {
            this.log.error('Tractive email address and password are required.');
            return;
        }

        try {
            await this.authenticate();
            await this.poll();
        } catch (error) {
            this.log.error(`Startup failed: ${this.errorText(error)}`);
        }
    }

    private async ensureInstanceObjects(): Promise<void> {
        await this.setObjectNotExistsAsync('info', {
            type: 'channel',
            common: { name: 'Information' },
            native: {},
        });
        await this.setObjectNotExistsAsync('info.connection', {
            type: 'state',
            common: {
                name: 'Connection',
                type: 'boolean',
                role: 'indicator.connected',
                read: true,
                write: false,
                def: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync('info.lastUpdate', {
            type: 'state',
            common: {
                name: 'Last successful update',
                type: 'number',
                role: 'value.time',
                read: true,
                write: false,
                def: 0,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync('rawJson', {
            type: 'state',
            common: {
                name: 'Complete API response',
                type: 'string',
                role: 'json',
                read: true,
                write: false,
                def: '{}',
            },
            native: {},
        });
    }

    private async authenticate(): Promise<void> {
        const response = await this.http.post<AuthResponse>(
            '/auth/token',
            {
                platform_email: this.config.email,
                platform_token: this.config.password,
                grant_type: 'tractive',
            },
            {
                headers: { 'x-tractive-client': this.clientId },
            },
        );

        this.accessToken = response.data.access_token;
        this.userId = response.data.user_id;
        this.expiresAt = Number(response.data.expires_at || 0);

        if (!this.accessToken || !this.userId) {
            throw new Error('Authentication response did not contain access_token and user_id.');
        }

        this.log.debug(`Authenticated as Tractive user ${this.userId}; token expires at ${this.expiresAt}.`);
    }

    private authHeaders(): Record<string, string> {
        return {
            'x-tractive-client': this.clientId,
            'x-tractive-user': this.userId,
            Authorization: `Bearer ${this.accessToken}`,
        };
    }

    private async apiGet<T>(url: string, retry = true): Promise<T> {
        try {
            const response = await this.http.get<T>(url, {
                headers: this.authHeaders(),
            });
            return response.data;
        } catch (error) {
            const status = error instanceof AxiosError ? error.response?.status : undefined;

            if (retry && (status === 401 || status === 403)) {
                this.log.warn(`Tractive returned HTTP ${status}; refreshing token and retrying once.`);
                await this.authenticate();
                return this.apiGet<T>(url, false);
            }

            throw error;
        }
    }

    private async poll(): Promise<void> {
        if (this.timer) {
            this.clearTimeout(this.timer);
        }

        try {
            if (!this.accessToken || (this.expiresAt > 0 && this.expiresAt <= Math.floor(Date.now() / 1000) + 60)) {
                await this.authenticate();
            }

            const trackers = await this.apiGet<ApiRecord[]>(`/user/${this.userId}/trackers`);
            const raw: Record<string, unknown> = { trackers, devices: {} };

            for (const tracker of trackers) {
                const trackerId = this.asString(tracker._id);
                if (!trackerId) {
                    this.log.warn('Received a tracker without _id; entry skipped.');
                    continue;
                }

                await this.ensureObject(trackerId, 'device', this.asString(tracker.name) || trackerId);
                await this.writeRecord(`${trackerId}.summary`, tracker);

                const deviceData: Record<string, unknown> = {};
                await this.fetchSection(trackerId, 'tracker', `/tracker/${trackerId}`, deviceData);
                await this.fetchSection(trackerId, 'device_hw_report', `/device_hw_report/${trackerId}`, deviceData);
                await this.fetchSection(trackerId, 'device_pos_report', `/device_pos_report/${trackerId}`, deviceData);
                await this.writeOsmMapLink(trackerId, deviceData.device_pos_report);
                await this.writeOverview(trackerId, this.asString(tracker.name) || trackerId, deviceData);
                (raw.devices as Record<string, unknown>)[trackerId] = deviceData;
            }

            await this.setStateAsync('rawJson', JSON.stringify(raw), true);
            await this.setStateAsync('info.lastUpdate', Date.now(), true);
            await this.setStateAsync('info.connection', true, true);
        } catch (error) {
            await this.setStateAsync('info.connection', false, true);
            this.log.error(`Polling failed: ${this.errorText(error)}`);
        } finally {
            const seconds = Math.max(30, Number(this.config.interval) || 60);
            this.timer = this.setTimeout(() => void this.poll(), seconds * 1000);
        }
    }

    private async fetchSection(
        trackerId: string,
        section: string,
        endpoint: string,
        target: Record<string, unknown>,
    ): Promise<void> {
        try {
            const data = await this.apiGet<ApiRecord>(endpoint);
            target[section] = data;
            await this.writeRecord(`${trackerId}.${section}`, data);
        } catch (error) {
            const axiosError = error instanceof AxiosError ? error : undefined;
            const apiCode = (axiosError?.response?.data as { code?: number } | undefined)?.code;

            if (apiCode === 4002 || axiosError?.response?.status === 404) {
                this.log.debug(`${section} is not available for tracker ${trackerId}.`);
                return;
            }
            throw error;
        }
    }

    private async writeOsmMapLink(trackerId: string, posReport: unknown): Promise<void> {
        if (!posReport || typeof posReport !== 'object') {
            return;
        }

        const latlong = (posReport as ApiRecord).latlong;
        if (!Array.isArray(latlong) || latlong.length < 2) {
            return;
        }

        const lat = Number(latlong[0]);
        const lon = Number(latlong[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return;
        }

        const url = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
        const id = `${trackerId}.device_pos_report.osmMapUrl`;
        await this.ensureObject(`${trackerId}.device_pos_report`, 'channel', 'device_pos_report');
        await this.ensureState(id, 'osmMapUrl', {
            value: url,
            type: 'string',
            role: 'text.url',
        });
        await this.setStateAsync(id, { val: url, ack: true });

        await this.ensureState(`${trackerId}.device_pos_report.latitude`, 'latitude', {
            value: lat,
            type: 'number',
            role: 'value.gps.latitude',
        });
        await this.setStateAsync(`${trackerId}.device_pos_report.latitude`, {
            val: lat,
            ack: true,
        });

        await this.ensureState(`${trackerId}.device_pos_report.longitude`, 'longitude', {
            value: lon,
            type: 'number',
            role: 'value.gps.longitude',
        });
        await this.setStateAsync(`${trackerId}.device_pos_report.longitude`, {
            val: lon,
            ack: true,
        });
    }

    private async writeOverview(
        trackerId: string,
        fallbackName: string,
        deviceData: Record<string, unknown>,
    ): Promise<void> {
        const pos = this.asRecord(deviceData.device_pos_report);
        const hw = this.asRecord(deviceData.device_hw_report);
        const tracker = this.asRecord(deviceData.tracker);
        const base = `${trackerId}.overview`;

        await this.ensureObject(base, 'channel', 'overview');

        const latlong = pos?.latlong;
        const lat = Array.isArray(latlong) ? Number(latlong[0]) : NaN;
        const lon = Array.isArray(latlong) ? Number(latlong[1]) : NaN;
        const lastSeenRaw = Number(pos?.time ?? pos?.time_pos ?? 0);
        const lastSeen = lastSeenRaw > 0 ? this.toMilliseconds(lastSeenRaw) : 0;
        const accuracy = Number(pos?.pos_uncertainty ?? 0);
        const batteryLevel = Number(hw?.battery_level ?? tracker?.battery_level ?? NaN);
        const sensorUsed = this.asString(pos?.sensor_used);
        const batteryState = this.asString(tracker?.battery_state ?? hw?.battery_state);
        const charging = Boolean(tracker?.charging_state ?? false);
        const addressObj = this.asRecord(pos?.address);
        const address = this.asString(addressObj?.full_address);
        const name = this.asString(tracker?.name) || fallbackName;
        const osmMapUrl =
            Number.isFinite(lat) && Number.isFinite(lon)
                ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`
                : '';

        const states: Array<{
            id: string;
            name: string;
            value: ioBroker.StateValue;
            type: ioBroker.CommonType;
            role: string;
        }> = [
            {
                id: `${base}.name`,
                name: 'name',
                value: name,
                type: 'string',
                role: 'text',
            },
            {
                id: `${base}.latitude`,
                name: 'latitude',
                value: Number.isFinite(lat) ? lat : null,
                type: 'number',
                role: 'value.gps.latitude',
            },
            {
                id: `${base}.longitude`,
                name: 'longitude',
                value: Number.isFinite(lon) ? lon : null,
                type: 'number',
                role: 'value.gps.longitude',
            },
            {
                id: `${base}.accuracy`,
                name: 'accuracy',
                value: Number.isFinite(accuracy) ? accuracy : null,
                type: 'number',
                role: 'value',
            },
            {
                id: `${base}.lastSeen`,
                name: 'lastSeen',
                value: lastSeen || null,
                type: 'number',
                role: 'value.time',
            },
            {
                id: `${base}.batteryLevel`,
                name: 'batteryLevel',
                value: Number.isFinite(batteryLevel) ? batteryLevel : null,
                type: 'number',
                role: 'value.battery',
            },
            {
                id: `${base}.batteryState`,
                name: 'batteryState',
                value: batteryState || null,
                type: 'string',
                role: 'text',
            },
            {
                id: `${base}.charging`,
                name: 'charging',
                value: charging,
                type: 'boolean',
                role: 'indicator',
            },
            {
                id: `${base}.sensorUsed`,
                name: 'sensorUsed',
                value: sensorUsed || null,
                type: 'string',
                role: 'text',
            },
            {
                id: `${base}.address`,
                name: 'address',
                value: address || null,
                type: 'string',
                role: 'text',
            },
            {
                id: `${base}.osmMapUrl`,
                name: 'osmMapUrl',
                value: osmMapUrl || null,
                type: 'string',
                role: 'text.url',
            },
        ];

        for (const state of states) {
            await this.ensureState(state.id, state.name, {
                value: state.value,
                type: state.type,
                role: state.role,
            });
            await this.setStateAsync(state.id, { val: state.value, ack: true });
        }
    }

    private asRecord(value: unknown): ApiRecord | undefined {
        return value && typeof value === 'object' && !Array.isArray(value) ? (value as ApiRecord) : undefined;
    }

    private asString(value: unknown): string {
        return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
    }

    private async writeRecord(baseId: string, record: ApiRecord): Promise<void> {
        await this.ensureObject(baseId, 'channel', baseId.split('.').pop() ?? baseId);

        for (const [key, value] of Object.entries(record)) {
            if (key === '_id') {
                continue;
            }

            const id = `${baseId}.${this.sanitizeId(key)}`;
            const normalized = this.normalizeValue(key, value);
            await this.ensureState(id, key, normalized);
            await this.setStateAsync(id, { val: normalized.value, ack: true });
        }
    }

    private normalizeValue(
        key: string,
        value: unknown,
    ): { value: ioBroker.StateValue; type: ioBroker.CommonType; role: string } {
        if (value === null || value === undefined) {
            // API fields such as temperature_state can legitimately be null.
            // A nullable unknown field is represented as string until a concrete value arrives.
            return { value: null, type: 'string', role: 'state' };
        }
        if (typeof value === 'boolean') {
            return { value, type: 'boolean', role: 'indicator' };
        }
        if (typeof value === 'number') {
            if (this.isUnixTimestampField(key, value)) {
                return {
                    value: this.toMilliseconds(value),
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

    private isUnixTimestampField(key: string, value: number): boolean {
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
            (value >= 1_000_000_000 && value < 10_000_000_000) ||
            (value >= 1_000_000_000_000 && value < 10_000_000_000_000)
        );
    }

    private toMilliseconds(value: number): number {
        // Tractive timestamps are typically Unix seconds; ioBroker value.time expects ms.
        return value < 10_000_000_000 ? Math.round(value * 1000) : Math.round(value);
    }

    private async ensureState(
        id: string,
        name: string,
        normalized: {
            value: ioBroker.StateValue;
            type: ioBroker.CommonType;
            role: string;
        },
    ): Promise<void> {
        const existing = await this.getObjectAsync(id);

        if (!existing) {
            await this.setObjectAsync(id, {
                type: 'state',
                common: {
                    name,
                    type: normalized.type,
                    role: normalized.role,
                    read: true,
                    write: false,
                },
                native: {},
            });
            return;
        }

        if (existing.type !== 'state' || normalized.value === null) {
            return;
        }

        const typeChanged = existing.common.type !== normalized.type;
        const roleChanged = existing.common.role !== normalized.role;

        // Update when a null field becomes concrete, or when a timestamp role is inferred later.
        if (typeChanged || roleChanged) {
            existing.common.type = normalized.type;
            existing.common.role = normalized.role;
            await this.setObjectAsync(id, existing);
            this.log.info(`Updated inferred type/role of ${id} to ${normalized.type}/${normalized.role}.`);
        }
    }

    private async ensureObject(id: string, type: 'device' | 'channel', name: string): Promise<void> {
        if (await this.getObjectAsync(id)) {
            return;
        }
        await this.setObjectAsync(id, {
            type,
            common: { name },
            native: {},
        });
    }

    private sanitizeId(value: string): string {
        return value.replace(/[.\s]+/g, '_').replace(/[^A-Za-z0-9_-]/g, '');
    }

    private errorText(error: unknown): string {
        if (error instanceof AxiosError) {
            const status = error.response?.status;
            const data = error.response?.data;
            return `${error.message}${status ? ` (HTTP ${status})` : ''}${data ? `: ${JSON.stringify(data)}` : ''}`;
        }
        return error instanceof Error ? error.message : String(error);
    }

    private onUnload(callback: () => void): void {
        try {
            if (this.timer) {
                this.clearTimeout(this.timer);
            }
            void this.setStateAsync('info.connection', false, true).finally(callback);
        } catch {
            callback();
        }
    }
}

if (require.main !== module) {
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new TractiveNext(options);
} else {
    new TractiveNext();
}
