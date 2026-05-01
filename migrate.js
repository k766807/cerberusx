import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.log('DATABASE_URL not set; skipping migrations. The app will use in-memory fallback storage.');
  process.exit(0);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  console.log('Running CerberusX migrations...');
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS simulation_sessions (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(64) NOT NULL UNIQUE,
        scenario VARCHAR(64) NOT NULL DEFAULT 'orbital_docking',
        status VARCHAR(32) NOT NULL DEFAULT 'running',
        active_layer INTEGER NOT NULL DEFAULT 1 CHECK (active_layer BETWEEN 1 AND 3),
        layers_failed INTEGER[] NOT NULL DEFAULT '{}',
        telemetry JSONB NOT NULL DEFAULT '{}'::jsonb,
        events JSONB NOT NULL DEFAULT '[]'::jsonb,
        outcome VARCHAR(64),
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS simulation_sessions_session_id_idx
      ON simulation_sessions (session_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS simulation_sessions_scenario_status_idx
      ON simulation_sessions (scenario, status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS simulation_sessions_created_at_idx
      ON simulation_sessions (created_at DESC)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255),
        institution VARCHAR(255),
        message TEXT NOT NULL,
        source VARCHAR(64) NOT NULL DEFAULT 'website',
        page VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx
      ON contact_messages (created_at DESC)
    `);

    await client.query(`
      INSERT INTO _migrations (name)
      VALUES ('0001_core_cerberusx_tables')
      ON CONFLICT (name) DO NOTHING
    `);

    console.log('CerberusX migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});
