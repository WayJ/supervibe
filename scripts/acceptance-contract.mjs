// Structural acceptance evidence checks, not proof that a browser or test ran.
const fail = message => { throw new Error(message); };
const text = (value, label) => { if (typeof value !== 'string' || !value.trim()) fail(`Missing ${label}`); };
const list = (value, label) => { if (!Array.isArray(value) || !value.length) fail(`Missing ${label}`); value.forEach(v => text(v, label)); };
const modalities = new Set(['browser', 'cli', 'api', 'gate', 'other']);
export function jsonBlock(document, name) {
  const blocks = [...document.matchAll(new RegExp('^```' + name + '\\s*\\r?\\n([\\s\\S]*?)^```\\s*$', 'gm'))];
  if (blocks.length !== 1) fail(`Expected exactly one ${name} block; reaccept legacy records`);
  try { return JSON.parse(blocks[0][1]); } catch { fail(`Malformed ${name} JSON`); }
}
export function acceptancePlan(document, scope) {
  const plan = jsonBlock(document, 'supervibe-acceptance-plan');
  if (plan.schema !== 1 || plan.scope !== scope || !Array.isArray(plan.scenarios) || !plan.scenarios.length) fail('Invalid acceptance plan scope/schema/scenarios');
  const ids = new Set();
  for (const s of plan.scenarios) {
    if (!s || typeof s !== 'object') fail('Invalid scenario');
    text(s.id, 'scenario id'); text(s.goal, 'scenario goal'); text(s.expected, 'expected result'); list(s.steps, 'scenario steps');
    if (ids.has(s.id)) fail('Duplicate scenario id'); ids.add(s.id);
    if (typeof s.required !== 'boolean' || !modalities.has(s.modality) || !['real', 'fixture'].includes(s.environment)) fail('Invalid scenario requirements');
    if (s.modality === 'browser' && (!s.required || s.environment !== 'real')) fail('Browser acceptance must be required and real');
  }
  if (!plan.scenarios.some(s => s.required)) fail('Acceptance needs required scenarios');
  return plan;
}
export function verifyResults(planDocument, recordDocument, scope, candidate) {
  const plan = acceptancePlan(planDocument, scope), evidence = jsonBlock(recordDocument, 'supervibe-acceptance-results');
  if (evidence.schema !== 1 || evidence.scope !== scope || evidence.candidate !== candidate) fail('Mismatched acceptance results scope/schema/candidate');
  text(evidence.environment, 'run environment');
  if (!Array.isArray(evidence.results)) fail('Missing acceptance results');
  const results = new Map();
  for (const r of evidence.results) {
    if (!r || typeof r !== 'object' || results.has(r.id)) fail('Invalid or duplicate result');
    if (!plan.scenarios.some(s => s.id === r.id)) fail('Unknown result scenario');
    if (!['passed', 'failed', 'not-run', 'substituted'].includes(r.status)) fail('Invalid result status');
    if (!Array.isArray(r.blockers) || r.blockers.some(b => typeof b !== 'string' || !b.trim())) fail('Invalid blockers');
    results.set(r.id, r);
  }
  for (const s of plan.scenarios) {
    const r = results.get(s.id);
    if (!r) fail(`Missing result: ${s.id}`);
    if (!s.required && r.status !== 'passed') continue;
    if (r.status !== 'passed' || r.blockers.length) fail(`Required scenario blocked: ${s.id}`);
    if (r.modality !== s.modality || r.environment !== s.environment) fail(`Substituted proof cannot satisfy scenario: ${s.id}`);
    list(r.steps, 'executed steps'); text(r.expected, 'expected result'); text(r.observed, 'observed result'); list(r.artifacts, 'evidence artifact references');
    if (r.expected !== s.expected || JSON.stringify(r.steps) !== JSON.stringify(s.steps)) fail(`Executed scenario differs from upfront plan: ${s.id}`);
  }
  return evidence;
}
