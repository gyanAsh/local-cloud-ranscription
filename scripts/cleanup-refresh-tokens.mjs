#!/usr/bin/env node
/**
 * Deletes expired refresh-token rows so the table doesn't grow forever.
 *
 * Rows are kept for one extra day after expiry; revoked-but-unexpired rows are
 * intentionally left alone because refresh-token reuse detection relies on them.
 *
 * Usage:
 *   pnpm db:cleanup
 *
 * Cron (daily at 03:15, adjust path):
 *   15 3 * * * cd /srv/excelnow && node --env-file-if-exists=.env scripts/cleanup-refresh-tokens.mjs >> /var/log/excelnow-cleanup.log 2>&1
 *
 * The delete is batched to keep locks/transactions short on large tables.
 */
import postgres from 'postgres';

const BATCH_SIZE = 5_000;
const RETENTION = '1 day';

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('[cleanup] DATABASE_URL is not set');
	process.exit(1);
}

const sql = postgres(url, { max: 1, idle_timeout: 5 });

let total = 0;

try {
	for (;;) {
		const result = await sql`
			DELETE FROM refresh_tokens
			WHERE id IN (
				SELECT id
				FROM refresh_tokens
				WHERE expires_at < now() - ${RETENTION}::interval
				LIMIT ${BATCH_SIZE}
			)
		`;

		total += result.count;
		if (result.count < BATCH_SIZE) break;
	}

	console.log(`[cleanup] removed ${total} expired refresh token(s)`);
} catch (err) {
	console.error('[cleanup] failed:', err);
	process.exitCode = 1;
} finally {
	await sql.end({ timeout: 5 });
}
