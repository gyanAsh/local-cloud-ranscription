import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Guard: must have user AND a usable identity
	if (!locals.user || !locals.user.email || !locals.accessToken) throw redirect(303, '/sign-in');
	// Returned data is merged into `data` for every child route
	return {};
};
