import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const favicon = fs.readFileSync(new URL('../assets/favicon.svg', import.meta.url), 'utf8');

test('the compact Blastline favicon is wired without replacing the main logo', () => {
  assert.match(html, /rel="icon" href="assets\/favicon\.svg"/);
  assert.match(html, /assets\/blastline\/branding\/logo-primary\.webp/);
  assert.doesNotMatch(html, /logo-primary\.svg|social-preview\.png/);
  assert.match(favicon, /gold B held by a red suspension bridge tower/);
  assert.match(favicon, /viewBox="0 0 64 64"/);
});
