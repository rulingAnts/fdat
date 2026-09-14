# Handoff: FLEx anchor-point research (state as of the last push)

Purpose: let a fresh session finish this work without the original conversation.

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

## To finish
1. If the workflow did not complete: follow README.md here to resume (same session: runtime
   resume; new container: re-clone sources, `rebuild.py`, run `continue.workflow.js` with
   `args: { state }`). Its final output is a Markdown report (`report`) plus a draft and reviews.
2. Write `desktop/FLEX-ANCHORS.md` from the workflow report + `chart-anchors-report.md` +
   `../refs/sil-docs-notes.md`, then update `desktop/PLAN.md` §4 (exporter format corrections:
   the real exporter writes `<row id="<label>">`, `lang` attributes on word/gloss, etc.) and §5
   (custom fields on chart classes as primary; JSON fallback), and `desktop/sidecar/fdat_lcm.py`.
3. Commit and push after each file.
