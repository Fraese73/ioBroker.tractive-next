import * as utils from '@iobroker/adapter-core';
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { isMissingEndpointError, isTransientSectionError } from './lib/apiAvailability';
import { formatApiError, getAxiosStatus } from './lib/errors';
import { countPositionPoints, extractHealthOverview, resolveTrackerIdFromPet } from './lib/health';
import { normalizeValue, sanitizeId, toMilliseconds } from './lib/normalize';

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
    private readonly graphBaseUrl = 'https://graph.tractive.com/3';
    private readonly apsBaseUrl = 'https://aps-api.tractive.com/api/1';
    private readonly http: AxiosInstance;
    private accessToken = '';
    private userId = '';
    private expiresAt = 0;
    private timer?: ioBroker.Timeout;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({ ...options, name: 'tractive-next' });

        this.http = axios.create({
            baseURL: this.graphBaseUrl,
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
            this.log.error(`Startup failed: ${formatApiError(error)}`);
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
        const started = Date.now();
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

        this.log.debug(
            `Authenticated as Tractive user ${this.userId}; token expires at ${this.expiresAt} (${Date.now() - started} ms).`,
        );
    }

    private authHeaders(): Record<string, string> {
        return {
            'x-tractive-client': this.clientId,
            'x-tractive-user': this.userId,
            Authorization: `Bearer ${this.accessToken}`,
        };
    }

    private async apiGet<T>(
        url: string,
        options: {
            retry?: boolean;
            baseURL?: string;
            params?: Record<string, string | number>;
        } = {},
    ): Promise<T> {
        const retry = options.retry !== false;
        const started = Date.now();
        try {
            const response = await this.http.get<T>(url, {
                headers: this.authHeaders(),
                baseURL: options.baseURL ?? this.graphBaseUrl,
                params: options.params,
            });
            this.log.debug(`API GET ${url} -> HTTP ${response.status} (${Date.now() - started} ms)`);
            return response.data;
        } catch (error) {
            const status = getAxiosStatus(error);

            if (retry && (status === 401 || status === 403)) {
                this.log.warn(`Tractive returned HTTP ${status} for ${url}; refreshing token and retrying once.`);
                await this.authenticate();
                return this.apiGet<T>(url, { ...options, retry: false });
            }

            this.log.debug(`API GET ${url} failed after ${Date.now() - started} ms: ${formatApiError(error)}`);
            throw error;
        }
    }

    private async poll(): Promise<void> {
        if (this.timer) {
            this.clearTimeout(this.timer);
        }

        const started = Date.now();
        this.log.debug('Poll started.');

        try {
            if (!this.accessToken || (this.expiresAt > 0 && this.expiresAt <= Math.floor(Date.now() / 1000) + 60)) {
                await this.authenticate();
            }

            const trackers = await this.apiGet<ApiRecord[]>(`/user/${this.userId}/trackers`);
            const petIdsByTracker = await this.resolvePetIdsByTracker();
            const raw: Record<string, unknown> = { trackers, devices: {}, pets: Object.fromEntries(petIdsByTracker) };

            for (const tracker of trackers) {
                const trackerId = this.asString(tracker._id);
                if (!trackerId) {
                    this.log.warn('Received a tracker without _id; entry skipped.');
                    continue;
                }

                try {
                    await this.ensureObject(trackerId, 'device', this.asString(tracker.name) || trackerId);
                    await this.writeRecord(`${trackerId}.summary`, tracker);

                    const deviceData: Record<string, unknown> = {};
                    await this.fetchSection(trackerId, 'tracker', `/tracker/${trackerId}`, deviceData);
                    await this.fetchSection(
                        trackerId,
                        'device_hw_report',
                        `/device_hw_report/${trackerId}`,
                        deviceData,
                    );
                    await this.fetchSection(
                        trackerId,
                        'device_pos_report',
                        `/device_pos_report/${trackerId}`,
                        deviceData,
                    );

                    const petId = petIdsByTracker.get(trackerId);
                    if (petId) {
                        await this.fetchHealthOverview(trackerId, petId, deviceData);
                    }
                    await this.fetchPositionHistory(trackerId, deviceData);
                    await this.fetchGeofences(trackerId, deviceData);

                    await this.writeOsmMapLink(trackerId, deviceData.device_pos_report);
                    await this.writeControlStatus(trackerId, deviceData.tracker);
                    await this.writeOverview(trackerId, this.asString(tracker.name) || trackerId, deviceData);
                    (raw.devices as Record<string, unknown>)[trackerId] = deviceData;
                } catch (error) {
                    // Keep other trackers / later polls alive if one device fails unexpectedly.
                    this.log.warn(`Tracker ${trackerId} update incomplete: ${formatApiError(error)}`);
                }
            }

            await this.setStateAsync('rawJson', JSON.stringify(raw), true);
            await this.setStateAsync('info.lastUpdate', Date.now(), true);
            await this.setStateAsync('info.connection', true, true);
            this.log.debug(`Poll finished successfully in ${Date.now() - started} ms (${trackers.length} tracker(s)).`);
        } catch (error) {
            await this.setStateAsync('info.connection', false, true);
            this.log.error(`Polling failed: ${formatApiError(error)}`);
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
            this.log.debug(`Section ${section} ok for tracker ${trackerId}.`);
        } catch (error) {
            if (isMissingEndpointError(error)) {
                this.log.debug(`Section ${section} not available for tracker ${trackerId}: ${formatApiError(error)}`);
                return;
            }
            if (isTransientSectionError(error)) {
                this.log.warn(
                    `Section ${section} temporarily unavailable for tracker ${trackerId}: ${formatApiError(error)}`,
                );
                return;
            }
            // Unexpected section errors should not abort the whole poll for this tracker.
            this.log.warn(`Section ${section} failed for tracker ${trackerId}: ${formatApiError(error)}`);
        }
    }

    private async resolvePetIdsByTracker(): Promise<Map<string, string>> {
        const map = new Map<string, string>();
        try {
            const pets = await this.apiGet<ApiRecord[]>(`/user/${this.userId}/trackable_objects`);
            for (const pet of pets) {
                const petId = this.asString(pet._id);
                if (!petId) {
                    continue;
                }

                let trackerId = resolveTrackerIdFromPet(pet);
                if (!trackerId) {
                    try {
                        const details = await this.apiGet<ApiRecord>(`/trackable_object/${petId}`);
                        trackerId = resolveTrackerIdFromPet(details);
                        if (trackerId) {
                            await this.writeRecord(`${trackerId}.pet`, details);
                        }
                    } catch (error) {
                        this.log.debug(`Pet details unavailable for ${petId}: ${formatApiError(error)}`);
                    }
                }

                if (trackerId) {
                    map.set(trackerId, petId);
                }
            }
            this.log.debug(`Mapped ${map.size} pet(s) to tracker(s).`);
        } catch (error) {
            this.log.debug(`trackable_objects unavailable: ${formatApiError(error)}`);
        }
        return map;
    }

    private async fetchHealthOverview(
        trackerId: string,
        petId: string,
        target: Record<string, unknown>,
    ): Promise<void> {
        try {
            const data = await this.apiGet<ApiRecord>(`/pet/${petId}/health/overview`, {
                baseURL: this.apsBaseUrl,
            });
            const content = this.asRecord(data.content) ?? data;
            target.health_overview = content;
            await this.writeRecord(`${trackerId}.health_overview`, content);
            await this.writeHealthStates(trackerId, content);
            this.log.debug(`Health overview ok for tracker ${trackerId} (pet ${petId}).`);
        } catch (error) {
            if (isMissingEndpointError(error) || isTransientSectionError(error)) {
                this.log.debug(`Health overview not available for tracker ${trackerId}: ${formatApiError(error)}`);
                return;
            }
            this.log.warn(`Health overview failed for tracker ${trackerId}: ${formatApiError(error)}`);
        }
    }

    private async writeHealthStates(trackerId: string, payload: unknown): Promise<void> {
        const health = extractHealthOverview(payload);
        const base = `${trackerId}.health`;
        await this.ensureObject(base, 'channel', 'health');

        const states: Array<{
            id: string;
            name: string;
            value: ioBroker.StateValue;
            type: ioBroker.CommonType;
            role: string;
        }> = [
            {
                id: `${base}.minutesActive`,
                name: 'minutesActive',
                value: health.minutesActive,
                type: 'number',
                role: 'value',
            },
            {
                id: `${base}.minutesGoal`,
                name: 'minutesGoal',
                value: health.minutesGoal,
                type: 'number',
                role: 'value',
            },
            {
                id: `${base}.minutesDaySleep`,
                name: 'minutesDaySleep',
                value: health.minutesDaySleep,
                type: 'number',
                role: 'value',
            },
            {
                id: `${base}.minutesNightSleep`,
                name: 'minutesNightSleep',
                value: health.minutesNightSleep,
                type: 'number',
                role: 'value',
            },
            {
                id: `${base}.minutesCalm`,
                name: 'minutesCalm',
                value: health.minutesCalm,
                type: 'number',
                role: 'value',
            },
            {
                id: `${base}.minutesRest`,
                name: 'minutesRest',
                value: health.minutesRest,
                type: 'number',
                role: 'value',
            },
            {
                id: `${base}.barkStatus`,
                name: 'barkStatus',
                value: health.barkStatus,
                type: 'string',
                role: 'text',
            },
            {
                id: `${base}.restingHeartRateStatus`,
                name: 'restingHeartRateStatus',
                value: health.restingHeartRateStatus,
                type: 'string',
                role: 'text',
            },
            {
                id: `${base}.restingRespiratoryRateStatus`,
                name: 'restingRespiratoryRateStatus',
                value: health.restingRespiratoryRateStatus,
                type: 'string',
                role: 'text',
            },
            {
                id: `${base}.alertsUnseen`,
                name: 'alertsUnseen',
                value: health.alertsUnseen,
                type: 'number',
                role: 'value',
            },
            {
                id: `${base}.activityDataSyncedAt`,
                name: 'activityDataSyncedAt',
                value: health.activityDataSyncedAt,
                type: 'string',
                role: 'text',
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

    private async fetchPositionHistory(trackerId: string, target: Record<string, unknown>): Promise<void> {
        const timeTo = Math.floor(Date.now() / 1000);
        const timeFrom = timeTo - 24 * 60 * 60;
        try {
            const data = await this.apiGet<unknown>(`/tracker/${trackerId}/positions`, {
                params: {
                    time_from: timeFrom,
                    time_to: timeTo,
                    format: 'json_segments',
                },
            });
            target.position_history = data;
            const pointCount = countPositionPoints(data);
            const base = `${trackerId}.history`;
            await this.ensureObject(base, 'channel', 'history');
            await this.writeTypedState(
                `${base}.timeFrom`,
                'timeFrom',
                toMilliseconds(timeFrom),
                'number',
                'value.time',
            );
            await this.writeTypedState(`${base}.timeTo`, 'timeTo', toMilliseconds(timeTo), 'number', 'value.time');
            await this.writeTypedState(`${base}.pointCount`, 'pointCount', pointCount, 'number', 'value');
            await this.writeTypedState(
                `${base}.positionsJson`,
                'positionsJson',
                JSON.stringify(data),
                'string',
                'json',
            );
            this.log.debug(`Position history ok for tracker ${trackerId} (${pointCount} point(s)).`);
        } catch (error) {
            if (isMissingEndpointError(error) || isTransientSectionError(error)) {
                this.log.debug(`Position history not available for tracker ${trackerId}: ${formatApiError(error)}`);
                return;
            }
            this.log.warn(`Position history failed for tracker ${trackerId}: ${formatApiError(error)}`);
        }
    }

    private async fetchGeofences(trackerId: string, target: Record<string, unknown>): Promise<void> {
        const candidates = [`/tracker/${trackerId}/geofences`, `/user/${this.userId}/geofences`];
        for (const endpoint of candidates) {
            try {
                const data = await this.apiGet<unknown>(endpoint);
                target.geofences = data;
                await this.ensureObject(`${trackerId}.geofences`, 'channel', 'geofences');
                await this.writeTypedState(
                    `${trackerId}.geofences.json`,
                    'json',
                    JSON.stringify(data),
                    'string',
                    'json',
                );
                this.log.debug(`Geofences ok for tracker ${trackerId} via ${endpoint}.`);
                return;
            } catch (error) {
                if (isMissingEndpointError(error) || isTransientSectionError(error)) {
                    this.log.debug(`Geofences unavailable at ${endpoint}: ${formatApiError(error)}`);
                    continue;
                }
                this.log.warn(`Geofences failed at ${endpoint}: ${formatApiError(error)}`);
            }
        }
    }

    private async writeControlStatus(trackerId: string, trackerDetails: unknown): Promise<void> {
        const tracker = this.asRecord(trackerDetails);
        if (!tracker) {
            return;
        }

        const live = this.asRecord(tracker.live_tracking);
        const led = this.asRecord(tracker.led_control);
        const buzzer = this.asRecord(tracker.buzzer_control);
        const base = `${trackerId}.controls`;
        await this.ensureObject(base, 'channel', 'controls');

        await this.writeTypedState(
            `${base}.liveTrackingActive`,
            'liveTrackingActive',
            live ? Boolean(live.active) : null,
            'boolean',
            'indicator',
        );
        await this.writeTypedState(
            `${base}.ledActive`,
            'ledActive',
            led ? Boolean(led.active) : null,
            'boolean',
            'indicator',
        );
        await this.writeTypedState(
            `${base}.buzzerActive`,
            'buzzerActive',
            buzzer ? Boolean(buzzer.active) : null,
            'boolean',
            'indicator',
        );
        await this.writeTypedState(
            `${base}.trackerState`,
            'trackerState',
            this.asString(tracker.tracker_state) || null,
            'string',
            'text',
        );
    }

    private async writeTypedState(
        id: string,
        name: string,
        value: ioBroker.StateValue,
        type: ioBroker.CommonType,
        role: string,
    ): Promise<void> {
        await this.ensureState(id, name, { value, type, role });
        await this.setStateAsync(id, { val: value, ack: true });
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
        const health = extractHealthOverview(deviceData.health_overview);
        const live = this.asRecord(tracker?.live_tracking);
        const base = `${trackerId}.overview`;

        await this.ensureObject(base, 'channel', 'overview');

        const latlong = pos?.latlong;
        const lat = Array.isArray(latlong) ? Number(latlong[0]) : NaN;
        const lon = Array.isArray(latlong) ? Number(latlong[1]) : NaN;
        const lastSeenRaw = Number(pos?.time ?? pos?.time_pos ?? 0);
        const lastSeen = lastSeenRaw > 0 ? toMilliseconds(lastSeenRaw) : 0;
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
            {
                id: `${base}.minutesActive`,
                name: 'minutesActive',
                value: health.minutesActive,
                type: 'number',
                role: 'value',
            },
            {
                id: `${base}.minutesGoal`,
                name: 'minutesGoal',
                value: health.minutesGoal,
                type: 'number',
                role: 'value',
            },
            {
                id: `${base}.liveTrackingActive`,
                name: 'liveTrackingActive',
                value: live ? Boolean(live.active) : null,
                type: 'boolean',
                role: 'indicator',
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

            const id = `${baseId}.${sanitizeId(key)}`;
            const normalized = normalizeValue(key, value);
            await this.ensureState(id, key, normalized);
            await this.setStateAsync(id, { val: normalized.value, ack: true });
        }
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
                native: {
                    pendingConcreteValue: normalized.value === null,
                },
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
            existing.native = {
                ...(existing.native || {}),
                pendingConcreteValue: false,
            };
            await this.setObjectAsync(id, existing);
            this.log.debug(`Updated inferred type/role of ${id} to ${normalized.type}/${normalized.role}.`);
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
