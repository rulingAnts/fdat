# FDAT ↔ FLEx integration plan: writing systems, re-import, and the road to LCM

Status: agreed 2026-10-05 (Seth + Claude). Supersedes the "possible solutions" discussion in chat.
Priority (revised the same day): **LCM first.** Stage A is cut to what Stage B needs anyway; the
LCM exporter (Stage B) follows immediately; the FLExText supplement is an optional fallback.
Companion documents on branch `claude/stoic-albattani-oevuus`: `desktop/PLAN.md` (pywebview host,
annotations stored in the FLEx project) and `desktop/research/flex-anchors/` (where FDAT data can
live in a project so Send/Receive carries it). Those remain the reference for Stage C below.

## 1. The two problems, and what the sources say

### 1.1 Writing systems ("the jam")

Symptom: Text charts show, and "Export Text Chart" writes, the first vernacular writing system for
the whole project. Texts transcribed in another vernacular writing system come out with empty
words. In three real exports, 35–70 % of words were empty (every one still had a gloss), and the
`<languages>` block listed exactly one vernacular writing system.

Mechanism (FieldWorks source, `Src/LexText/Interlinear/InterlinVc.cs`, `DisplayWord` and
`GetRealWsOrBestWsForContext`; `Src/LexText/Discourse/DiscourseExporter.cs`, `AddString`):

- The Word line is rendered from the occurrence's **baseline text** (what was typed, in the text's
  own writing system) whenever the line's configured writing system equals the paragraph's.
- The default line configuration uses the magic "vernacular in paragraph" writing system, which
  always equals the paragraph's. Once the Word line is set to a **named** writing system in
  Configure Interlinear Lines, that choice is persisted; for a text typed in a different system
  FLEx falls back to `WfiWordform.Form` in the named system, which is empty.
- The exporter writes whatever the view produced, with the view's writing system. Hence
  `lang="fau"` everywhere and empty `<word>` elements.

Consequences:

1. **Worth trying in FLEx first (unverified from code only):** in the Text Chart tab, Configure
   Interlinear Lines → set the Word line back to the default / "vernacular in paragraph" choice
   instead of a named system. If the dialog offers it, exports should then follow each text.
2. **Through LCM there is no ambiguity.** `IConstChartWordGroup.GetOccurrences()` yields
   `AnalysisOccurrence`s; each has `BaselineText` (the typed form) and `BaselineWs`, and the
   wordform's `Form.AvailableWritingSystemIds` gives every alternate. An exporter built on LCM emits
   the right text per word regardless of any setting (Stage B).
3. **FLExText exports carry the forms too.** `InterlinearExporter.cs` writes one `item type="txt"`
   per enabled Word line, and every `<phrase>` gets `phrase.BaselineText`. With both vernacular Word
   lines enabled in the Analyze tab's configuration, each `<word>` has both forms (Stage A spike).

### 1.2 Discourse Chart XML is a snapshot

Chart XML carries a GUID on every body row (`<row id>`) and nothing on words. FDAT now keys custom
columns by that GUID (exposed as `data-row-id`), but free translations and salience assignments are
still keyed by row **label**, which FLEx renumbers when a clause is inserted. So most of "start
over after re-export" is a key choice on our side, fixable now.

