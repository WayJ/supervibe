import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, lstatSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const site = resolve(root, 'site');
const html = readFileSync(resolve(site, 'index.html'), 'utf8');

test('Branch Pages publishes only reviewed root copies, not repository runtime state', () => {
  const publicFiles = ['app.js', 'icon.svg', 'index.html', 'styles.css'];
  assert.deepEqual(readdirSync(site).sort(), publicFiles);
  for (const name of publicFiles) {
    assert(lstatSync(resolve(site, name)).isFile());
    assert(lstatSync(resolve(root, name)).isFile(), 'Root publication must not use symlinks');
    assert.deepEqual(readFileSync(resolve(root, name)), readFileSync(resolve(site, name)), name + ' root copy drifted');
  }
  assert(!existsSync(resolve(root, '.nojekyll')), '.nojekyll bypasses the publication exclusions');
  const config = readFileSync(resolve(root, '_config.yml'), 'utf8');
  assert.match(config, /^theme: null$/m);
  assert.match(config, /^plugins: \[\]$/m);
  assert.match(config, /^exclude:$/m);
  assert.doesNotMatch(config, /^include:/m, 'Do not override publication exclusions');
  const excluded = [...config.matchAll(/^  - ([A-Za-z0-9_.-]+)$/gm)].map(m => m[1]);
  assert.equal(new Set(excluded).size, excluded.length);
  for (const name of readdirSync(root)) {
    if (publicFiles.includes(name)) assert(!excluded.includes(name), name + ' must be published');
    else assert(excluded.includes(name), name + ' must be explicitly excluded from Pages');
  }
  const workflow = readFileSync(resolve(root, '.github/workflows/pages.yml'), 'utf8');
  assert.match(workflow, /  verify:/);
  assert.match(workflow, /node tests\/check-artifacts\.mjs/);
  assert.match(workflow, /os: \[ubuntu-latest, windows-latest\]/);
  assert.match(workflow, /runs-on: \$\{\{ matrix\.os \}\}/);
  assert.match(workflow, /fail-fast: false/);
  assert.match(workflow, /^        run: node --test\s*$/m, 'Use Node discovery rather than shell glob expansion');
  assert.doesNotMatch(workflow, /actions\/(?:configure-pages|upload-pages-artifact|deploy-pages)@/);
  assert.doesNotMatch(workflow, /pages: write|id-token: write|  deploy:/);
});

test('Static anchors, local assets and repository documentation links resolve', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML id');
  for (const [, value] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    if (value === '#') continue;
    if (value.startsWith('#')) { assert(ids.includes(value.slice(1)), value); continue; }
    if (/^https:/.test(value)) {
      const match = value.match(/^https:\/\/github\.com\/WayJ\/supervibe\/blob\/main\/([^#?]+)/);
      if (match) assert(existsSync(resolve(root, decodeURIComponent(match[1]))), value);
      continue;
    }
    assert(!/^[a-z]+:/i.test(value) && !value.startsWith('/'), 'Unsafe or root-relative asset: ' + value);
    const path = resolve(site, value.split(/[?#]/)[0]);
    assert(path.startsWith(site + '/') && existsSync(path), value);
  }
});

test('Public page has basic mobile, accessibility and capability boundaries', () => {
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /name="viewport"/);
  assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1);
  assert.match(html, /href="#main"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /未.*(?:验证|联调)|尚未/);
  assert.doesNotMatch(html, /<(?:iframe|form)\b/i);
  assert.doesNotMatch(html, /<script[^>]+src="https?:/i);
});

test('Install text matches the documented plugin lifecycle and JS parses', () => {
  const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
  for (const command of ['/plugin marketplace add WayJ/supervibe', '/plugin install supervibe@supervibe']) {
    assert(readme.includes(command)); assert(html.includes(command));
  }
  execFileSync(process.execPath, ['--check', resolve(site, 'app.js')]);
});
