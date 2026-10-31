// Shared confirmed policy validation: no runtime or workflow imports.
import { createHash } from 'node:crypto';
import { readLedger } from './ledger-store.mjs';
const fail = message => { throw new Error(message); };
const object = (value, label) => { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`); return value; };
const text = (value, label) => { if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a nonempty string`); return value; };
const list = (value, label, nonempty = false) => {
  if (!Array.isArray(value) || (nonempty && !value.length)) fail(`${label} must be ${nonempty ? 'a nonempty' : 'an'} array`);
  value.forEach(item => text(item, label)); return value;
};
export function validateConfig(config) {
  object(config, 'config');
  if (!['native', 'external'].includes(config.mode)) fail('Select collaboration_mode native or external explicitly; no fallback');
  if ((config.mode === 'native' && config.provider !== 'harness') || (config.mode === 'external' && config.provider !== 'orca')) fail('Supported pairs: native/harness or external/orca');
  return { mode: config.mode, provider: config.provider };
}
export function validateIterationConfig(input) {
  const config = object(input, 'iteration config');
  validateConfig(config);
  if (config.schema !== 1) fail('Unsupported iteration config schema');
  if (!/^[A-Za-z][\w.-]{0,80}$/.test(text(config.epic, 'epic'))) fail('Invalid epic identity');
  if (!Number.isSafeInteger(config.revision) || config.revision < 1) fail('Config revision must be a positive integer');
  if (!Number.isSafeInteger(config.maxWorkers) || config.maxWorkers < 1) fail('maxWorkers must be a positive integer; ask the user, no default');
  if (typeof config.independentAcceptance !== 'boolean') fail('independentAcceptance must be explicitly confirmed by the user; no default');
  if (config.status !== 'confirmed') fail('Iteration config must be user-confirmed before delegation');
  const confirmation = object(config.confirmation, 'confirmation');
  if (confirmation.by !== 'user') fail('Confirmation must come from the user');
  text(confirmation.source, 'confirmation.source');
  text(confirmation.at, 'confirmation.at');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(confirmation.at) || !Number.isFinite(Date.parse(confirmation.at))) fail('confirmation.at must be a timestamp');
  if (config.mode === 'native') {
    if (config.workerHarness !== 'inherit' || config.allowMixed !== false || config.workerHarnesses !== undefined) fail('Native workers inherit current harness; no harness override or mixing');
  } else {
    list(config.workerHarnesses, 'workerHarnesses', true);
    if (config.workerHarness !== undefined || new Set(config.workerHarnesses).size !== config.workerHarnesses.length || config.workerHarnesses.some(id => !/^[a-z][a-z0-9-]*$/.test(id))) fail('Use unique canonical worker harness IDs');
    if (typeof config.allowMixed !== 'boolean' || (config.workerHarnesses.length > 1 && !config.allowMixed)) fail('Multiple harnesses require explicit allowMixed true');
  }
  return config;
}
export function iterationConfigFingerprint(config) {
  validateIterationConfig(config);
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  return createHash('sha256').update(JSON.stringify(canonical(config))).digest('hex');
}
export function readIterationConfig(root, epic) {
  const configs = readLedger(root).iterationConfigs;
  if (configs !== undefined) object(configs, 'iterationConfigs');
  const config = configs && Object.hasOwn(configs, epic) ? configs[epic] : undefined;
  if (!config) fail('Missing iteration config; ask the user at overall iteration kickoff before delegation');
  validateIterationConfig(config);
  if (config.epic !== epic) fail('Iteration config epic mismatch');
  return config;
}
