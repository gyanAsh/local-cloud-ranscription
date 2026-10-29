import { defineConfig } from 'drizzle-kit';
console.log('DATABASE_URL seen by drizzle-kit:', process.env.DATABASE_URL); // 👈 add this

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

export default defineConfig({
	out: './drizzle',
	schema: './src/lib/server/db/schema.ts',
	dialect: 'postgresql',
	dbCredentials: { url: process.env.DATABASE_URL },
	verbose: true,
	strict: false
});
