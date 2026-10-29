import { signInSchema } from '$lib/validation-schemas/auth.js';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types.js';
import { getUserByEmail } from '$lib/server/db/queries/user.js';
import { DUMMY_PASSWORD_HASH, setAuthCookies, verifyPassword } from '$lib/server/functions/auth.js';
import { checkRateLimit, clientKey } from '$lib/server/functions/rate-limit.js';
import { createSession } from '$lib/server/db/queries/auth.js';

const SIGN_IN_LIMIT = 10;
const SIGN_IN_WINDOW_MS = 60_000;

// Single generic error for every failure mode — no user enumeration.
const GENERIC = { success: false, message: 'Invalid email or password.' } as const;

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const ip = clientKey(getClientAddress);
		const rate = checkRateLimit(`sign-in:${ip}`, SIGN_IN_LIMIT, SIGN_IN_WINDOW_MS);

		if (!rate.ok) {
			return fail(429, {
				success: false,
				message: `Too many attempts. Try again in ${Math.ceil(rate.retryAfterMs / 1000)}s.`
			});
		}

		const formData = await request.formData();
		const result = signInSchema.safeParse({
			email: formData.get('email'),
			password: formData.get('password')
		});
		if (!result.success) return fail(401, GENERIC);

		const user = await getUserByEmail({ email: result.data.email });

		// Always run the password hash — including when the account doesn't exist
		// — so response time doesn't reveal which emails are registered.
		if (!user || !user.password_hash) {
			await verifyPassword(result.data.password, DUMMY_PASSWORD_HASH);
			return fail(401, GENERIC);
		}

		const ok = await verifyPassword(result.data.password, user.password_hash);
		if (!ok) return fail(401, GENERIC);

		const { accessToken, refreshToken } = await createSession({
			userId: user.id,
			email: user.email,
			userAgent: request.headers.get('user-agent') ?? null,
			ip
		});

		setAuthCookies(cookies, { accessToken, refreshToken });
		throw redirect(303, '/dashboard');
	}
};