**The link exists in the data model, and only the chart XML export drops it.** A chart cell's
`ConstChartWordGroup` carries four fields (`MasterLCModel.xml`, class `ConstChartWordGroup`):
`BeginSegment` and `EndSegment` (references to the text's `Segment` objects) and
`BeginAnalysisIndex` / `EndAnalysisIndex` (positions within those segments). `GetOccurrences()`
(`OverridesLing_Disc.cs`) walks from the begin point to the end point, skipping punctuation, and
yields the `AnalysisOccurrence`s the cell charts. That is how FLEx keeps chart words tied to the
interlinear text.

The same key is visible in FLExText: every `<phrase>` carries its segment GUID, and its `<word>`
children are the segment's analyses in order, punctuation included as `item type="punct"`
(`InterlinearExporter.cs`). So **(segment GUID, position within the phrase)** identifies a word
occurrence exactly on both sides. What FLExText puts on `<word guid>` is the *analysis object*
(`WfiWordform` / `WfiAnalysis` / `WfiGloss`), which repeats for every occurrence of the same word, so
that attribute is not an occurrence key on its own.

FLEx's "Export Text Chart" writes none of this: chart XML has row GUIDs and nothing on words. Hence
chart XML and FLExText cannot be joined exactly as exported, while an LCM exporter that writes
`seg` + `idx` on every `<word>` (Stage B) makes the FLExText join exact, not heuristic.

## 2. Decisions (2026-10-05)

- Stage A starts now, in parallel with release testing of the current `dev`, but only its core
  (A1–A4 below). It is the part Stage B needs regardless of where the XML comes from.
- Because chart XML and FLExText share no GUIDs (§1.2), FLExText alignment can only be a heuristic.
  The LCM exporter is small (one function, no new shell) and gives real keys, so it is pulled
  forward: Phase 0 (§6) is the very next step, Stage B follows directly. The FLExText supplement
  (A5) is kept as an optional fallback for machines without FieldWorks, built only if Stage B
  cannot reach those users; every document still records the chart XML and FLExText it is based on.
- The LCM work builds on the `desktop/` plan and research from `claude/stoic-albattani-oevuus`;
  the `fdat-py` prototype on `python-redsign` is mined only for its packaging scripts.
- Library: **flexicon** (`pip install pyflexicon`), the successor of flexlibs2 (same lineage; the
  `flexlibs2` import name is a deprecated alias until flexicon 5.0). FLExTools itself still depends
  on cdfarrow's `flexlibs`, so a FLExTools module receives a flexlibs `FLExProject`; the exporter
  core is therefore written against **raw LCM objects** (an `LcmCache` / `ILangProject`) so the same
  function runs from a FLExTools module (flexlibs handle) and from standalone scripts or the desktop
  host (flexicon handle).
- Phase 0 runs on Seth's Windows machine with FieldWorks + FLExTools; Claude prepares the exact
  commands and checks (§6).

## 3. Stage A — web app, now

Goal: re-import without losing work; make the writing-system gap visible; optionally fill missing
forms from FLExText.

1. **GUID-keyed annotations.** Free translations and salience assignments keyed by `data-row-id`,
   with row label as the fallback for data saved before this change (migrate on first load: if a
   label-keyed entry exists and the rendered row with that label has a GUID, move it).
2. **Document sources.** A document stores, for each of its sources (chart XML, FLExText):
   file name, size, SHA-256, import date, the FLEx text GUID (FLExText) and the first row GUID
   (chart XML). The Document panel shows both, with "Update…" for each and a note when one is
   missing or older than the other.
3. **"Update from new export".** Loads the new file into the *same* document; every GUID-keyed
   annotation follows its row; then a diff: rows added, removed, relabeled; annotations whose row
   GUID vanished, with a re-anchoring suggestion by (label, first-cell text) and a one-click
   accept per orphan. Nothing is discarded silently; orphans stay listed until resolved.
4. **Writing-system diagnostic.** On load, count empty `<word>` elements; show "N of M words have no
   form in writing system X; FLEx exported only the project's first vernacular writing system" with
   the FLEx remedy from §1.1 and the FLExText route from (5).
5. **FLExText supplement (optional fallback; only if Stage B cannot reach a user's machine).**
   - Chart words are enumerated in row order, cells left to right, skipping markers; FLExText words
     in phrase order, skipping `punct` items. Both are text order except moved words, so alignment
     is a sequence alignment (edit distance / LCS) on the gloss string, with form text as a secondary
     match where present, and moved words allowed to shift within their row.
   - Output: for each empty chart word, the forms from the aligned FLExText word (all `txt` items,
     keyed by `lang`), plus the segment GUID + index as a provisional occurrence key.
   - Acceptance: on the three sample charts, ≥ 99 % of non-empty chart words align to a FLExText word
     with the same gloss, and every empty word gets a form; mismatches are listed, never guessed.
   - Needs from Seth: one FLExText export of a charted text, exported with both vernacular Word
     lines enabled (Analyze tab → Configure Interlinear Lines), handled like the chart samples
     (session-only, never committed).
   - User instructions (to ship with the feature): in FLEx, select the text → Texts & Words →
     Analyze tab → Configure Interlinear Lines → enable "Word" for every vernacular writing system →
     File → Export Interlinear → FLExText (.flextext). Then in FDAT, Document panel → Sources →
     "Attach FLExText…". When a text changes in FLEx, re-export **both** files and update both.

## 4. Stage B — "Export chart for FDAT" on LCM (next, after Phase 0; Windows)

A FLExTools module (and the same code as a standalone flexicon script) that writes FDAT chart XML
the web app already loads, plus what FLEx's own export lacks:

- every word's **baseline text** with its real writing system, and the other vernacular alternates
  as attributes the stylesheet ignores (e.g. `alt-fau-fonipa="…"`), so FDAT can offer a per-chart
  writing-system switch;
- `seg` (segment GUID) and `idx` (analysis index) on every `<word>`, straight from the word
  group's `BeginSegment`/`BeginAnalysisIndex` walk: the exact key shared with FLExText `<phrase>`
  GUIDs and word positions, and the stable identity for token-level annotations;
- marker possibility GUIDs on `<listRef>` so styling keys on identity, not scraped labels;
- free translations and row notes; the `<languages>` block with all vernacular systems.

The exporter core is one function over LCM (`export_chart(lang_project, chart_guid) -> str`), with
thin wrappers: a FLExTools module (uses the project handle FLExTools passes in) and a flexicon
command line. Concurrency: with the project's Sharing option on, both run while FLEx has the
project open (FLExTools' own error text points users at that setting).

Exit: one of the three sample charts, exported this way, renders in FDAT with every previously
empty word filled, and the output differs from FLEx's own export only by the added attributes.

## 5. Stage C — desktop host (months)

`desktop/PLAN.md` as written: pywebview window, the existing renderer, Stage B's exporter as the
backend, annotations stored in the project per the anchors research (custom fields on
`ConstChartRow` / `DsConstChart`, FDAT-owned list, per-peer JSON backup). Tauri plus a Python sidecar
is not preferred: LCM is Windows-only and Python-shaped, and a sidecar reintroduces the process
boundary the plan removed. Not started until Phase 0 passes.

## 6. Phase 0 spike (Seth's Windows machine)

Purpose: prove that LCM gives us the missing forms and the occurrence keys, before any more design.

1. **Install flexicon** in the Python that matches FieldWorks' architecture (32- or 64-bit):
   `python -m pip install --upgrade pyflexicon` (PyPI; no clone needed). If a package literally
   named `flexlibs2` is installed, `python -m pip uninstall flexlibs2` first so two packages do not
   own the alias. Check: `python -c "import flexicon; print(flexicon.__version__)"`.
   Requirements: Python 3.8–3.13, pythonnet ≥ 3.0.3, FieldWorks 9.0.17–9.3.1.
2. **Run** `tools/flex/phase0_chart_probe.py <ProjectName>` with FLEx closed (or Sharing on).
   It lists the project's charts and, for the chart you name (`--chart <guid or title>`), prints one
   line per word: row label, column, baseline text + its writing system, the form in the default
   vernacular system, every alternate form, segment GUID and index.
3. **Checks** (the script prints the totals): words with empty baseline text must be 0; words whose
   default-vernacular form is empty should equal the empty-word count in FLEx's own export of the
   same chart; every word has a segment GUID.
4. Send back the summary block only (counts and any error), not the word dump, which contains
   language data.

## 7. Not doing

- No changes to `.github/workflows/**` (CLAUDE.md cost policy).
- No writes to any FLEx project before Stage C's own safety rules apply.
- No heuristics that fill a word silently: every FLExText-derived form is marked as such in the DOM
  and in exports.
