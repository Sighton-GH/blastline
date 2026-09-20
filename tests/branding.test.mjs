import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const logo = fs.readFileSync(new URL('../assets/blastline/branding/logo-primary.svg', import.meta.url), 'utf8');
const mark = fs.readFileSync(new URL('../assets/blastline/branding/mark.svg', import.meta.url), 'utf8');
const preview = fs.statSync(new URL('../assets/blastline/branding/social-preview.png', import.meta.url));

test('brand identity is wired across header, favicon and share cards', () => {
  assert.match(html, /logo-primary\.svg/);
  assert.match(html, /rel="icon" href="assets\/favicon\.svg"/);
  assert.match(html, /og:image" content="https:\/\/blastline\.sighton\.ca\/assets\/blastline\/branding\/social-preview\.png"/);
  assert.match(html, /twitter:card" content="summary_large_image"/);
  assert.match(logo, /BLASTLINE/);
  assert.match(mark, /fortified bridge tower/i);
  assert.ok(preview.size > 20_000);
});
