import { AxiosError } from 'axios';

const SENSITIVE_KEY = /token|password|authorization|secret|platform_token|access_token|refresh_token/i;

function sanitizeData(data: unknown): unknown {
    if (data === null || data === undefined) {
        return data;
    }
    if (Array.isArray(data)) {
        return data.map((item) => sanitizeData(item));
    }
    if (typeof data !== 'object') {
        return data;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (SENSITIVE_KEY.test(key)) {
            result[key] = '[redacted]';
            continue;
        }
        result[key] = sanitizeData(value);
    }
    return result;
}

/** Safe, compact API error text for logs (no secrets). */
export function formatApiError(error: unknown): string {
    if (error instanceof AxiosError) {
        const status = error.response?.status;
        const raw = error.response?.data;
        let detail = '';

        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            const body = raw as Record<string, unknown>;
            const parts: string[] = [];
            if (typeof body.code === 'number' || typeof body.code === 'string') {
                parts.push(`code=${body.code}`);
            }
            if (typeof body.message === 'string') {
                parts.push(body.message);
            } else if (typeof body.error === 'string') {
                parts.push(body.error);
            } else if (typeof body.error_description === 'string') {
                parts.push(body.error_description);
            } else {
                parts.push(JSON.stringify(sanitizeData(body)));
            }
            detail = parts.join(' ');
        } else if (typeof raw === 'string' && raw.trim()) {
            detail = raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
        }

        return `${error.message}${status ? ` (HTTP ${status})` : ''}${detail ? `: ${detail}` : ''}`;
    }

    return error instanceof Error ? error.message : String(error);
}

export function getAxiosStatus(error: unknown): number | undefined {
    return error instanceof AxiosError ? error.response?.status : undefined;
}

export function getApiCode(error: unknown): number | undefined {
    if (!(error instanceof AxiosError) || !error.response?.data || typeof error.response.data !== 'object') {
        return undefined;
    }
    const code = (error.response.data as { code?: unknown }).code;
    return typeof code === 'number' ? code : undefined;
}
