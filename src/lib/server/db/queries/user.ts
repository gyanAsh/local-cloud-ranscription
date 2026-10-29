import { db } from '../index.ts';
import { eq } from 'drizzle-orm';

export const getUserByEmail = async ({ email }: { email: string }) => {
	return db.query.users_table.findFirst({
		where: (users) => eq(users.email, email)
	});
};
