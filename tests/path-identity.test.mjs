import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizePathIdentity, samePath, resolvedPath } from '../scripts/path-identity.mjs';

test('Windows identities normalize separators, drive and component case, UNC and namespace aliases', () => {
  for (const alias of ['C:/Carriers/S1', 'c:\\carriers\\s1\\', '\\\\?\\C:\\CARRIERS\\S1', 'C:\\carriers\\child\\..\\s1']) {
    assert.equal(normalizePathIdentity(alias,'win32'),'c:/carriers/s1');
  }
  for (const alias of ['\\\\Server\\Share\\S1', '//server/share/s1/', '\\\\?\\UNC\\SERVER\\SHARE\\S1']) {
    assert.equal(normalizePathIdentity(alias,'win32'),'//server/share/s1');
  }
  assert.notEqual(normalizePathIdentity('C:/carrier/s1','win32'), normalizePathIdentity('D:/carrier/s1','win32'));
  assert.notEqual(normalizePathIdentity('C:/carrier/s1','win32'), normalizePathIdentity('C:/carrier/s10','win32'));
});
test('POSIX identities preserve case and literal backslashes, and reject relative paths', () => {
  assert.notEqual(normalizePathIdentity('/carrier/S1','linux'), normalizePathIdentity('/carrier/s1','linux'));
  assert.notEqual(normalizePathIdentity('/carrier\\s1','linux'), normalizePathIdentity('/carrier/s1','linux'));
  assert.throws(()=>normalizePathIdentity('carrier/s1','linux'),/absolute/);
  assert.throws(()=>normalizePathIdentity('C:carrier','win32'),/absolute/);
});
test('filesystem identities resolve existing paths and only allow missing paths explicitly', t => {
  const dir=mkdtempSync(join(tmpdir(),'path-identity-')); t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const child=join(dir,'child'); mkdirSync(child);
  assert.equal(samePath(child,join(child,'..','child')),true);
  assert.throws(()=>resolvedPath(join(child,'missing')), {code:'ENOENT'});
  assert.equal(resolvedPath(join(child,'missing','nested'),{allowMissing:true}),join(realpathSync(child),'missing','nested'));
  assert.equal(samePath(join(child,'missing'),join(child,'other'),{allowMissing:true}),false);
});
