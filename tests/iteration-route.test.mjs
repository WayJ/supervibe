import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { routeIteration } from '../scripts/iteration-route.mjs';
const cli = fileURLToPath(new URL('../scripts/iteration-route.mjs', import.meta.url));

test('default iteration requires a coordinator and workers; one worker is not solo', () => {
  assert.deepEqual(routeIteration(), { execution: 'iteration', target: 'supervibe', activateIteration: true, coordinator: true, requireWorkers: true });
  assert.equal(routeIteration({ maxWorkers: 1 }).activateIteration, true);
  assert.equal(routeIteration({ execution: 'solo' }).allowSubagents, false);
  assert.throws(() => routeIteration({ execution: 'unavailable-native' }));
  assert.throws(() => routeIteration(null));
});

for (const existing of [false, true]) test(`solo routing leaves repository and ${existing ? 'existing' : 'absent'} ledger unchanged`, () => {
  const dir = mkdtempSync(join(tmpdir(), 'supervibe-route-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir });
    execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: dir });
    const stateDir = join(dir, '.git', 'supervibe');
    const state = join(stateDir, 'state.json');
    const original = '{"revision":12,"sentinel":"must not change"}\n';
    if (existing) { mkdirSync(stateDir); writeFileSync(state, original); }
    const before = readdirSync(dir).sort();
    const output = JSON.parse(execFileSync(process.execPath, [cli], { cwd: dir, input: '{"execution":"solo"}', encoding: 'utf8' }));
    assert.equal(output.target, 'superpowers');
    assert.equal(output.activateIteration, false);
    assert.deepEqual(readdirSync(dir).sort(), before);
    assert.equal(existsSync(state), existing);
    if (existing) assert.equal(readFileSync(state, 'utf8'), original);
    assert.equal(existsSync(join(dir, 'docs')), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
