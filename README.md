# CerberusX

CerberusX is a Render-ready technical website and browser simulation for the Cerberus Protocol: a three-layer runtime authority concept for high-risk autonomous spacecraft systems.

The core idea is simple:

- Layer 1 proposes.
- Layer 2 challenges.
- Layer 3 enforces deterministic safety boundaries.

This repository is a public-facing research and simulation sketch, not certified flight software. Real aerospace deployment would require formal verification, hardware-in-the-loop testing, safety certification, independent review, and mission-specific engineering.

## Pages

- `index.html` — site entry point and architecture overview.
- `coding-cerberus.html` — implementation concept page with runtime loop, authority states, repository shape, research lineage, and failure injection demo.
- `whitepaper.html` — executive-summary style whitepaper page with source-safe technical framing.

## Render deployment

This repo includes `render.yaml` for Blueprint deployment.

1. In Render, choose **New +** → **Blueprint**.
2. Connect this GitHub repository.
3. Render will create:
   - a Node web service named `cerberusx`
   - a Postgres database named `cerberusx-db`
4. The service uses:
   - build command: `npm install && npm run build`
   - start command: `npm start`
   - health check: `/health`

Manual Web Service settings:

```bash
Build command: npm install && npm run build
Start command: npm start
```

Set these environment variables if not using the Blueprint:

```bash
NODE_ENV=production
HOST=0.0.0.0
DATABASE_URL=<your Render Postgres internal connection string>
```

`DATABASE_URL` is optional for basic page rendering. Without it, the app uses in-memory fallback storage for demo sessions and contact messages. With Postgres, `migrate.js` creates persistent `simulation_sessions` and `contact_messages` tables.

## Local development

```bash
npm install
npm run dev
```

Then open:

```text
http://127.0.0.1:3000/
```

Useful checks:

```bash
npm run build
npm run check
```

## API endpoints

- `GET /health` or `GET /healthz` — Render/service health check.
- `POST /api/simulation/start` — creates a simulation session.
- `POST /api/simulation/:sessionId/event` — appends a simulation event.
- `GET /api/simulation/:sessionId` — reads one session.
- `GET /api/simulations` — lists recent sessions.
- `POST /api/contact` — stores an educator/contact message.
- `GET /api/admin/stats` — aggregate run/message stats.
- `GET /api/admin/messages` — recent contact messages.

## Research posture

Safe claims:

- CerberusX is inspired by runtime assurance and layered safety architecture.
- The demo exercises authority handoff logic under injected failure conditions.
- Layer 3 is designed to be deterministic, traceable, and non-generative.

Avoided claims:

- Flight certification.
- Proof of spacecraft safety.
- NASA, ESA, SpaceX, AIAA, or other institutional endorsement.
