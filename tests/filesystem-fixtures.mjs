import { symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Prefer actual symlinks. A Windows junction exercises the same lstat-based
// directory containment guard without requiring the symlink privilege.
export function directoryLink(t, target, path) {
  try {
    symlinkSync(target, path, 'dir');
  } catch (error) {
    if (process.platform !== 'win32' || error.code !== 'EPERM') throw error;
    symlinkSync(resolve(dirname(path), target), path, 'junction');
    t.diagnostic('Directory symlink privilege unavailable; testing a Windows junction instead');
  }
}

// File links cannot be replaced by junctions. Skip only the individual link
// assertion when Windows explicitly denies the privilege; other errors fail.
export function fileLink(t, target, path) {
  try {
    symlinkSync(target, path, 'file');
    return true;
  } catch (error) {
    if (process.platform !== 'win32' || error.code !== 'EPERM') throw error;
    t.skip('Windows file symlink privilege unavailable (EPERM); enable Developer Mode or run with symlink privilege');
    return false;
  }
}
