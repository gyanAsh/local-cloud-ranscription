import type { Handle, HandleFetch } from '@sveltejs/kit';

import { setAuthCookies, verifyAccessToken, clearAuthCookies } from '$lib/server/functions/auth.js';
import { COOKIE_KEYS, type AccessTokenClaims, type RefreshResult } from '$lib/utils/constant.js';
import { sequence } from '@sveltejs/kit/hooks';
import { refreshSession } from '$lib/server/db/queries/auth.js';
/* ------------------------------------------------------------------ */
/* Config                                                             */
/* ------------------------------------------------------------------ */

const REFRESH_GRACE_MS = 10_000; // keep resolved refresh in map for late requests

/* ------------------------------------------------------------------ */
/* In-flight refresh deduplication                                    */
/* ------------------------------------------------------------------ */
/**
 * When many concurrent requests arrive with the same expired access token
 * + same refresh token, we want ONE refresh call, not N.
 *
 * Key = raw refresh token. Value = promise resolving to the new tokens.
 * The promise stays in the map for a short grace window after resolution
 * so that "late" requests still using the old cookie don't trigger a
 * second refresh (which would be flagged as refresh-token reuse).
 */
const inFlightRefreshes = new Map<string, Promise<RefreshResult>>();

/* ------------------------------------------------------------------ */
/* Refresh implementation                                             */
/* ------------------------------------------------------------------ */

function dedupedRefresh(rawRefreshToken: string): Promise<RefreshResult> {
	const existing = inFlightRefreshes.get(rawRefreshToken);
	if (existing) return existing;

	const promise = refreshSession(rawRefreshToken).finally(() => {
		// Keep in map briefly so requests still holding the OLD cookie
		// (that were sent before Set-Cookie landed) get the same result
		// instead of triggering reuse-detection.
		setTimeout(() => inFlightRefreshes.delete(rawRefreshToken), REFRESH_GRACE_MS);
	});

	inFlightRefreshes.set(rawRefreshToken, promise);
	return promise;
}

/* ------------------------------------------------------------------ */
/* handle                                                             */
/* ------------------------------------------------------------------ */
const session: Handle = async ({ event, resolve }) => {
	// Always start clean
	event.locals.user = null;
	event.locals.accessToken = null;

	let accessToken = event.cookies.get(COOKIE_KEYS.ACCESS_COOKIE) ?? null;
	const refreshToken = event.cookies.get(COOKIE_KEYS.REFRESH_COOKIE) ?? null;

	// 1) Try to verify the current access token (stateless — no DB hit)
	// verifyAccessToken returns null for expired/invalid tokens and only throws
	// on misconfiguration, which should surface instead of silently logging out.
	let payload: AccessTokenClaims | null = null;
	if (accessToken) {
		payload = await verifyAccessToken(accessToken);
	}

	// 2) If access token missing/expired, attempt a silent refresh
	if (!payload && refreshToken) {
		try {
			const result = await dedupedRefresh(refreshToken);

			if (result.ok) {
				accessToken = result.accessToken;
				payload = result.payload;

				setAuthCookies(event.cookies, {
					accessToken: result.accessToken,
					refreshToken: result.refreshToken
				});
			} else {
				// Definitive failure (expired/reused/unknown) — clear stale cookies
				// so we don't retry forever.
				clearAuthCookies(event.cookies);
				accessToken = null;
			}
		} catch (err) {
			// Transient failure (e.g. DB unavailable): keep the cookies so the
			// session can recover on the next request instead of forcing a re-login.
			console.error('Session refresh failed:', err);
			accessToken = null;
		}
	}

	// 3) Populate locals for downstream load functions / actions
	if (payload && payload.email && accessToken) {
		event.locals.user = { id: payload.sub, email: payload.email };
		event.locals.accessToken = accessToken;
	}

	return resolve(event);
};

export const handle = sequence(session);
/* ------------------------------------------------------------------ */
/* handleFetch — inject Authorization header on server-side fetches   */
/* ------------------------------------------------------------------ */
export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
	// Only attach the token to same-origin requests. handleFetch also intercepts
	// fetches to third-party APIs, and we must never leak the bearer token there.
	const token = event.locals.accessToken;
	if (token && new URL(request.url).origin === event.url.origin) {
		request.headers.set('Authorization', `Bearer ${token}`);
	}
	return fetch(request);
};
