import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const hasDatabase = Boolean(process.env.DATABASE_URL);
const pool = hasDatabase ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;

const app = express();
const memory = {
  sessions: new Map(),
  messages: []
};

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.static(__dirname, {
  extensions: ['html'],
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

function nowIso() {
  return new Date().toISOString();
}

function createSessionRecord(scenario = 'orbital_docking') {
  const created = nowIso();
  return {
    session_id: crypto.randomUUID(),
    scenario,
    status: 'running',
    active_layer: 1,
    layers_failed: [],
    telemetry: {},
    events: [{ type: 'session_started', data: { scenario }, at: created }],
    outcome: null,
    started_at: created,
    completed_at: null,
    created_at: created,
    updated_at: created
  };
}

async function query(text, params = []) {
  if (!pool) return null;
  return pool.query(text, params);
}

app.get(['/health', '/healthz'], async (req, res) => {
  let database = 'memory';
  if (pool) {
    try {
      await pool.query('SELECT 1');
      database = 'connected';
    } catch {
      database = 'unavailable';
    }
  }
  res.json({ ok: true, service: 'cerberusx', database });
});

app.post('/api/simulation/start', async (req, res) => {
  const scenario = String(req.body?.scenario || 'orbital_docking').slice(0, 64);
  const session = createSessionRecord(scenario);

  try {
    if (pool) {
      await query(
        `INSERT INTO simulation_sessions
          (session_id, scenario, status, active_layer, layers_failed, telemetry, events, outcome)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [session.session_id, session.scenario, session.status, session.active_layer, session.layers_failed, session.telemetry, session.events, session.outcome]
      );
    } else {
      memory.sessions.set(session.session_id, session);
    }
    res.json({ success: true, session });
  } catch (error) {
    console.error('simulation start failed', error);
    memory.sessions.set(session.session_id, session);
    res.json({ success: true, session, storage: 'memory-fallback' });
  }
});

app.post('/api/simulation/:sessionId/event', async (req, res) => {
  const sessionId = req.params.sessionId;
  const event = {
    type: String(req.body?.event_type || 'event').slice(0, 80),
    data: req.body?.data || {},
    at: nowIso()
  };

  try {
    if (pool) {
      const result = await query(
        `UPDATE simulation_sessions
         SET events = events || $2::jsonb,
             telemetry = COALESCE($3::jsonb, telemetry),
             active_layer = COALESCE($4, active_layer),
             layers_failed = COALESCE($5, layers_failed),
             outcome = COALESCE($6, outcome),
             status = CASE WHEN $6::text IS NULL THEN status ELSE 'complete' END,
             completed_at = CASE WHEN $6::text IS NULL THEN completed_at ELSE NOW() END,
             updated_at = NOW()
         WHERE session_id = $1
         RETURNING *`,
        [
          sessionId,
          JSON.stringify([event]),
          req.body?.telemetry ? JSON.stringify(req.body.telemetry) : null,
          Number.isInteger(req.body?.active_layer) ? req.body.active_layer : null,
          Array.isArray(req.body?.layers_failed) ? req.body.layers_failed : null,
          req.body?.outcome || null
        ]
      );
      return res.json({ success: true, session: result.rows[0] || null, event });
    }

    const session = memory.sessions.get(sessionId);
    if (!session) return res.status(404).json({ success: false, error: 'session not found' });
    session.events.push(event);
    if (req.body?.telemetry) session.telemetry = req.body.telemetry;
    if (Number.isInteger(req.body?.active_layer)) session.active_layer = req.body.active_layer;
    if (Array.isArray(req.body?.layers_failed)) session.layers_failed = req.body.layers_failed;
    if (req.body?.outcome) {
      session.outcome = req.body.outcome;
      session.status = 'complete';
      session.completed_at = nowIso();
    }
    session.updated_at = nowIso();
    res.json({ success: true, session, event });
  } catch (error) {
    console.error('simulation event failed', error);
    res.status(500).json({ success: false, error: 'unable to record simulation event' });
  }
});

app.get('/api/simulation/:sessionId', async (req, res) => {
  try {
    if (pool) {
      const result = await query('SELECT * FROM simulation_sessions WHERE session_id = $1', [req.params.sessionId]);
      return result.rows[0] ? res.json({ session: result.rows[0] }) : res.status(404).json({ error: 'session not found' });
    }
    const session = memory.sessions.get(req.params.sessionId);
    return session ? res.json({ session }) : res.status(404).json({ error: 'session not found' });
  } catch (error) {
    res.status(500).json({ error: 'unable to load session' });
  }
});

app.get('/api/simulations', async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 25), 100);
  try {
    if (pool) {
      const result = await query(
        `SELECT session_id, scenario, status, active_layer, layers_failed, outcome, started_at, completed_at, created_at
         FROM simulation_sessions
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );
      return res.json({ sessions: result.rows });
    }
    const sessions = [...memory.sessions.values()].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, limit);
    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: 'unable to load simulations' });
  }
});

