import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, lstatSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const site = resolve(root, 'site');
const html = readFileSync(resolve(site, 'index.html'), 'utf8');

test('Pages publishes only the reviewed static files, not repository runtime state', () => {
  assert.deepEqual(readdirSync(site).sort(), ['app.js', 'icon.svg', 'index.html', 'styles.css']);
  for (const name of readdirSync(site)) assert(lstatSync(resolve(site, name)).isFile());
  const workflow = readFileSync(resolve(root, '.github/workflows/pages.yml'), 'utf8');
  assert.match(workflow, /path: site\s/);
  assert.doesNotMatch(workflow, /path:\s*['"]?\.(?:['"]?\s|\/)/);
  assert.match(workflow, /needs: verify/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /node --test tests\/\*\.test\.mjs/);
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
