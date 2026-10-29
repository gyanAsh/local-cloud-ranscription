import { userCredSchema } from '$lib/validation-schemas/auth.js';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types.js';
import { getUserByEmail } from '$lib/server/db/queries/user.js';
import { hashPassword, setAuthCookies } from '$lib/server/functions/auth.js';
import { checkRateLimit, clientKey } from '$lib/server/functions/rate-limit.js';
import { signUpWithSession } from '$lib/server/db/queries/auth.js';
import { USER_AUTH_SOURCE, type SessionTokens } from '$lib/utils/constant.js';

const SIGN_UP_LIMIT = 5;
const SIGN_UP_WINDOW_MS = 10 * 60_000;

/** Postgres unique_violation — the email was taken between check and insert. */
function isUniqueViolation(err: unknown): boolean {
	return (
		typeof err === 'object' &&
		err !== null &&
		'code' in err &&
		(err as { code?: unknown }).code === '23505'
	);
}

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const ip = clientKey(getClientAddress);
		const rate = checkRateLimit(`sign-up:${ip}`, SIGN_UP_LIMIT, SIGN_UP_WINDOW_MS);

		if (!rate.ok) {
			return fail(429, {
				success: false,
				message: `Too many attempts. Try again in ${Math.ceil(rate.retryAfterMs / 1000)}s.`
			});
		}

		const formData = await request.formData();
		const result = userCredSchema.safeParse({
			name: formData.get('name'),
			email: formData.get('email'),
			password: formData.get('password')
		});

		if (!result.success) {
			return fail(401, { success: false, message: 'Invalid name, email or password.' });
		}

		// Fast pre-check for nicer UX. NOT authoritative — see the catch block.
		const existing = await getUserByEmail({ email: result.data.email });
		if (existing?.email) {
			return fail(409, { success: false, message: 'Email already in use.' });
		}

		const hashedPassword = await hashPassword(result.data.password);

		let session: SessionTokens;
		try {
			session = await signUpWithSession({
				name: result.data.name,
				email: result.data.email,
				password_hash: hashedPassword,
				source: USER_AUTH_SOURCE.password,
				userAgent: request.headers.get('user-agent') ?? null,
				ip
			});
		} catch (err) {
			if (isUniqueViolation(err)) {
				return fail(409, { success: false, message: 'Email already in use.' });
			}

			console.error('Sign-up failed:', err);
			return fail(500, {
				success: false,
				message: 'Something went wrong. Try again after some time.'
			});
		}

		setAuthCookies(cookies, {
			accessToken: session.accessToken,
			refreshToken: session.refreshToken
		});

		throw redirect(303, '/dashboard');
	}
};
