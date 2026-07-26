import { getApiCode, getAxiosStatus } from './errors';

/** Endpoints that are unavailable for a tracker/subscription should not fail the whole poll. */
export function isMissingEndpointError(error: unknown): boolean {
    const status = getAxiosStatus(error);
    const apiCode = getApiCode(error);

    if (apiCode === 4002) {
        return true;
    }

    // 404: not found; 400: often "not supported"; 403 after auth retry: no permission for this resource
    return status === 404 || status === 400 || status === 403;
}

export function isTransientSectionError(error: unknown): boolean {
    const status = getAxiosStatus(error);
    return status === 408 || status === 429 || (typeof status === 'number' && status >= 500);
}
