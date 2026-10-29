import {
	generateRefreshToken,
	hashToken,
	signAccessToken,
	verifyAccessToken
} from '$lib/server/functions/auth.js';
import {
	REFRESH_TTL_MS,
	type CreateSessionInput,
	type RefreshResult,
	type SessionTokens,
	type SignUpInput,
	type SignUpResult
} from '$lib/utils/constant.js';
import { and, eq, lt, sql } from 'drizzle-orm';
import { db } from '../index.ts';
import { refresh_token_table, users_table } from '../schema.ts';
import { randomUUID } from 'node:crypto';

type Rotation =
	| { ok: true; userId: string; email: string; refreshToken: string }
	| { ok: false; reason: 'not_found' | 'expired' | 'reused' | 'no_user' };

// refresh tokens are 32 random bytes → 43 base64url chars. Reject anything else
// before touching the DB, so junk/forged cookies can't generate query load.
const REFRESH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export async function refreshSession(rawRefreshToken: string): Promise<RefreshResult> {
	if (!REFRESH_TOKEN_PATTERN.test(rawRefreshToken)) return { ok: false, reason: 'not_found' };

	const tokenHash = hashToken(rawRefreshToken);

	// Keep the transaction short: the row lock and rotation live here, and JWT
	// signing happens after commit so the lock is never held during crypto work.
	const rotation = await db.transaction(async (tx): Promise<Rotation> => {
		// Join the user in the same locking read — one round trip instead of two.
		const rows = await tx.execute(sql`
      SELECT rt.id, rt.user_id, rt.family_id, rt.expires_at, rt.revoked_at, u.email
      FROM refresh_tokens rt
      JOIN users u ON u.id = rt.user_id
      WHERE rt.token_hash = ${tokenHash}
      FOR UPDATE OF rt
    `);

		const stored = rows[0] as
			| {
					id: string;
					user_id: string;
					family_id: string;
					expires_at: Date;
					revoked_at: Date | null;
					email: string;
			  }
			| undefined;

		if (!stored) return { ok: false, reason: 'not_found' };

		// Reuse detected: this token was already rotated (or explicitly revoked).
		// Nuke the whole family.
		if (stored.revoked_at) {
			await tx
				.update(refresh_token_table)
				.set({ revoked_at: new Date() })
				.where(eq(refresh_token_table.family_id, stored.family_id));
			return { ok: false, reason: 'reused' };
		}

		if (new Date(stored.expires_at).getTime() < Date.now()) {
			return { ok: false, reason: 'expired' };
		}

		// Rotate
		const newRawRefreshToken = generateRefreshToken();
		const newHash = hashToken(newRawRefreshToken);

		await tx
			.update(refresh_token_table)
			.set({ revoked_at: new Date(), replaced_by: newHash })
			.where(eq(refresh_token_table.id, stored.id));

		await tx.insert(refresh_token_table).values({
			token_hash: newHash,
			user_id: stored.user_id,
			family_id: stored.family_id, // ← SAME family
			expires_at: new Date(Date.now() + REFRESH_TTL_MS)
		});

		return {
			ok: true,
			userId: stored.user_id,
			email: stored.email,
			refreshToken: newRawRefreshToken
		};
	});

	if (!rotation.ok) return { ok: false, reason: rotation.reason };

	const accessToken = await signAccessToken({ sub: rotation.userId, email: rotation.email });
	const payload = await verifyAccessToken(accessToken);
	if (!payload) return { ok: false, reason: 'no_user' };

	return { ok: true, accessToken, refreshToken: rotation.refreshToken, payload };
}

export async function createSession(input: CreateSessionInput): Promise<SessionTokens> {
	const rawRefresh = generateRefreshToken();
	const tokenHash = hashToken(rawRefresh);
	const familyId = randomUUID(); // ← new family per login
	const now = new Date();
	const expiresAt = new Date(now.getTime() + REFRESH_TTL_MS);

	await db.transaction(async (tx) => {
		// Housekeeping: drop this user's expired tokens so the table doesn't grow
		// forever. Indexed by user_id, so it stays cheap even on large tables.
		await tx
			.delete(refresh_token_table)
			.where(
				and(eq(refresh_token_table.user_id, input.userId), lt(refresh_token_table.expires_at, now))
			);

		await tx.insert(refresh_token_table).values({
			token_hash: tokenHash,
			user_id: input.userId,
			family_id: familyId,
			expires_at: expiresAt,
			user_agent: input.userAgent ?? null,
			ip: input.ip ?? null
			// created_at defaults to now()
			// revoked_at stays null
		});
	});

	const accessToken = await signAccessToken({
		sub: input.userId,
		email: input.email
	});

	return { accessToken, refreshToken: rawRefresh };
}

export async function signUpWithSession(input: SignUpInput): Promise<SignUpResult> {
	const { user, refreshToken } = await db.transaction(async (tx) => {
		// 1) create user
		const [newUser] = await tx
			.insert(users_table)
			.values({
				id: randomUUID(),
				name: input.name,
				email: input.email,
				email_verified: false,
				source: input.source,
				password_hash: input.password_hash
			})
			.returning();

		// 2) create session row (new family per signup)
		const newRawRefreshToken = generateRefreshToken();
		const newHash = hashToken(newRawRefreshToken);

		await tx.insert(refresh_token_table).values({
			token_hash: newHash,
			user_id: newUser.id,
			family_id: randomUUID(),
			expires_at: new Date(Date.now() + REFRESH_TTL_MS),
			user_agent: input.userAgent ?? null,
			ip: input.ip ?? null
			// created_at defaults to now()
			// revoked_at stays null
		});

		return { user: newUser, refreshToken: newRawRefreshToken };
	});

	// 3) sign access token after the transaction commits
	const accessToken = await signAccessToken({
		sub: user.id,
		email: user.email
	});

	return {
		user: { id: user.id, email: user.email, name: user.name },
		accessToken,
		refreshToken
	};
}
