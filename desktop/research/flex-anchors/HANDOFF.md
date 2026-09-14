# Handoff: FLEx anchor-point research (state as of the last push)

Purpose: let a fresh session finish this work without the original conversation.

## Status: research COMPLETE (2026-09). Next step is item 1 under "To finish".

The multi-agent run finished all 60 agents. `report-final.md` is the reviewed report;
`report-draft.md`, `review-accuracy.md` and `review-usefulness.md` are its inputs.
`chart-anchors-report.md` carries the spot-checked chart findings plus ten addenda written
during the design conversation — read those addenda first, they are the decisions.

## Where things stand
- Web app cleanup, bug fixes, tests, CI, desktop plan (`desktop/PLAN.md`), sidecar spike and shell
  starter are committed on branch `claude/stoic-albattani-oevuus` (no PR opened).
- A multi-agent research workflow ("where can FDAT data be anchored in a FLEx project so
  Send/Receive syncs it") ran from this folder's `workflow.js`. Its journal is snapshotted here
  (`journal.jsonl`, `state.json`); `chart-anchors-report.md` (spot-checked) and
  `../refs/sil-docs-notes.md` (quotes from SIL documents the owner supplied) hold the verified
  material gathered so far.
- Owner's framing to respect: FDAT's starting data is the Text Chart tab (DsConstChart and its
  rows/cells). Data must link to the chart (not baseline/gloss/tagging/print tabs). Features:
  per-row colour bands and custom columns (values tied to specific rows), per-marker styling and
  show/hide, per-chart settings. Everything must sync via Send/Receive and must not break FLEx.

## Conclusions so far (see the two reports for citations)
1. Custom fields on `ConstChartRow` / `DsConstChart`, created through LCM (`AddCustomField`), are
   viable: no class whitelist in LCM, FLExBridge merges custom properties generically per object,
   FixFwData tolerates them, migrations ignore them; SIL's XML-model doc says the format accepts
   more types/classes than the UI offers. Caveats: invisible in FLEx's Custom Fields dialog, ignored
   by the chart tab, a list-ref field dies with its list; declare on concrete classes only.
2. `DsConstChart.Name`/`Description` are unused by FLEx (free chart-level slots).
3. Row GUIDs survive most edits but rows self-delete when emptied (unless Notes has text), are
   recreated in one path, and are wiped by "Clear from here on"; cell-part GUIDs are unstable.
   Key by row GUID with a re-anchoring fallback (label + first word group's segment + column).
4. A per-chart JSON under `<project>/LinkedFiles/Others/fdat/` syncs (not excluded; 1 MiB cap for
   unknown extensions per Chorus source; whole-file merge, merging machine wins). Simple fallback.
5. `ConstChartTag` from an FDAT-owned list renders as a normal marker if its column is a real
   template leaf; text tags would surface in the Tagging tab (poor fit for the framing).
6. Concurrency: `.lock` blocks a second process ONLY when project sharing is off. With FLEx's
   Project Properties > Sharing tab enabled, LCM promotes a plain XML open to the shared backend
   (`LcmCache.GetProviderTypeFromProjectId`), so FDAT can read and write while FLEx is open; a
   non-master peer cannot run a data migration. The setting syncs with S/R (SharedSettings/*.plsx).
   See the addendum in `chart-anchors-report.md`. Writes via flexlibs `OpenProject(name, True)` or a
   non-undoable task + `IUndoStackManager.Save()`.

## To finish (in order)
1. **Write `desktop/FLEX-ANCHORS.md`** — one readable summary for the repo, drawn from
   `report-final.md`, the ten addenda in `chart-anchors-report.md`, and `../refs/sil-docs-notes.md`.
   `desktop/PLAN.md` already carries the decisions; this is the standalone reference.
2. **Fold the exporter corrections into `desktop/sidecar/fdat_lcm.py`** — `report-final.md` §7.3 has
   a line-by-line table. The real FLEx export differs from the spike in about a dozen ways (row `id`,
   `lang` attributes throughout, `<languages>` after `</chart>`, parenthesis lits around markers,
   `<moveMkr>`, one header row per template depth, merged-cell widths, occurrence-based word
   iteration). `test/fixtures/sample-chart.xml` lists the same differences in its header comment.
3. **Emit the marker possibility GUID on `listRef`** so marker styling keys on GUID rather than a
   scraped label (addendum 4). The XSL already passes `@guid` through to `data-guid`.
4. **Phase 0 spike on a real Windows machine** — `report-final.md` §1.3/§1.4 has the steps. The
   report recommends scoping v1 to three things only: the FDAT possibility list plus `FDAT_Band`
   (ReferenceCollection) and `FDAT_ColumnValues` (String) on `ConstChartRow`, and
   `FDAT_ChartSettings` (String) on `DsConstChart` — defer the rest until those survive a
   two-machine Send/Receive round trip.
5. Commit and push after each file. The research folder needs no further snapshots: the workflow is
   finished and its journal is committed.

## Unverified items that matter (from report-final.md)
- A custom field on `DsDiscourseData` (the singleton in the split file's `<header>`) is untested.
- `StText` (multiparagraph) custom fields are believed to merge per paragraph — derived from
  strategy code, not observed.
- Writing to a chart or row while the FLEx user has unsaved edits on the same object can cost them
  that work: keep write windows short.
- Nothing was found that prunes unreferenced files from `LinkedFiles`, but that is absence of
  evidence — confirm a backup survives a Send/Receive round trip and a FLEx backup/restore.
