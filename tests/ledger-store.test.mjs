import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncLedgerDirectory } from '../scripts/ledger-store.mjs';

function harness(platform, stage, code) {
  const calls = [];
  const error = Object.assign(new Error(code), { code });
  const operation = name => (...args) => {
    calls.push([name, ...args]);
    if (name === stage) throw error;
    return name === 'open' ? 42 : undefined;
  };
  return { calls, error, options: { platform, open: operation('open'), sync: operation('sync'), close: operation('close') } };
}

test('directory sync opens, flushes and closes its own directory descriptor', () => {
  const f = harness('win32');
  assert.equal(syncLedgerDirectory('ledger', f.options), true);
  assert.deepEqual(f.calls, [['open', 'ledger', 'r'], ['sync', 42], ['close', 42]]);
});

for (const [stage, codes] of [['open', ['EPERM', 'EISDIR']], ['sync', ['EPERM', 'EINVAL']]]) {
  for (const code of codes) test(`Windows unsupported directory ${stage}/${code} is tolerated, not POSIX`, () => {
    const windows = harness('win32', stage, code);
    assert.equal(syncLedgerDirectory('ledger', windows.options), false);
    assert.equal(windows.calls.filter(([name]) => name === 'close').length, stage === 'open' ? 0 : 1);
    for (const platform of ['linux', 'darwin']) {
      const posix = harness(platform, stage, code);
      assert.throws(() => syncLedgerDirectory('ledger', posix.options), error => error === posix.error);
    }
  });
}

for (const stage of ['open', 'sync', 'close']) {
  for (const code of ['EIO', 'ENOSPC', 'EACCES']) test(`Windows directory ${stage}/${code} remains fatal`, () => {
    const f = harness('win32', stage, code);
    assert.throws(() => syncLedgerDirectory('ledger', f.options), error => error === f.error);
    assert.equal(f.calls.filter(([name]) => name === 'close').length, stage === 'open' ? 0 : 1);
  });
}

test('close failures are not suppressed after an unsupported Windows directory sync', () => {
  const error = Object.assign(new Error('close failed'), { code: 'EIO' });
  assert.throws(() => syncLedgerDirectory('ledger', {
    platform: 'win32', open: () => 42,
    sync: () => { throw Object.assign(new Error('unsupported'), { code: 'EINVAL' }); },
    close: () => { throw error; },
  }), value => value === error);
});
