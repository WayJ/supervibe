# Shared development resources / 共享开发资源

## Boundary / 边界

**Worktree isolation is not environment isolation.** Docker projects, volumes, host ports,
databases, browser profiles and test accounts can still collide. The current main agent is
the coordinator; this helper is a cooperative policy gate, **not a scheduler, SSH adapter,
process supervisor or OS sandbox**. It never connects to hosts, executes commands, resets
passwords, restarts containers, installs agents, or provisions cloud servers.

**Worktree 隔离不等于环境隔离。** 当前主 agent 负责协调；本工具仅管理协作约定，
不是调度器、SSH 执行适配器或系统隔离。资源申领只授予约定用途的使用权，**不授予**
重启共享容器、清库、重置密码、刷新共享登录凭证或其他破坏性变更的权限。

The sole control plane stays in `<git-common-dir>/supervibe/state.json` on the current
computer. Optional `resourceHosts`, `resourceGroups`, `resourceClaims` share the existing
atomic lock/CAS/operation-ID transaction. They are local runtime data, not committed or
pushed; SSH adds execution **environment capacity**, not a distributed ledger. Current
workers and their Git carriers remain local, with the existing same-common-dir checks.

控制面仍仅在本机同一仓库的 Git common-dir 中。SSH 云服务器可以承载构建/测试服务环境，
不要求 worker 自身搬到远程，也不扩大共享账本范围。不要复制账本给远程机器独立写入。
远端应由本地主 agent 持有申领后协调使用；此版本不自动连接或部署。

## Capacity first / 先确认容量

Run `node scripts/resource-policy.mjs probe-local` in the repository. It reads Node OS
CPU availability/count, free/total memory, load averages, and free disk space for the
current filesystem. This is a timestamped snapshot, **not guaranteed capacity**: Docker VM
limits, cgroups, competing workloads, browser/DB overhead and remote filesystem capacity
still need actual assessment. It does not reserve memory or disk.

先只读探测当前电脑，再确认 CPU、内存、磁盘预算和系统/后台应用预留量；还要测量或明确估算
每套环境的开销。`cpu` 是可分配 CPU 单位，内存和磁盘是 bytes。用户明确确认预算及用途后
才能登记 host/group。远端预算需来自经授权的实际远端检查，不得套用本机探测值。

`recommend` reads JSON on stdin:

```json
{
  "budget": {"cpu": 8, "memoryBytes": 17179869184, "diskBytes": 107374182400},
  "reserve": {"cpu": 2, "memoryBytes": 4294967296, "diskBytes": 21474836480},
  "footprint": {"cpu": 2, "memoryBytes": 4294967296, "diskBytes": 21474836480},
  "maxWorkers": 4
}
```

These are **illustrative values, not defaults**. The recommendation is the minimum across
`floor((budget - reserve) / footprint)` for CPU/memory/disk. Missing footprint yields
`environmentInstances: null`, never an invented safe number. `maxWorkers` is a separately
user-confirmed worker limit: four agents can share a schedule with one environment, while
other agents inspect code or write documentation. One group claim conservatively charges
one full footprint; multiple claims by the same worker still consume separate capacity.

例子不是默认配置。未知开销时不推荐“安全并发数”；worker 数不等于并发环境数。
主 agent 不占 worker 名额，但其环境同样消耗资源预算。本工具只统计已申领资源的 worker，
无法检测未申领环境的 agent；整体 worker 上限仍须由主 agent/原生或 Orca 编排能力执行。

## Exact metadata API / 精确元数据接口

All mutations use stdin `{ "ledgerRevision": N, "operation": "unique-operation-id",
"payload": {...} }` with `node scripts/resource-policy.mjs COMMAND`.
Read the current ledger revision explicitly; a stale revision/lock conflict requires a
reread and decision, not blind retry. Same operation and payload replay idempotently
within the existing bounded operation journal. New operations never steal claims.

- `host`: register immutable `{id, kind: "local"|"ssh", machineId, sshAlias?, budget,
  reserve, confirmation, status: "planned"|"ready"|"unknown", preflightRef?}`.
  `confirmation` is `{by:"user", source:"message-reference", at:"ISO-timestamp"}`.
  `machineId` is the verified physical-machine identity, not an arbitrary per-SSH-alias
  label. Two SSH aliases for one machine must resolve to the **same registered host**;
  duplicate machine registration is rejected. SSH `sshAlias` names existing secure SSH
  configuration; no passwords, usernames-with-passwords, key contents or connection URLs.
  `ready` requires a non-secret evidence reference to actual external preflight.
