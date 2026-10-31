# Handover clause record format

<!-- Template note: a handover clause is a cross-sprint review obligation.
The clause BODY lives only in the issuing sprint doc's Handover Clauses
section — the single source of truth; every other artifact holds references
only (a target doc's frontmatter clauses list carries the HC#, nothing
more). Ids: use the receipt from scripts/clause-ids.mjs reserve after the issuer
sprint is reserved/active. Explicit legacy bootstrap is required once; never
scan Markdown for routine allocation, reset the counter or reuse an abandoned ID. Target reference
rule: target doc exists → append the HC# to its frontmatter clauses list;
future target with no doc yet → the target field below records "<epic>
breakdown S#" and the reference migrates at that stub's materialization.
Discharge belongs to the target side's sync — obligation verified, evidence
recorded back HERE in the issuing doc's clause record; never at merge. -->

Field block per clause:

- id HC#: <!-- placeholder: HC id returned by atomic clause-ids.mjs reserve -->
- issuer sprint: <!-- placeholder: sprint id whose doc holds the clause text; omitted as a column when the record lands in the issuing doc's table — the doc itself is the issuer -->
- target sprint: <!-- placeholder: target sprint id, or "<epic> breakdown S#" while no target doc exists -->
- trigger: <!-- placeholder: incoming change that fires re-verification, as a path or feature hit -->
- obligation: <!-- placeholder: the review owed, stated verbatim -->
- status (open|discharged): <!-- placeholder: open at registration; discharged only by the target side's sync -->
- evidence: <!-- placeholder: commit hash or verification transcript, written at discharge -->

Worked example (generic):

- id HC#: HC1
- issuer sprint: S2
- target sprint: S4
- trigger: billing module merged to main
- obligation: re-run the S1 acceptance suite; confirm export totals still reconcile with the invoice ledger
- status (open|discharged): open
- evidence: none yet — discharge writes it here