app.post('/api/contact', async (req, res) => {
  const message = String(req.body?.message || '').trim();
  if (!message) return res.status(400).json({ success: false, error: 'message is required' });

  const contact = {
    name: String(req.body?.name || '').slice(0, 255),
    email: String(req.body?.email || '').slice(0, 255),
    institution: String(req.body?.institution || '').slice(0, 255),
    message: message.slice(0, 5000),
    source: String(req.body?.source || 'website').slice(0, 64),
    page: String(req.body?.page || req.get('referer') || '').slice(0, 255),
    created_at: nowIso()
  };

  try {
    if (pool) {
      const result = await query(
        `INSERT INTO contact_messages (name, email, institution, message, source, page)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, created_at`,
        [contact.name, contact.email, contact.institution, contact.message, contact.source, contact.page]
      );
      return res.json({ success: true, message: 'received', id: result.rows[0]?.id, created_at: result.rows[0]?.created_at });
    }
    contact.id = memory.messages.length + 1;
    memory.messages.unshift(contact);
    res.json({ success: true, message: 'received', id: contact.id, storage: 'memory' });
  } catch (error) {
    console.error('contact failed', error);
    res.status(500).json({ success: false, error: 'unable to record message' });
  }
});

app.get('/api/admin/messages', async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 25), 100);
  try {
    if (pool) {
      const result = await query(
        `SELECT id, name, email, institution, message, source, page, created_at
         FROM contact_messages
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );
      return res.json({ messages: result.rows });
    }
    res.json({ messages: memory.messages.slice(0, limit) });
  } catch (error) {
    res.status(500).json({ error: 'unable to load messages' });
  }
});

app.get('/api/admin/stats', async (req, res) => {
  try {
    if (pool) {
      const total = await query('SELECT COUNT(*)::int AS total_runs FROM simulation_sessions');
      const byScenario = await query(
        `SELECT scenario, COUNT(*)::int AS runs, COUNT(*) FILTER (WHERE outcome IS NOT NULL)::int AS completed
         FROM simulation_sessions GROUP BY scenario ORDER BY runs DESC`
      );
      const messages = await query('SELECT COUNT(*)::int AS total_messages FROM contact_messages');
      return res.json({ total_runs: total.rows[0]?.total_runs || 0, total_messages: messages.rows[0]?.total_messages || 0, by_scenario: byScenario.rows });
    }
    const sessions = [...memory.sessions.values()];
    const byScenario = Object.values(sessions.reduce((acc, s) => {
      acc[s.scenario] ||= { scenario: s.scenario, runs: 0, completed: 0 };
      acc[s.scenario].runs += 1;
      if (s.outcome) acc[s.scenario].completed += 1;
      return acc;
    }, {}));
    res.json({ total_runs: sessions.length, total_messages: memory.messages.length, by_scenario: byScenario });
  } catch (error) {
    res.status(500).json({ error: 'unable to load stats' });
  }
});

app.get('/coding-cerberus', (req, res) => res.sendFile(path.join(__dirname, 'coding-cerberus.html')));
app.get('/whitepaper', (req, res) => res.sendFile(path.join(__dirname, 'whitepaper.html')));

app.use((req, res) => {
  res.status(404).type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404 | CerberusX</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#03040a;color:#eff4ff;font-family:Inter,system-ui,sans-serif;padding:24px}main{max-width:620px;border:1px solid rgba(255,255,255,.12);background:rgba(10,13,28,.78);padding:32px;border-radius:12px}a{color:#00e5ff}code{color:#ffbf38}</style></head><body><main><p><code>404</code></p><h1>That CerberusX page is not in this node.</h1><p>Try <a href="/">Home</a>, <a href="/coding-cerberus.html">Coding Cerberus</a>, or <a href="/whitepaper.html">Whitepaper</a>.</p></main></body></html>`);
});

app.listen(PORT, HOST, () => {
  console.log(`CerberusX listening on http://${HOST}:${PORT}`);
});
