# Roadmap final integrated acceptance — <!-- placeholder: epic id and run date -->

<!-- Append-only attempt. Plan scenarios live in the epic's Overall Acceptance
Scenarios BEFORE implementation. Every Breakdown sprint must already be landed;
individual sprint passes alone cannot establish this verdict. Retain failures.
Actual UI execution must operate the current integrated build in a real browser,
not substitute CI/API checks, fixture runs or static screenshots. -->

## Verdict

blocked — <!-- placeholder: evidence-backed basis; never prefill pass -->

## Executor Readiness

<!-- Record the confirmed iteration policy revision/fingerprint and acceptance owner
(main agent or independent worker), actual identity provenance if a worker,
all candidate developer identities for independent acceptance, current wake,
candidate/build/context, and linked structured self-check evidence. Never invent IDs.
Every wake/resume and every candidate/build/environment/context change requires
fresh self-check: target environment ownership/availability/no conflicting mutation,
scenario-required tools, account authorization, test data, evidence recording.
Missing/unknown required conditions block; not-applicable needs a scenario reason.
Main-agent acceptance follows the same checks without a fictional worker ID.
Do not put credentials or sensitive raw logs in this versioned record. -->

<!-- If the confirmed independentAcceptance policy is true, insert exactly one
fenced supervibe-acceptance-execution JSON block containing the actual {task, result}.
Task: scope roadmap, epic ID, epicDocument, role acceptance, no sprint; actual
configured main-branch worktree, registered current wake and integrated candidate.
roadmap-verify checks current policy, latest wake, candidate, identity and readiness.
Do not prefill a fake ready receipt. If false, the main agent needs no worker ID
or worker execution block; still perform and record the scenario readiness checks. -->

## Acceptance Evidence

<!-- Exact BEFORE output of validate-workflow.mjs roadmap-snapshot --epic PATH
--record PATH --main-ref MAIN. Keep before/after JSON identical. Do not hand-author
hashes or capture after a run and attach old results. Run roadmap-verify before
closing provisionally; after committing record/pointers use roadmap-verify-clean
for closure (tracked evidence and clean tree required). Only status/final-acceptance-record/final-accepted-at and this exact
record are normalized/excluded. New integrated content invalidates the pass. -->

```supervibe-evidence
{"schema":1,"scope":"roadmap","epic":"<epic-doc>","record":"<this-record>","mainRef":"<configured-main-ref>","fingerprint":"<before snapshot fingerprint>"}
```

## Execution Evidence

```supervibe-acceptance-results
{"schema":1,"scope":"roadmap","candidate":"<before snapshot fingerprint>","environment":"<actual URL/device/service, deployed build/revision, role/data and run time>","results":[{"id":"R1","status":"not-run","modality":"browser","environment":"real","steps":["<actual browser actions or planned steps if not-run>"],"expected":"<exact plan expectation>","observed":"Not run yet","artifacts":[],"blockers":["<reason not run>"]}]}
```

## Scenario Results

| id | steps | expected | observed | build/environment | evidence references | result/blockers |
|---|---|---|---|---|---|---|
| <!-- placeholder: R# --> | <!-- placeholder: actual operations --> | <!-- placeholder: expectation --> | <!-- placeholder: actual observed behavior --> | <!-- placeholder: actual tested deployment --> | <!-- placeholder: trace/log/output/screenshots --> | <!-- placeholder: status and exact blocker --> |

## DoD Checklist

<!-- Verify integrated quality gates too. Universal DoD and integrated outcomes
are separate requirements. No required evidence missing or substituted passes. -->

## Obstacles (verbatim)

<!-- Preserve failures and substitutions. An acceptance-plan scope change needs
explicit user authorization, an append-only amendment and a fresh new run.
It cannot retroactively turn this attempt green. -->

## Doc-Drift Audit

<!-- Check mapped documentation for all integrated changes. -->

<!-- If required scenarios declare resourceGroups, include exactly one fenced
supervibe-resource-execution JSON block with actual held/frozen claim proofs.
Acquire and check ownership before operations; freeze the current candidate
before acceptance. Main-agent owners use role main, never a fake worker ID.
Use resource-policy contract fields and real evidence; never fabricate claims. -->
