import * as utils from "@iobroker/adapter-core";
import axios, { AxiosError, AxiosInstance } from "axios";

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

    private readonly clientId = "5f9be055d8912eb21a4cd7ba";
    private readonly http: AxiosInstance;
    private accessToken = "";
    private userId = "";
    private expiresAt = 0;
    private timer?: ioBroker.Timeout;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({ ...options, name: "tractive-next" });

        this.http = axios.create({
            baseURL: "https://graph.tractive.com/3",
            timeout: 20_000,
            headers: { "Content-Type": "application/json" },
        });

        this.on("ready", () => void this.onReady());
        this.on("unload", callback => this.onUnload(callback));
    }

    private async onReady(): Promise<void> {
        await this.setStateAsync("info.connection", false, true);

        if (!this.config.email || !this.config.password) {
            this.log.error("Tractive email address and password are required.");
            return;
        }

        try {
            await this.authenticate();
            await this.poll();
        } catch (error) {
            this.log.error(`Startup failed: ${this.errorText(error)}`);
        }
    }

    private async authenticate(): Promise<void> {
        const response = await this.http.post<AuthResponse>("/auth/token", {
            platform_email: this.config.email,
            platform_token: this.config.password,
            grant_type: "tractive",
        }, {
            headers: { "x-tractive-client": this.clientId },
        });

        this.accessToken = response.data.access_token;
        this.userId = response.data.user_id;
        this.expiresAt = Number(response.data.expires_at || 0);

        if (!this.accessToken || !this.userId) {
            throw new Error("Authentication response did not contain access_token and user_id.");
        }

        this.log.debug(`Authenticated as Tractive user ${this.userId}; token expires at ${this.expiresAt}.`);
    }

    private authHeaders(): Record<string, string> {
        return {
            "x-tractive-client": this.clientId,
            "x-tractive-user": this.userId,
            Authorization: `Bearer ${this.accessToken}`,
        };
    }

    private async apiGet<T>(url: string, retry = true): Promise<T> {
        try {
            const response = await this.http.get<T>(url, { headers: this.authHeaders() });
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
                const trackerId = String(tracker._id ?? "");
                if (!trackerId) {
                    this.log.warn("Received a tracker without _id; entry skipped.");
                    continue;
                }

                await this.ensureObject(trackerId, "device", String(tracker.name ?? trackerId));
                await this.writeRecord(`${trackerId}.summary`, tracker);

                const deviceData: Record<string, unknown> = {};
                await this.fetchSection(trackerId, "tracker", `/tracker/${trackerId}`, deviceData);
                await this.fetchSection(trackerId, "device_hw_report", `/device_hw_report/${trackerId}`, deviceData);
                await this.fetchSection(trackerId, "device_pos_report", `/device_pos_report/${trackerId}`, deviceData);
                (raw.devices as Record<string, unknown>)[trackerId] = deviceData;
            }

            await this.setStateAsync("rawJson", JSON.stringify(raw), true);
            await this.setStateAsync("info.lastUpdate", Date.now(), true);
            await this.setStateAsync("info.connection", true, true);
        } catch (error) {
            await this.setStateAsync("info.connection", false, true);
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

    private async writeRecord(baseId: string, record: ApiRecord): Promise<void> {
        await this.ensureObject(baseId, "channel", baseId.split(".").pop() ?? baseId);

        for (const [key, value] of Object.entries(record)) {
            if (key === "_id") {
                continue;
            }

            const id = `${baseId}.${this.sanitizeId(key)}`;
            const normalized = this.normalizeValue(value);
            await this.ensureState(id, key, normalized);
            await this.setStateAsync(id, { val: normalized.value, ack: true });
        }
    }

    private normalizeValue(value: unknown): { value: ioBroker.StateValue; type: ioBroker.CommonType; role: string } {
        if (value === null || value === undefined) {
            // API fields such as temperature_state can legitimately be null.
            // A nullable unknown field is represented as string until a concrete value arrives.
            return { value: null, type: "string", role: "state" };
        }
        if (typeof value === "boolean") {
            return { value, type: "boolean", role: "indicator" };
        }
        if (typeof value === "number") {
            return { value, type: "number", role: "value" };
        }
        if (typeof value === "string") {
            return { value, type: "string", role: "text" };
        }
        return { value: JSON.stringify(value), type: "string", role: "json" };
    }

    private async ensureState(
        id: string,
        name: string,
        normalized: { value: ioBroker.StateValue; type: ioBroker.CommonType; role: string },
    ): Promise<void> {
        const existing = await this.getObjectAsync(id);

        if (!existing) {
            await this.setObjectAsync(id, {
                type: "state",
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

        // If a field was initially null and later becomes a concrete type, update the generated object.
        if (existing.type === "state" && normalized.value !== null && existing.common.type !== normalized.type) {
            existing.common.type = normalized.type;
            existing.common.role = normalized.role;
            await this.setObjectAsync(id, existing);
            this.log.info(`Updated inferred type of ${id} to ${normalized.type}.`);
        }
    }

    private async ensureObject(id: string, type: "device" | "channel", name: string): Promise<void> {
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
        return value.replace(/[.\s]+/g, "_").replace(/[^A-Za-z0-9_-]/g, "");
    }

    private errorText(error: unknown): string {
        if (error instanceof AxiosError) {
            const status = error.response?.status;
            const data = error.response?.data;
            return `${error.message}${status ? ` (HTTP ${status})` : ""}${data ? `: ${JSON.stringify(data)}` : ""}`;
        }
        return error instanceof Error ? error.message : String(error);
    }

    private onUnload(callback: () => void): void {
        try {
            if (this.timer) {
                this.clearTimeout(this.timer);
            }
            void this.setStateAsync("info.connection", false, true).finally(callback);
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
