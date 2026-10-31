#!/usr/bin/env node
/** Pure intent routing; does not initialize a repository, ledger, or runtime. */
import { pathToFileURL } from 'node:url';

export function routeIteration(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('routing input must be an object');
  const execution = input.execution ?? 'iteration';
  if (!['solo', 'iteration'].includes(execution)) throw new Error('execution must be solo or iteration');
  return execution === 'solo'
    ? { execution, target: 'superpowers', activateIteration: false, allowSubagents: false }
    : { execution, target: 'supervibe', activateIteration: true, coordinator: true, requireWorkers: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    let raw = '';
    for await (const chunk of process.stdin) raw += chunk;
    console.log(JSON.stringify(routeIteration(raw.trim() ? JSON.parse(raw) : {})));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
