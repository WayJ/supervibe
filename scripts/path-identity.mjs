// Filesystem identities, not display paths. Never lowercase POSIX paths.
import { realpathSync } from 'node:fs';
import { win32, posix, dirname, basename, join, isAbsolute } from 'node:path';
export function normalizePathIdentity(path, platform = process.platform) {
  const api = platform === 'win32' ? win32 : posix;
  if (typeof path !== 'string' || !api.isAbsolute(path)) throw new Error('Path identity requires an absolute path');
  if (platform === 'win32') {
    path = path.replaceAll('/', '\\');
    if (/^\\\\\?\\UNC\\/i.test(path)) path = '\\\\' + path.slice(8);
    else if (path.startsWith('\\\\?\\')) path = path.slice(4);
  }
  let normalized = api.normalize(path);
  if (normalized !== api.parse(normalized).root) normalized = normalized.replace(platform === 'win32' ? /\\+$/ : /\/+$/, '');
  return platform === 'win32' ? normalized.replaceAll('\\', '/').toLowerCase() : normalized;
}
// Missing leaves still need identity checks against legacy ledger and Git paths.
// Resolve the nearest existing ancestor (including junctions); other I/O failures
// are not evidence of absence and must fail closed.
export function resolvedPath(path, { allowMissing = false } = {}) {
  if (typeof path !== 'string' || !isAbsolute(path)) throw new Error('Path identity requires an absolute path');
  try { return realpathSync(path); }
  catch (error) {
    if (!allowMissing || error.code !== 'ENOENT' || dirname(path) === path) throw error;
    return join(resolvedPath(dirname(path), { allowMissing }), basename(path));
  }
}
export const pathIdentity = (path, options) => normalizePathIdentity(resolvedPath(path, options));
export const samePath = (a, b, options) => pathIdentity(a, options) === pathIdentity(b, options);
