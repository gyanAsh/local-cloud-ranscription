export const USER_AUTH_SOURCE = {
	password: 'password',
	google: 'google'
};
export const COOKIE_KEYS = {
	ACCESS_COOKIE: 'access_token',
	REFRESH_COOKIE: 'refresh_token'
};
export const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days sliding window
export const ACCESS_TTL_MS = 1000 * 60 * 15; // 15 mins — keep in sync with signAccessToken

export interface AccessTokenPayload {
	sub: string; // user id
	// add what you actually need, e.g.:
	email?: string;
	// role?: 'user' | 'admin';
	// orgId?: string;
}

// What verify returns: your payload + the standard claims jose guarantees.
export type AccessTokenClaims = AccessTokenPayload & {
	iat: number;
	exp: number;
	iss?: string;
	aud?: string | string[];
};
export type RefreshResult =
	| { ok: true; accessToken: string; refreshToken: string; payload: AccessTokenClaims }
	| { ok: false; reason: 'not_found' | 'expired' | 'reused' | 'no_user' };

export type CreateSessionInput = {
	userId: string;
	email: string;
	userAgent?: string | null;
	ip?: string | null;
};
export type SignUpInput = {
	name: string;
	email: string;
	password_hash: string;
	source: (typeof USER_AUTH_SOURCE)[keyof typeof USER_AUTH_SOURCE];
	userAgent?: string | null;
	ip?: string | null;
};

export type SessionTokens = {
	accessToken: string;
	refreshToken: string; // raw — caller writes it to a cookie
	refreshExpiresAt?: Date;
};
export type SignUpResult = {
	user: { id: string; email: string; name: string };
} & SessionTokens;
