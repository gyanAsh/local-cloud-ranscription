import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users_table } from './user.ts';

export const refresh_token_table = pgTable(
	'refresh_tokens',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		token_hash: text('token_hash').notNull().unique(),
		user_id: text('user_id')
			.notNull()
			.references(() => users_table.id, { onDelete: 'cascade' }),
		family_id: uuid('family_id').notNull(),
		created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		expires_at: timestamp('expires_at', { withTimezone: true }).notNull().defaultNow(),
		revoked_at: timestamp('revoked_at', { withTimezone: true }),
		replaced_by: text('replaced_by'),
		user_agent: text('user_agent'),
		ip: text('ip')
	},
	(t) => [
		index('idx_refresh_user').on(t.user_id),
		index('idx_refresh_family').on(t.family_id),
		index('idx_refresh_expires').on(t.expires_at)
	]
);

export type typeof_refresh_token_table = typeof refresh_token_table.$inferInsert;
