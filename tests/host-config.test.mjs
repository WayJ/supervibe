import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readHostConfig } from '../scripts/host-config.mjs';
function fixture(t, body = '') {
  const root = mkdtempSync(join(tmpdir(), 'supervibe-config-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = text => writeFileSync(join(root, 'AGENTS.md'), text);
  put('## supervibe\n' + body); return { root, put };
}
test('defaults are paths/WIP only; gates retain command order and bytes', t => {
  const f = fixture(t, '- collaboration_mode: native <!-- proposal -->\n### gates\n- b: printf "<!-- exact -->"  \n- a: node --test\n');
  const c = readHostConfig(f.root);
  assert.equal(c.wip_limit, 3); assert.equal(c.collaboration_mode, 'native');
  assert.equal(c.collaboration_provider, undefined); assert.equal(c.maxWorkers, undefined);
  assert.deepEqual(c.gates, [{ name: 'b', command: 'printf "<!-- exact -->"  ' }, { name: 'a', command: 'node --test' }]);
});
test('section, keys, gates, directory requirements and maps fail closed', t => {
  const f = fixture(t);
  for (const body of ['## other\n', '## supervibe\n## supervibe\n', '## supervibe\n- strange: x\n', '## supervibe\n- wip_limit: 0\n', '## supervibe\n- wip_limit: 1\n- wip_limit: 2\n', '## supervibe\n### gates\n- a: \n', '## supervibe\n### gates\n- a: true\n- a: true\n', '## supervibe\n### doc_sync_map\n| change | owes |\n|---|---|\n| `src/**` | matching documentation |\n']) {
    f.put(body); assert.throws(() => readHostConfig(f.root), body);
  }
  f.put('## supervibe\n');
  assert.throws(() => readHostConfig(f.root, { requireDirs: ['typo'] }), /Unknown required/);
  assert.throws(() => readHostConfig(f.root, { requireDirs: ['notes'] }), /Missing configured/);
  mkdirSync(join(f.root, '.agents/notes'), { recursive: true });
  assert.equal(readHostConfig(f.root, { requireDirs: ['notes'] }).notes, '.agents/notes/');
});
test('contained paths reject traversal, metadata and symlinks even for missing leaves', t => {
  const f = fixture(t); symlinkSync(tmpdir(), join(f.root, 'escape'));
  for (const value of ['../outside', '/tmp', '.git/state', 'a/../../b', 'escape/new', 'escape', 'a\\b', '<placeholder>']) {
    f.put('## supervibe\n- notes: ' + value + '\n'); assert.throws(() => readHostConfig(f.root), value);
  }
});
test('machine-readable map parsed without natural language guessing', t => {
  const f = fixture(t, '### doc_sync_map\n| change | owes |\n|---|---|\n| `skills/**/SKILL.md` | `{dir}/SKILL.zh.md` |\n| `specs/**` | `{epic}` |\n');
  assert.deepEqual(readHostConfig(f.root).doc_sync_map, [{ change: 'skills/**/SKILL.md', owes: '{dir}/SKILL.zh.md' }, { change: 'specs/**', owes: '{epic}' }]);
});
test('fenced examples never become live sections or duplicate real configuration', t => {
  const f = fixture(t);
  for (const marker of ['```', '~~~', '````', '~~~~']) {
    const example = `Example only:\n${marker}md\n## supervibe\n- wip_limit: 99\n## Another heading\n${marker}\n`;
    f.put(example); assert.throws(() => readHostConfig(f.root), /exactly one/);
    f.put(example + '## supervibe\n- wip_limit: 2\n');
    assert.equal(readHostConfig(f.root).wip_limit, 2);
    f.put('## supervibe\n- wip_limit: 3\n' + example.replace('Example only:\n', ''));
    assert.equal(readHostConfig(f.root).wip_limit, 3);
  }
});
test('fence closing marker and length must match; unclosed examples stay inert', t => {
  const f = fixture(t);
  for (const text of [
    '````md\n```\n## supervibe\n- wip_limit: 99\n',
    '~~~md\n```\n## supervibe\n- wip_limit: 99\n',
    '   ```md\n## supervibe\n- wip_limit: 99\n'
  ]) { f.put(text); assert.throws(() => readHostConfig(f.root), /exactly one/); }
  f.put('   ~~~md\n## supervibe\n- wip_limit: 99\n   ~~~~\n## supervibe\n- wip_limit: 4\n');
  assert.equal(readHostConfig(f.root).wip_limit, 4);
});
test('HTML-commented headings do not establish configuration authority', t => {
  const f = fixture(t);
  for (const prefix of ['<!--', 'Example only: <!--']) {
    const example = `${prefix}\n## supervibe\n- wip_limit: 99\n## Another heading\n-->\n`;
    f.put(example); assert.throws(() => readHostConfig(f.root), /exactly one/);
    f.put(example + '## supervibe\n- wip_limit: 5\n'); assert.equal(readHostConfig(f.root).wip_limit, 5);
  }
});
