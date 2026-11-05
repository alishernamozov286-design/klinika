/**
 * Last-resort 2FA reset from the server console, for when the only super
 * administrator has lost both the phone and the recovery codes.
 *
 *   npm run mfa:reset -- <login>
 *
 * Everyone else is reset from Xodimlar → "2FA ni o'chirish". Without a
 * database, remove the user's entry from "userMfa" in .data/db.json instead.
 */
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env — nothing to load
}

const username = process.argv[2]?.trim();
if (!username) {
  console.error("Foydalanish: npm run mfa:reset -- <login>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL topilmadi. JSON rejimida .data/db.json dagi \"userMfa\" yozuvini o'chiring.");
  process.exit(1);
}

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const { rows } = await pool.query(
  `DELETE FROM user_mfa m USING users u
    WHERE m.user_id = u.id AND lower(u.username) = lower($1)
    RETURNING u.full_name`,
  [username],
);
if (rows.length === 0) {
  console.log(`@${username}: ikki bosqichli kirish yoqilmagan yoki bunday login yo'q.`);
} else {
  await pool.query(
    `INSERT INTO audit_log (action, entity, entity_id, summary, user_name)
     SELECT 'update', 'user', id, $2, 'Konsol' FROM users WHERE lower(username) = lower($1)`,
    [username, `${rows[0].full_name} — ikki bosqichli kirish konsoldan o'chirildi`],
  ).catch((err) => console.warn("Audit yozilmadi:", err.message));
  console.log(`@${username} (${rows[0].full_name}): ikki bosqichli kirish o'chirildi.`);
}
await pool.end();