- `group`: register immutable `{id, host, targets:[...], footprint, confirmation}`.
  Group all resources an environment needs, **before** acquisition. Each claim is atomic:
  a port collision or budget shortage leaves every resource unclaimed and revision unchanged.
- `acquire`: `{id, group, scope:"sprint", epic, sprint, owner, configRevision,
  configFingerprint}`. Roadmap final acceptance uses `scope:"roadmap"` and **omits sprint**;
  all epic sprints must be merged/closed/cancelled, with at least one merged/closed.
  Config revision and fingerprint bind the current confirmed iteration policy.
- Worker `owner`: `{role:"worker", mode:"native"|"external", workerId,
  workerHarness}`. `workerId` is a stable actual executor identity, not a task/Dispatch ID
  pretending to identify a process. Native harness is `inherit`; external harness must
  be on the confirmed allowlist. Main owner: `{role:"main", sessionId}` using the actual
  current main session identity; never create a fictitious acceptance worker.
- `host-status`: `{id, status:"unknown"}` on disconnect/uncertain liveness, or
  `{id,status:"ready",preflightRef:"fresh-evidence-id"}` after a real authorized check.
  **All claims survive** disconnect, process crashes, elapsed time and host-status changes.
  `planned` allows reservation only, not readiness. Do not duplicate-start an uncertain job.
- `freeze`: `{id,owner,generation,token,candidate}` binds a ready claimed environment to an
  exact candidate fingerprint. Changing candidate requires stopped/quiescent release,
  reacquisition and new acceptance self-check. It does not physically freeze a process.
- `check` (read-only, no mutation wrapper): `{id,owner,generation,token,host,candidate?}`
  validates exact live ownership, current policy, host readiness and budget. For acceptance
  always pass candidate. It returns `executionVerified:false`: the coordinator's preflight
  reference is an attestation, not a machine-proven execution/liveness result.
- `release`: `{id,owner,generation,token,quiescence:{by:"coordinator",stopped:true,
  evidenceRef:"actual-stop-or-quiescence-evidence"}}`. Only the exact holder/generation can
  be released. Reacquisition increments generation and changes fencing token. No TTL,
  forced stealing, or automatic liveness inference. Actual backend tooling must enforce
  fencing before external mutations; JSON alone cannot stop old processes.

元数据接口白名单拒绝密码/token/privateKey/cookie 等附加字段；但标识符和证据引用也必须由
调用者保证不含秘密，不能把 token 伪装成名字。证据引用只存非敏感 ID；密码、密钥、cookies
放在原有安全凭证设施，绝不写账本、提交的文档或任务输出。host/group 当前不可原地修改，
不得为绕过预算或冲突而另造机器 ID；需要调整已有主机预算时先停用相关环境并由主 agent
安排显式迁移，不能静默编辑运行中的账本。

## Physical targets and sharing / 物理目标与共享

All targets are **exclusive**, including read-only users in this initial implementation.
Readonly/immutable shared leasing is intentionally not implemented; isolate or serialize.
A group name is not a physical identity. Allowed canonical targets:

```
host/machine-1/docker-project/sprint-a
host/machine-1/container/actual-container-id
host/machine-1/port/3000
host/machine-1/database/database-a
host/machine-1/volume/actual-volume-name
host/machine-1/browser-profile/profile-a
global/account/test-user-a
global/service/shared-login-provider
```

Declare all actual collision domains, including external volumes and globally shared
accounts. Docker Compose project names alone do **not** isolate explicit/external volumes,
host ports or accounts. Canonical IDs must be verified by the coordinator; this helper
cannot discover that two different account aliases or container names mean the same object.
Account refresh/password rotation conflicts cross hosts, so account/service targets are
global within this ledger rather than host-scoped. A DB shared across hosts should use an
additional global service target. Unmanaged processes/other repositories do not cooperate
with this ledger: unknown owner or uncertain mapping means stop, inspect, and resolve.

首次版本全部独占，不把“只读”当成安全共享的理由。Docker project、container、volume、端口、
数据库、浏览器 profile 和账号必须按实际冲突域登记；所有组使用同一物理规范 ID。
跨机器共享数据库/账号不能只按主机分开登记。无法确认实际持有者时不允许复用。

