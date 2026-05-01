# CerberusX

CerberusX is a static technical site for the Cerberus Protocol: a three-layer runtime authority concept for high-risk autonomous spacecraft systems.

The core idea is simple:

- Layer 1 proposes.
- Layer 2 challenges.
- Layer 3 enforces deterministic safety boundaries.

This repository is a public-facing research and simulation sketch, not certified flight software. Real aerospace deployment would require formal verification, hardware-in-the-loop testing, safety certification, independent review, and mission-specific engineering.

## Pages

- `index.html` - site entry point and architecture overview.
- `coding-cerberus.html` - implementation concept page with runtime loop, authority states, repository shape, research lineage, and a small failure-injection demo.
- `whitepaper.html` - executive-summary style whitepaper page with source-safe technical framing.

## Run Locally

No build step is required. Open `index.html` in a browser, or serve the folder with any static server.

Example:

```bash
python -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173/
```

## Research Posture

Safe claims:

- CerberusX is inspired by runtime assurance and layered safety architecture.
- The demo exercises authority handoff logic under injected failure conditions.
- Layer 3 is designed to be deterministic, traceable, and non-generative.

Avoided claims:

- Flight certification.
- Proof of spacecraft safety.
- NASA, ESA, SpaceX, AIAA, or other institutional endorsement.
