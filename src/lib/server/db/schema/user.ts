import { boolean, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const users_table = pgTable('users', {
	id: text().primaryKey().notNull(),
	email: varchar({ length: 255 }).unique().notNull(),
	email_verified: boolean().notNull().default(false),
	name: varchar({ length: 255 }).notNull(),
	source: varchar({ length: 255 }).notNull(),
	provider_id: varchar('provider_id', { length: 255 }),
	picture: text(),
	password_hash: varchar({ length: 255 }),
	roles: text('roles')
		.array()
		.notNull()
		.$defaultFn(() => ['user']),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', {
		withTimezone: true
	})
		.notNull()
		.defaultNow()
});

export type typeof_user_table = typeof users_table.$inferInsert;
