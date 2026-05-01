import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';

const app = Fastify({ logger: true });

await app.register(fastifyStatic, {
  root: __dirname,
  prefix: '/',
  index: ['index.html'],
  decorateReply: false,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
});

app.get('/healthz', async () => ({ ok: true, service: 'cerberusx' }));

app.setNotFoundHandler((request, reply) => {
  const requestedPath = request.url.split('?')[0];

  if (requestedPath === '/coding-cerberus' || requestedPath === '/coding-cerberus/') {
    return reply.sendFile('coding-cerberus.html');
  }

  if (requestedPath === '/whitepaper' || requestedPath === '/whitepaper/') {
    return reply.sendFile('whitepaper.html');
  }

  if (requestedPath.endsWith('/')) {
    return reply.sendFile('index.html');
  }

  return reply.code(404).type('text/html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page not found | CerberusX</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#03040a;color:#eff4ff;font-family:Inter,system-ui,sans-serif;line-height:1.6;padding:24px}
    main{max-width:620px;border:1px solid rgba(255,255,255,.12);background:rgba(10,13,28,.78);padding:32px;border-radius:10px}
    a{color:#00e5ff}
    code{color:#ffbf38}
  </style>
</head>
<body>
  <main>
    <p><code>404</code></p>
    <h1>That CerberusX page is not in this node.</h1>
    <p>Try <a href="/">Home</a>, <a href="/coding-cerberus.html">Coding Cerberus</a>, or <a href="/whitepaper.html">Whitepaper</a>.</p>
  </main>
</body>
</html>`);
});

try {
  await app.listen({ port: PORT, host: HOST });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
