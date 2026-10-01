# Debt tracker entry format

<!-- Template note: row format for the configured debt tracker (default
docs/tech-debt-tracker.md). The tracker file is created by the roadmap
skill's debt subcommand with this header on first entry — scaffold does not
create it. Rules: an entry without repayment criteria is invalid; repayment
closes the entry citing the evidence commit hash — no hash, no closure;
observation items (symptoms without a fix decision) do not ride this
tracker — route them to an owning epic and let its DoD carry them. -->

| id | date | severity | owner | description | repayment criteria | status | evidence commit |
|---|---|---|---|---|---|---|---|
| TD-14 | 2026-10-01 | medium | backend | export route lacks pagination; large quarters time out | cursor pagination on the export route, verified at 10x the current max quarter | open | — set at repayment <!-- example --> |
| <!-- placeholder: id --> | <!-- placeholder: date --> | <!-- placeholder: severity: low, medium, or high --> | <!-- placeholder: owner --> | <!-- placeholder: description --> | <!-- placeholder: repayment criteria, required --> | <!-- placeholder: open or closed --> | <!-- placeholder: evidence commit hash at repayment --> |
