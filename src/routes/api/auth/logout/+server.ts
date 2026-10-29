import { db } from '$lib/server/db/index.js';
import { refresh_token_table } from '$lib/server/db/schema.js';
import { clearAuthCookies, hashToken } from '$lib/server/functions/auth.js';
import { COOKIE_KEYS } from '$lib/utils/constant.js';
import { json, type RequestHandler } from '@sveltejs/kit';
import { eq, and, isNull } from 'drizzle-orm';

export const POST: RequestHandler = async ({ cookies, url }) => {
	try {
		const rawToken = cookies.get(COOKIE_KEYS.REFRESH_COOKIE);

		// Support "logout everywhere" via ?all=true
		const logoutAll = url.searchParams.get('all') === 'true';

		if (rawToken) {
			const tokenHash = hashToken(rawToken);

			// 1. Find the current session row
			const [current] = await db
				.select({
					id: refresh_token_table.id,
					user_id: refresh_token_table.user_id,
					family_id: refresh_token_table.family_id
				})
				.from(refresh_token_table)
				.where(eq(refresh_token_table.token_hash, tokenHash))
				.limit(1);

			if (current) {
				const now = new Date();

				if (logoutAll) {
					// Revoke the entire family (all devices from same login chain)
					await db
						.update(refresh_token_table)
						.set({ revoked_at: now })
						.where(
							and(
								eq(refresh_token_table.family_id, current.family_id),
								isNull(refresh_token_table.revoked_at)
							)
						);
				} else {
					// Revoke only this session
					await db
						.update(refresh_token_table)
						.set({ revoked_at: now })
						.where(eq(refresh_token_table.id, current.id));
				}
			}
		}

		// 2. Clear cookies regardless — logout should always succeed client-side
		clearAuthCookies(cookies);

		return json({ success: true, message: 'User successfully logged out.' }, { status: 200 });
	} catch {
		return json({ success: false, message: 'Failed to logout user.' }, { status: 500 });
	}
};
