// Deliberately small, portable grammar. No shell, regex, braces, or prose interpretation.
export function validatePattern(value) {
  if (typeof value !== 'string' || !value || !/^[A-Za-z0-9_./*?@+-]+$/.test(value) || value.startsWith('/') || value.endsWith('/') || value.split('/').some(p => !p || ['.', '..', '.git'].includes(p)) || value.includes('***')) throw new Error(`Unsupported doc-sync path/glob: ${value}`);
  return value;
}
export function validateDocSyncRule(rule) {
  if (!rule || typeof rule !== 'object' || Object.keys(rule).some(k => !['change', 'owes'].includes(k))) throw new Error('Invalid doc-sync rule');
  validatePattern(rule.change);
  if (rule.owes !== '{epic}') validatePattern(typeof rule.owes === 'string' && rule.owes.startsWith('{dir}/') ? rule.owes.slice(6) : rule.owes);
  return { change: rule.change, owes: rule.owes };
}
export function globMatch(pattern, path) {
  validatePattern(pattern);
  let source = '^';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      i++;
      if (pattern[i + 1] === '/') { i++; source += '(?:.*/)?'; }
      else source += '.*';
    } else if (c === '*') source += '[^/]*';
    else if (c === '?') source += '[^/]';
    else source += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(source + '$').test(path);
}
