import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  'index.html',
  'coding-cerberus.html',
  'whitepaper.html',
  'server.js',
  'migrate.js',
  'render.yaml',
  'package.json'
];

for (const file of requiredFiles) {
  await access(file);
}

const files = Object.fromEntries(
  await Promise.all(requiredFiles.map(async (file) => [file, await readFile(file, 'utf8')]))
);

const checks = [
  [files['package.json'].includes('"start": "node server.js"'), 'package.json has Render start script'],
  [files['package.json'].includes('"build": "node scripts/build-check.js"'), 'package.json has safe build script'],
  [files['server.js'].includes("HOST || '0.0.0.0'"), 'server binds to 0.0.0.0 by default'],
  [files['server.js'].includes('/api/simulation/start'), 'server exposes simulation API'],
  [files['server.js'].includes('/api/contact'), 'server exposes contact API'],
  [files['migrate.js'].includes('CREATE TABLE IF NOT EXISTS simulation_sessions'), 'migration creates simulation_sessions'],
  [files['migrate.js'].includes('CREATE TABLE IF NOT EXISTS contact_messages'), 'migration creates contact_messages'],
  [files['render.yaml'].includes('healthCheckPath: /health'), 'Render health check is configured'],
  [files['index.html'].includes('coding-cerberus.html'), 'index links to coding-cerberus.html'],
  [files['index.html'].includes('whitepaper.html'), 'index links to whitepaper.html'],
  [files['coding-cerberus.html'].includes('Failure Injection'), 'coding page includes failure injection demo'],
  [files['whitepaper.html'].includes('References'), 'whitepaper includes references section']
];

const failed = checks.filter(([pass]) => !pass);

if (failed.length > 0) {
  for (const [, label] of failed) console.error(`Build check failed: ${label}`);
  process.exit(1);
}

console.log('CerberusX build check passed.');
