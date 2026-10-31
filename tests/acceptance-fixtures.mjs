// Synthetic metadata only; not a browser integration test.
export const scenario = { id: 'A1', goal: 'Exercise behavior', required: true, modality: 'cli', environment: 'real', steps: ['run test'], expected: 'works' };
export const planBlock = (scope = 'sprint', scenarios = [scenario]) => '\n```supervibe-acceptance-plan\n' + JSON.stringify({ schema: 1, scope, scenarios }) + '\n```\n';
export const resultsBlock = (candidate, scope = 'sprint', scenarios = [scenario]) => '\n```supervibe-acceptance-results\n' + JSON.stringify({ schema: 1, scope, candidate, environment: 'test fixture environment', results: scenarios.map(s => ({ id: s.id, status: 'passed', modality: s.modality, environment: s.environment, steps: s.steps, expected: s.expected, observed: 'works', artifacts: ['fixture.log'], blockers: [] })) }) + '\n```\n';

export const mainAcceptancePolicy = { schema: 1, epic: 'E1', revision: 1, mode: 'native', provider: 'harness', maxWorkers: 1, independentAcceptance: false, workerHarness: 'inherit', allowMixed: false, status: 'confirmed', confirmation: { by: 'user', source: 'fixture:main-acceptance', at: '2026-10-31T00:00:00Z' } };
