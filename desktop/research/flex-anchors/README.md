# FLEx anchor-point research: progress snapshots and how to resume

A multi-agent workflow is researching where FDAT data can be anchored in a FLEx project
(model fields, custom fields, linked files, tags/lists, notes/styles, chart export format,
GUID stability, concurrency). Its progress is snapshotted here so a cloud-container reset
does not lose completed agent work.

Files

- `workflow.js` — the script that was launched (run id `wf_2d53e9ec-f9f`).
- `journal.jsonl` — the runtime's journal at the last snapshot: every `started`/`result`
  event, with each agent's returned data.
- `state.json` — `journal.jsonl` reduced to `{ results: { <label>: <result> } }` by `rebuild.py`.
- `continue.workflow.js` — the same research pipeline, but every agent call first looks its
  label up in `args.state.results`; only missing results spawn agents.
- `snapshot.sh` — copies the live journal here, rebuilds `state.json`, commits and pushes.

How to resume

1. Same session, run still alive: nothing to do; the run notifies on completion.
2. Same session, run stopped or script edited:
   `Workflow({ scriptPath: "<runtime script path>", resumeFromRunId: "wf_2d53e9ec-f9f" })`
   (completed agent calls with unchanged prompt+options return cached results).
3. New session or new container (the runtime's journal is gone):
   ```
   git pull
   python3 desktop/research/flex-anchors/rebuild.py desktop/research/flex-anchors/journal.jsonl desktop/research/flex-anchors/state.json
   ```
   then read `state.json` and launch `continue.workflow.js` with
   `args: { state: <contents of state.json> }`. The sources it reads must exist at the
   paths in its CONTEXT block (re-clone liblcm, flexbridge, flexlibs, flextools and a sparse
   FieldWorks into the scratchpad `src/` folder as listed there, or edit `SRC`).
   Verification labels depend on the order of findings inside each cached sweep result, which
   is stable because the sweep results themselves come from the state.

The `verify:*` results are only reusable together with the sweep result they belong to, which
is why `state.json` keeps both.
