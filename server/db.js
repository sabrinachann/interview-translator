// Server-side interview persistence — a Postgres database (Neon recommended,
// see README "Server-side interview storage"). The whole interview object is
// stored as JSONB so this stays a thin sync layer, not a second schema to keep
// in sync with the shape in src/lib/storage.js.
import pg from "pg";

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL;

export const dbEnabled = !!DATABASE_URL;

const pool = dbEnabled
  ? new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

export async function initDb() {
  if (!dbEnabled) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS interviews (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `);
}

export async function listInterviewsDb() {
  const { rows } = await pool.query("SELECT data FROM interviews ORDER BY updated_at DESC");
  return rows.map((r) => r.data);
}

export async function getInterviewDb(id) {
  const { rows } = await pool.query("SELECT data FROM interviews WHERE id = $1", [id]);
  return rows[0]?.data || null;
}

export async function saveInterviewDb(interview) {
  const updatedAt = interview.updatedAt || Date.now();
  await pool.query(
    `INSERT INTO interviews (id, data, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = $3`,
    [interview.id, interview, updatedAt]
  );
  return interview;
}

export async function deleteInterviewDb(id) {
  await pool.query("DELETE FROM interviews WHERE id = $1", [id]);
}

// Used by /api/health so the client can show an honest "backed up" vs
// "local only" status instead of silently assuming the database works.
export async function pingDb() {
  if (!dbEnabled) return false;
  await pool.query("SELECT 1");
  return true;
}
