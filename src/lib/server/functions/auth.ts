import type { Cookies } from '@sveltejs/kit';
import {
	randomBytes,
	scrypt as _scrypt,
	timingSafeEqual,
	createHash,
	type ScryptOptions
} from 'node:crypto';
import { promisify } from 'node:util';
import { env } from '$env/dynamic/private';
import { jwtVerify, SignJWT, type JWTPayload } from 'jose';
import {
	ACCESS_TTL_MS,
	COOKIE_KEYS,
	REFRESH_TTL_MS,
	type AccessTokenClaims,
	type AccessTokenPayload
} from '$lib/utils/constant.js';

const scrypt = promisify(_scrypt) as (
	password: string | Buffer,
	salt: string | Buffer,
	keylen: number,
	options?: ScryptOptions
) => Promise<Buffer>;

interface Tokens {
	accessToken: string;
	refreshToken: string;
}

export function setAuthCookies(cookies: Cookies, { accessToken, refreshToken }: Tokens) {
	const base = {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production'
	} as const;
	cookies.set(COOKIE_KEYS.ACCESS_COOKIE, accessToken, { ...base, maxAge: ACCESS_TTL_MS / 1000 });
	cookies.set(COOKIE_KEYS.REFRESH_COOKIE, refreshToken, { ...base, maxAge: REFRESH_TTL_MS / 1000 });
}

export function clearAuthCookies(cookies: Cookies) {
	cookies.delete(COOKIE_KEYS.ACCESS_COOKIE, { path: '/' });
	cookies.delete(COOKIE_KEYS.REFRESH_COOKIE, { path: '/' });
}

const N = 131072,
	r = 8,
	p = 1;
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const MAXMEM = 256 * N * r;

const opts = { N, r, p, maxmem: MAXMEM };
/**
 * Returns `scrypt$<N>$<r>$<p>$<salt>$<key>`, safe to store in `users_table.password_hash`.
 * Parameters are embedded so they can be raised later without invalidating old hashes.
 */
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(SALT_LENGTH);
	const key = await scrypt(password, salt, KEY_LENGTH, opts);
	return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${key.toString('hex')}`;
}
/** Constant-time comparison, so the action never returns early on a bad password. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const parts = stored.split('$');
	if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

	const [, nStr, rStr, pStr, saltHex, keyHex] = parts;
	const storedKey = Buffer.from(keyHex, 'hex');

	try {
		const candidate = await scrypt(password, Buffer.from(saltHex, 'hex'), storedKey.length, {
			N: Number(nStr),
			r: Number(rStr),
			p: Number(pStr),
			maxmem: MAXMEM
		});
		if (candidate.length !== storedKey.length) return false;
		return timingSafeEqual(candidate, storedKey);
	} catch {
		return false;
	}
}

// Resolved once — the dynamic env object is cheap, but decoding/validating the
// key on every sign/verify call is wasted work on the hot request path.
let cachedAccessTokenKey: Buffer | null = null;
let cachedIssuer: string | null = null;
let cachedAudience: string | null = null;

function getAccessTokenSecret(): Buffer {
	if (cachedAccessTokenKey) return cachedAccessTokenKey;

	const secret = env.ACCESS_TOKEN_SECRET;
	if (!secret) throw new Error('ACCESS_TOKEN_SECRET is not set');

	// Expected to be base64 (``openssl rand -base64 32``).
	const key = Buffer.from(secret, 'base64');
	if (key.length < 32) {
		throw new Error('ACCESS_TOKEN_SECRET must decode from base64 to at least 32 bytes');
	}

	cachedAccessTokenKey = key;
	return key;
}
function getJWTIssSecret(): string {
	if (!cachedIssuer) {
		const secret = env.JWT_ISSUER;
		if (!secret) throw new Error('JWT_ISSUER is not set');
		cachedIssuer = secret;
	}
	return cachedIssuer;
}
function getJWTAudSecret(): string {
	if (!cachedAudience) {
		const secret = env.JWT_AUDIENCE;
		if (!secret) throw new Error('JWT_AUDIENCE is not set');
		cachedAudience = secret;
	}
	return cachedAudience;
}

/** Creates an HS256 JWT that expires after the given number of seconds. */
export async function signAccessToken(
	payload: AccessTokenPayload,
	expiresInSeconds = ACCESS_TTL_MS / 1000
): Promise<string> {
	return await new SignJWT(payload as JWTPayload)
		.setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
		.setIssuedAt()
		.setExpirationTime(`${expiresInSeconds}s`)
		.setIssuer(getJWTIssSecret())
		.setAudience(getJWTAudSecret())
		.sign(getAccessTokenSecret());
}

/** Verifies an HS256 JWT and returns its claims, or `null` if invalid or expired. */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
	// A misconfigured secret should surface loudly, not silently log every user out.
	const secret = getAccessTokenSecret();
	try {
		const { payload } = await jwtVerify(token, secret, {
			algorithms: ['HS256'],
			issuer: getJWTIssSecret(),
			audience: getJWTAudSecret(),
			clockTolerance: 30
		});
		return payload as AccessTokenClaims;
	} catch {
		return null;
	}
}

/**
 * Hash of a fixed throwaway password using the same scrypt params as real users.
 * Sign-in verifies against this when the account does not exist so both paths
 * do the same amount of work (no user enumeration via response timing).
 */
export const DUMMY_PASSWORD_HASH =
	'scrypt$131072$8$1$6d83911954c962ae515a04b9305b3bca$a08e688a1dad4d8fb1b5db012c59af7e719ff76ace210d695283b9f03f933b3bcf1bc5db305133ca7d5f5239194e5ca5c68c6b89069d333517a8adfbbcf1a529';

/** 256-bit opaque refresh token, URL-safe. */
export function generateRefreshToken(): string {
	return randomBytes(32).toString('base64url'); // 43 chars ✔
}

/** SHA-256 → base64url. */
export function hashToken(token: string): string {
	return createHash('sha256').update(token, 'utf8').digest('base64url');
}

/** Constant-time compare for base64url strings. */
export function safeEqual(a: string, b: string): boolean {
	const aBuf = Buffer.from(a, 'utf8');
	const bBuf = Buffer.from(b, 'utf8');
	if (aBuf.length !== bBuf.length) return false;
	return timingSafeEqual(aBuf, bBuf);
}