## Acceptance and remote evidence / 验收与远端证据

At every acceptance wake/resume: inspect current ownership/generation, host reachability,
exact deployed candidate, tools/browser accessibility, account/data readiness, and absence
of conflicting mutation. Freeze the candidate and save the successful `check` receipt as
part of environment readiness evidence. Repeat the real environment self-check after a
change/disconnect; a prior JSON receipt does not survive uncertainty. Independent acceptance
workers share the same cap and need not run concurrently with developers. When independent
acceptance is disabled, the current main agent performs acceptance using its real identity.

验收唤醒时必须自检真实条件，而不是只看登记状态。UI 验收须实际操作浏览器；CLI/API 项目则
操作对应真实入口。资源账本检查不能替代端到端操作、候选版本核验、验收结论或 Sprint/
Roadmap 完成关卡。远端部署候选必须有实际版本和部署证据；远端失联保留申领、阻塞验收。

SSH resource hosts are optional **data-plane environments**, not automatically runnable
Orca workers. If remote Orca worker placement is separately chosen, a bare SSH alias is
not a paired Orca runtime: pairing, saved environment, exact repository/workspace and tool
availability need their own authorized preflight. This helper invents no Orca flags and
implements no remote adapter. The native worker worktree restriction remains unchanged.
Do not interpret exit code zero or an uncertain start receipt as verified execution;
inspect actual structured outcome/next action and do not blindly retry.

## Verification / 验证范围

`node --test tests/resource-policy.test.mjs` uses actual temporary local Git repositories,
linked worktrees and separate Node processes; it checks contention, alias conflicts,
all-or-none rollback, capacity and worker caps, stale owners/tokens, idempotency/CAS,
unknown remote liveness, frozen candidates, roadmap/main ownership and corrupt maps.

These tests perform **zero real SSH, Docker, browser/account or cloud mutations**. They
verify policy/state behavior, not live external integration. No claim of working SSH
execution, backend fencing or real browser acceptance is made until an actual environment
is authorized, supplied, preflighted and exercised.

### Required acceptance resource gate / 必需验收资源关卡

Before any worker mutates a declared environment, the coordinator must acquire its whole
resource group and pass `check` for the actual owner/host/generation. The worker repeats
this check before operations and stops on uncertainty; only after verified quiescence may
the coordinator release. Never use a claim as authorization for destructive changes.

在 Sprint/Roadmap 制定时，使用共享环境的必需场景必须在
`supervibe-acceptance-plan` 的 scenario 中声明 `"resourceGroups":["group-id"]`，
不能到验收阶段再隐藏资源依赖。没有共享/需协调资源时可省略；不会凭空登记默认组。

The Sprint and Roadmap final gates call `verifyAcceptanceResources` when required scenarios
declare groups. Add exactly one block to the acceptance record (illustrative placeholders;
use actual claim tokens, identity, config and candidate, never fabricated receipts):

```supervibe-resource-execution
{
  "schema": 1,
  "scope": "sprint",
  "epic": "E1",
  "sprint": "S1",
  "candidate": "actual-candidate-fingerprint",
  "claims": [{
    "id": "actual-live-claim",
    "owner": {"role": "main", "sessionId": "actual-current-session"},
    "generation": 1,
    "token": "actual-current-generation-token-from-local-ledger",
    "host": "local",
    "candidate": "actual-candidate-fingerprint"
  }]
}
```

For roadmap use `scope:"roadmap"` and omit `sprint`. A claim proof is required for every
required group, no duplicates, wrong task/host/group/candidate, stale claims or omissions.
If independent acceptance is enabled, owner must instead be the actual acceptance worker
and match the existing `supervibe-acceptance-execution` native worker ID or Orca durable
executor ID plus mode/harness. A developer's still-held claim cannot substitute for the
acceptance worker. The existing wake/independence checks remain mandatory and separate.
If independent acceptance is disabled, ownership must be the main session, not an invented
worker. Session identity provenance and real physical quiescence still require attestation.

这些 gate 机器校验的是已声明资源的当前协作申领和候选绑定，不是底层硬锁或真实运行证明。
申领需保持到相应验收关卡读取完成；完成且真实停止/静止后再释放。若验收后仍需继续使用
环境，保留申领并由主 agent 安排后续停用，而不是为了“清理账本”提前释放。
