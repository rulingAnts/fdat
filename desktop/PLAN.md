# FDAT Desktop: a FLEx-integrated Windows app (plan)

Status: planning + starter code. This folder is a temporary home; the desktop app is meant to become its own GitHub repository (suggested name: `fdat-desktop`). Everything here is written so it can be moved out without touching the web app.

## 1. Decision

Build FDAT as a **Windows-only desktop app that talks to FieldWorks directly** through the FLEx object model (LCM), instead of consuming "Export Text Chart" XML files.

What that buys:

- **No export step.** The user picks a project and a chart; the app reads `DsConstChart` objects and renders them.
- **Stable identities for free.** Rows, cells, word groups, analyses and tags all have FLEx GUIDs. Everything FDAT annotates (salience bands, custom columns, marker styling) is keyed by those GUIDs, so annotations survive re-charting, re-ordering and Send/Receive.
- **Less infrastructure.** The browser-storage hierarchy (language → genre → document), the legacy-key sync, settings import/export, and the row/token GUID registries in `docs/app.js` exist only because exported XML carries no identity and the browser has no project. They go away or shrink to "per-project preferences".
- **Data that FLEx already has.** Free translations (`Segment.FreeTranslation`), notes (`ConstChartRow.Notes`), chart markers (`ConstChartTag`) and the template come straight from the project instead of being retyped.

What it costs:

- Windows only, with FieldWorks installed (LCM loads the installed FieldWorks assemblies). Mac/Linux users keep the web app for exported XML.
- A second process (the LCM host) that has to be packaged and supervised.
- Concurrency rules with a running FLEx (see §7).

## 2. Architecture

```
┌────────────────────────────── FDAT Desktop (Electron) ───────────────────────────────┐
│                                                                                        │
│  main process                          renderer (BrowserWindow, contextIsolation)      │
│  ┌──────────────────────────┐          ┌──────────────────────────────────────────┐   │
│  │ app:// scheme → serves   │          │ existing chart renderer (index.html +    │   │
│  │ the bundled renderer     │◄────────►│ app.js + XSL), plus host-glue.js which   │   │
│  │ sidecar supervisor       │  IPC     │ adds "Open from FLEx" and calls          │   │
│  │ (spawn, restart, RPC)    │          │ window.fdatHost.* via the preload bridge │   │
│  └───────────┬──────────────┘          └──────────────────────────────────────────┘   │
│              │ JSON-RPC over stdio (newline-delimited JSON)                            │
└──────────────┼─────────────────────────────────────────────────────────────────────────┘
               ▼
   ┌──────────────────────────────┐        ┌──────────────────────────────┐
   │ LCM sidecar (Python +        │  LCM   │ FieldWorks project           │
   │ flexlibs 2.x + pythonnet)    │◄──────►│ (.fwdata / shared XML)       │
   │ list projects / charts,      │        │ + FDAT data stored in the    │
   │ export chart, write back     │        │   project, synced by S/R (§5)│
   └──────────────────────────────┘        └──────────────────────────────┘
```

Key choices and why:

- **Renderer = the existing web app, bundled locally.** `docs/index.html`, `docs/app.js` and the XSL already render charts from XML and apply settings as DOM augmentation. The shell serves them from an `app://` scheme (Chromium refuses `fetch()` of `file://` URLs, so the XSL load needs a real scheme). Nothing is loaded from the network, so the preload bridge can safely expose privileged calls; the current online-PWA shell deliberately exposes none.
- **LCM host = Python sidecar using flexlibs.** flexlibs is the proven way to drive LCM from outside FLEx (FLExTools is built on it): it locates the installed FieldWorks, initialises LCM, and opens projects. The alternative is a small C# host referencing the installed FieldWorks assemblies; it removes the Python runtime from the package but means writing and shipping .NET code. Start with Python; the JSON-RPC boundary makes the host swappable.
- **Electron over Tauri, for now.** The existing shell is Electron, spawning and supervising a child process is trivial, and packaging on Windows is known. Tauri (Rust host, WebView2) would produce a smaller binary and has first-class "sidecar" support; it is a reasonable later switch because the renderer and the sidecar do not care which shell hosts them.
- **Transport = JSON-RPC 2.0, one JSON object per line on stdin/stdout.** Simple to debug (`echo '{"jsonrpc":"2.0","id":1,"method":"listProjects"}' | python fdat_lcm.py serve`), no ports, no CORS.

### Bridge API (renderer ↔ main ↔ sidecar)

Exposed as `window.fdatHost` by `shell/preload.js`; every call returns a Promise.

| Method | Sidecar RPC | Notes |
|---|---|---|
| `listProjects()` | `listProjects` | Names of FieldWorks projects on this machine. |
| `openProject(name)` | `openProject` | Opens (read-only at first). Returns writing systems and whether write access was granted. |
| `listCharts()` | `listCharts` | `{ guid, title, textTitle, templateName, rowCount }` per `DsConstChart`. |
| `getChartXml(guid)` | `exportChart` | The chart as FDAT XML (§4) with `guid` attributes. The renderer loads it with `window.FDAT.loadXmlText()` + `previewCurrentXml()`, which already exist. |
| `getAnnotations(chartGuid)` / `putAnnotations(chartGuid, data)` | same | Everything FDAT stores for a chart, assembled from native objects plus the JSON remainder (§5). |
| `setRowNotes(rowGuid, text)` | `setRowNotes` | First write-back (Phase 2). |
| `closeProject()` | `closeProject` | Releases the LCM cache. |

The renderer keeps working without a host: `host-glue.js` does nothing unless `window.fdatHost` exists, so the same bundle still runs as the web app.

## 3. What happens to the existing web-app code

| Area in `docs/app.js` | Desktop fate |
|---|---|
| XML parsing, XSLT render, column resize, export (HTML/print) | Kept as-is. |
| Marker order/visibility/style, abbreviations, salience bands, custom columns, notes mode, free-translation display | Kept; their persistence moves from localStorage into the FLEx project (native objects plus a JSON remainder, §5), keyed by FLEx GUIDs (rows: `data-row-guid`, cells: `data-cell-guid`, tokens: `data-guid`, which the XSL already passes through). |
| Free-translation *editing* | Replaced by reading `Segment.FreeTranslation`; editing stays in FLEx. |
| Hierarchical settings (language/genre/document), legacy-key sync, settings import/export, row/token GUID registries, file input | Removed in the desktop build. Language-level things (abbreviation names, marker styles) live on the Chart Markers list in the project (§5). |
| PWA plumbing (service worker, install prompts) | Not loaded in the desktop build (the shell strips the `sw.js` registration or serves a no-op). |

Practical step for the split: separate `docs/app.js` into `chart-renderer.js` (parsing, XSLT, DOM augmentation, export) and `web-settings.js` (browser storage, panels wiring for the PWA). The desktop repo consumes `chart-renderer.js` plus its own `desktop-settings.js`. Until the renderer is published as a package, vendor it into the desktop repo with `git subtree` so fixes flow both ways.

## 4. FLEx object model → FDAT chart XML

The sidecar emits the same XML shape the renderer already consumes (see `test/fixtures/sample-chart.xml`), adding `guid` attributes.

| FLEx (LCM) | FDAT XML | Notes |
|---|---|---|
| `ILangProject.DiscourseDataOA.ChartsOC` (`IDsConstChart`) | `<document>` + `<chart>` | One chart per document. |
| `DsConstChart.TemplateRA` (`ICmPossibility` tree) | `<row type="title1">` cells = top-level groups with `cols` = leaf count; `<row type="title2">` cells = leaf columns | Column identity = leaf possibility GUID (`guid` on title2 cells). |
| `ConstChartRow` | `<row type="normal|dependent|speech|song" endSent endPara guid>` | `ClauseType` → type; `EndSentence`/`EndParagraph` → flags; `Label` → `<rownum>` in the first cell. |
| `ConstChartRow.Notes` | `<note>` in the last cell | Notes column. |
| `ConstChartWordGroup` (`BeginSegmentRA`, `EndSegmentRA`, `BeginAnalysisIndex`, `EndAnalysisIndex`, `ColumnRA`) | `<word guid>` per analysis + `<glosses><gloss>` | Wordform text from the analysis in the vernacular WS; gloss from `WfiGloss`/`WfiAnalysis` in the default analysis WS. `MergesAfter/MergesBefore` → `cols` spans. |
| `ConstChartTag` (`TagRA` in the Chart Markers list) | `<listRef guid>` | Text = marker abbreviation, falling back to name. |
| `ConstChartClauseMarker` (`DependentClausesRS`) | `<clauseMkr>` | Text = the dependent rows' labels (`1b`, `1b-1c`). |
| `ConstChartMovedTextMarker` (`WordGroupRA`, `Preposed`) | `<lit>` with `<<` / `>>` | Matches FLEx's on-screen markers; adjust once compared with a real export. |
| Vernacular/analysis writing systems | `<languages>` | Informational. |

Everything above needs to be checked against a real "Export Text Chart" file from the same project during Phase 0; the renderer is tolerant, but the spike should aim for byte-for-byte equivalence minus the `guid` attributes.

## 5. Where annotations live: inside the FLEx project, synced by Send/Receive

Goal: **everything FDAT knows about a chart lives in the FieldWorks project**, so a colleague who does Send/Receive sees the same bands, columns, marker styling and formatting on another computer, and nothing is lost when the browser cache or the machine is replaced. No browser storage, no import/export, no external store.

### What Send/Receive actually syncs

- **Every object in the LCM model.** Discourse charts, possibility lists (built-in and custom), text tags, notebook records, and **custom field definitions and values** are all part of the `.fwdata` model that FLExBridge/Chorus splits into XML and merges element by element. Two users editing different objects merge cleanly; edits to the same field conflict and one side wins (Chorus records a conflict note).
- **Linked files** (`<project>/LinkedFiles/Pictures`, `AudioVisual`, `Others`): FLExBridge includes these in the repository, subject to a per-file size cap (small files are fine). They are treated as opaque: no element-level merge, whole-file "ours/theirs" on conflict.
- Not synced: arbitrary files elsewhere in the project folder (`ConfigurationSettings` is only partially covered), and anything outside the project.

So there are two sync-safe places for FDAT data: native LCM objects (best, mergeable, visible in FLEx) and small files under `LinkedFiles/Others` (opaque but synced). Phase 0 must confirm both on a real two-machine Send/Receive before any of the design below is relied on.

### Mapping FDAT data to native FLEx objects

| FDAT data | FLEx-native home | Sync/merge | Visible in FLEx |
|---|---|---|---|
| Free translations | `Segment.FreeTranslation` (read only; edited in FLEx) | element-level | yes |
| Row notes | `ConstChartRow.Notes` | element-level | yes (Notes column) |
| Chart markers, their names/abbreviations/definitions (FDAT's "abbreviations list") | the Chart Markers list (`CmPossibility.Name`, `Abbreviation`, `Description`) | element-level | yes (Lists) |
| Marker visibility and text colour | `CmPossibility.Hidden`, `ForeColor` on the marker | element-level | partly (colour is used by some FLEx views) |
| Marker display order | order of the possibilities in the list (FLEx lets users reorder) | element-level | yes |
| Salience band definitions (tree, labels, colours) | a sub-list under **Text Markup Tags** (`LangProject.TextMarkupTagsOA`), which is hierarchical and user-extensible; colour in `CmPossibility.BackColor` | element-level | yes (Tagging view lists) |
| Row → band assignment | a `TextTag` on the text (`StText.TagsOC`) spanning the row's word groups (`BeginSegment/EndSegment/BeginAnalysisIndex/EndAnalysisIndex`), `TagRA` = the band. Alternative: a `ConstChartTag` in a dedicated "Salience" template column, which shows the band as a marker in the chart itself | element-level | yes (Tagging view, or the chart) |
| Custom column definitions and per-row free-text values | no per-row free-text field exists besides `Notes`; see "the remainder" below | | |
| Chart title, prologue, epilogue, notes mode/width, salience display options, marker bold/italic/size | see "the remainder" below | | |

Everything in the table with a native home should use it: those objects merge properly, other tools (and FLEx itself) can see them, and the data survives re-charting because FLEx keeps the same GUIDs.

### The remainder: a JSON document stored *in* the project

Two sync-safe options for the per-row free text and the chart-level settings; both keep the data inside the project:

1. **A custom field on the interlinear `Text`** ("FDAT data", multi-paragraph text) holding one JSON document per text: `{ version, charts: { <chartGuid>: { columns, cells: { <rowGuid>: {...} }, title, prologue, epilogue, display } } }`. Custom field definitions and values are model data, so they sync and back up with the project, and LCM guarantees the field exists on every machine after the first Send/Receive. The field shows up in the text's Info tab as an opaque JSON block (name it clearly and put it last). Chorus merges it as one string: concurrent edits by two users to the same text's FDAT data conflict wholesale. Keep the document small and per-text so that is rare. *Verify in Phase 0 that the installed FieldWorks version offers custom fields on `Text`* (they are not offered on `ConstChartRow`, `Segment` or `CmPossibility`).
2. **A JSON file per chart under `LinkedFiles/Others/fdat/`**. Simpler to write (no LCM write transaction), synced as an opaque file, but invisible to FLEx and not covered by FLEx's own backup/restore of the model unless linked files are included. Use this only if custom fields on `Text` turn out to be unavailable.

Language-level preferences that are not per-marker (for example a default display preset) can live in the same JSON on a designated notebook record, or simply be repeated per text; do not build a third mechanism for them.

### Data-model safety rules

Storing data in the project must never put the project at risk. These rules are binding for every phase:

1. **Only FLEx's own extension points.** Custom fields (created through LCM's metadata API, exactly as FLEx's "Custom Fields" dialog does), possibility lists and sub-lists, and `TextTag`s. No new classes, no changes to the model or its version, and no repurposing of a field for something FLEx would misread. In particular, do **not** put non-marker possibilities into `ConstChartTag.TagRA` (FLEx's chart UI assumes the Chart Markers list); use `TextTag` for bands.
2. **All writes go through LCM**, inside a unit of work (flexlibs' `writeEnabled=True` path), never by editing `.fwdata` XML or FLExBridge's split files. LCM validates ownership and references, keeps the object cache consistent and writes the file atomically; hand-editing does none of that.
3. **Read-only by default.** The sidecar opens projects read-only; write mode is entered only for an explicit save action and released afterwards. Writing while FLEx has the project open is supported only through the shared backend, i.e. only when the project has sharing enabled (§7); otherwise the open fails with a file-locked error and FDAT must say so plainly.
4. **FDAT only touches what FDAT created**, plus the one FLEx-owned field the user explicitly edits in FDAT (`ConstChartRow.Notes`). FDAT-created objects are recognisable (list named "FDAT Salience Bands", custom field named "FDAT data", tags referencing FDAT's own list). Nothing FLEx or the user created is deleted, reordered or renamed by FDAT.
5. **Reversible.** Ship "Remove FDAT data from this project", which deletes only the objects in rule 4 through LCM, so a project can be returned to its pre-FDAT state.
6. **Backups and checks around every write path during development.** Test on a copy of a project (FLEx's sample project first), take a FLEx backup before the first write in a session, and after write tests open the project in FLEx and run its data integrity check (`FixFwData`) to confirm it is clean. Phase 2's exit criterion includes both, plus a two-machine Send/Receive round trip.
7. **Version-tolerant.** FDAT data carries a `version` and FDAT refuses to write to a project whose FieldWorks data version it has not been tested with, rather than guessing.

### Consequences for the code

- The renderer's settings panels keep their UI but read/write through `window.fdatHost` (`getAnnotations` / `putAnnotations` become "read the native objects + the JSON remainder" / "write back"), keyed by `data-row-guid` / `data-guid` instead of row labels and index-based registries.
- Writes need `writeEnabled=True` in flexlibs and run inside an LCM unit of work (flexlibs starts a non-undoable task on open and saves on `CloseProject`); with project sharing enabled the project may be open in FLEx at the same time (§7). The UI should batch edits and show "saved to project" explicitly.
- The web app's language/genre/document hierarchy, legacy-key sync and import/export are not carried over.

## 6. Phases

### Phase 0 — spike (1–2 days on a Windows machine with FieldWorks + FLExTools)

- Run `sidecar/fdat_lcm.py list-charts <Project>` and `export <Project> <chartGuid> out.xml`.
- Load `out.xml` in the web app (`npm run dev:web`, paste or pick the file). It must render like FLEx's own export of the same chart; fix the mapping in §4 until it does.
- Confirm on a real machine what §7 says from the source: with the Sharing tab enabled the sidecar opens (and writes) while FLEx has the project open; with it disabled the open raises `FP_FileLockedError`. Also measure how long opening a large project takes, and whether an open FLEx notices an FDAT write.
- Verify the storage assumptions in §5 on a two-machine Send/Receive: a custom field added to `Text` (definition and value) arrives on the other machine; a `TextTag` created from flexlibs shows in FLEx's Tagging view and arrives too; a small file under `LinkedFiles/Others` arrives.
- Exit criterion: a real chart renders from LCM with `guid` attributes on rows, cells and tokens, and the storage checks above have a yes/no answer each.

### Phase 1 — desktop v1, read-only (new repository)

- `shell/` from this folder as the starting point: `app://` bundle serving, sidecar supervision, `fdatHost` bridge, project/chart picker in `host-glue.js`.
- Package: Electron app + embedded Python (python.org "embeddable" build) + `flexlibs`, `pythonnet` wheels; NSIS installer. FieldWorks must be installed separately (documented requirement; the sidecar reports a clear error otherwise).
- Settings: keep the renderer's localStorage for display prefs in v1 (unchanged code), so v1 is "the web app, fed by FLEx". Ship this to real users early.
- Exit criterion: a user opens FDAT, picks a project and chart, and gets the chart with resize/markers/export working, with no XML export step.

### Phase 2 — GUID-keyed annotations and first write-back

- Native storage per §5 behind the bridge: bands as a Text Markup Tags sub-list plus `TextTag`s, marker visibility/colour/order on the Chart Markers list, abbreviation names on the markers, the remainder in the "FDAT data" custom field on the text. Panels read/write through the bridge instead of localStorage; assignments keyed by `data-row-guid` / `data-guid` instead of row labels.
- Free translations read from segments (tooltip + inline modes keep working; the editor goes away).
- Row notes write-back (`setRowNotes`), with a "project is open in FLEx" guard and explicit "saved to project" feedback.
- Confirm with a second machine that a full round of annotations survives Send/Receive in both directions.
- Remove the language/genre/document hierarchy and settings import/export from the desktop build (the split described in §3).
- Exit criterion: annotations survive re-charting in FLEx (rows moved/merged) and a project rename; after a full annotation round, FLEx opens the project without complaint, `FixFwData` reports nothing, and a two-machine Send/Receive round trip reproduces the annotations on the other machine.

### Phase 3 — polish and decide the web app's future

- Excel export (ROADMAP §3) now has stable column identities; do it here.
- Move any remaining JSON-held data to native objects where a sensible representation exists (e.g. enumerated custom columns as tag lists).
- Web app: keep as the viewer for exported XML on Mac/Linux/tablets, or freeze it. Either way the renderer stays shared.

## 7. Risks and open questions

- **Project locking — largely solved by project sharing** (verified in source; see the addendum in `research/flex-anchors/chart-anchors-report.md`). A project whose **Project Properties → Sharing** tab has "Share project contents with programs on this computer" enabled is opened through LCM's shared backend, and FDAT can read *and* write while FLEx has it open: `LcmCache.GetProviderTypeFromProjectId` promotes a plain `kXML` request to `kSharedXML` whenever `LcmSettings.IsProjectSharingEnabled(projectFolder)` is true, which is exactly the remedy flexlibs documents for `FP_FileLockedError`. Peers coordinate through a global mutex plus a memory-mapped commit log and pick up each other's changes on commit. Consequences for FDAT: (a) detect the setting at startup and, if it is off and the project is locked, show the Sharing-tab remedy instead of a raw error — never toggle it silently; (b) FDAT writes only additive, FDAT-namespaced data that the FLEx UI never renders, so FLEx has nothing to repaint; the refresh that matters runs the other way — **FLEx's chart edits must reach FDAT**, and in shared mode the only way a peer learns of foreign changes is inside a commit, so FDAT polls by calling `IUndoStackManager.Save()` with no local changes (that pulls and reconciles foreign changes before testing whether anything local needs writing) and then re-exports. This requires the session to hold **no open unit of work**, so open read-only and wrap FDAT's own writes in a short `BeginNonUndoableTask`/`EndNonUndoableTask`/`Save` window. Without sharing there is no refresh path at all: the cache is a startup snapshot and FDAT must close and reopen. See addendum 2 in `research/flex-anchors/chart-anchors-report.md`; (c) a peer that is not the "master" cannot run a data migration (`LcmDataMigrationForbiddenException`, surfaced by flexlibs as `FP_MigrationRequired`), so a project needing migration must be opened in FLEx once first; (d) the sharing setting travels with Send/Receive (`SharedSettings/*.plsx` is in FLExBridge's include patterns), so a colleague's copy keeps it.
- **FieldWorks version coupling.** flexlibs loads the installed FieldWorks; a FieldWorks upgrade can require a flexlibs upgrade. Pin flexlibs per FieldWorks major version and detect mismatches at sidecar start.
- **Python packaging.** Embedded Python + pythonnet is ~40 MB; acceptable. Signing the installer (already a roadmap item) matters more once a second executable is bundled.
- **Send/Receive merge granularity.** Native objects merge per element; the JSON remainder in a custom field merges as one string, so two people editing the same text's FDAT settings between syncs produces a conflict that Chorus resolves by picking a side. Keep the JSON per text and small, and prefer native objects for anything edited often.
- **Moved-text and merged cells.** The export mapping for `ConstChartMovedTextMarker` and `MergesAfter/MergesBefore` must be compared with real exports.
- **Chart markers with punctuation.** The web app already strips adhered punctuation via `data-listref`; the sidecar should emit clean tag text and let the renderer add punctuation from `lit` elements as today.

## 8. Repository plan

New GitHub repository `rulingAnts/fdat-desktop`:

```
fdat-desktop/
  README.md
  package.json            # electron, electron-builder, (later) tests
  shell/                  # from desktop/shell here
    main.js  preload.js  host-glue.js  assets/
  sidecar/                # from desktop/sidecar here
    fdat_lcm.py  requirements.txt  README.md
  renderer/               # git subtree of fdat/docs (index.html, app.js, textchart/, assets/)
  build/                  # embedded python download script, installer config
```

Move this folder there when Phase 0 passes; leave a pointer in this repo's ROADMAP.

## 9. Hosting the web app on Cloudflare Pages (FlexText Editor suite)

Independent of the desktop app, the web app can move from GitHub Pages to Cloudflare Pages with no code changes beyond what is already in the repo:

- `docs/manifest.webmanifest` uses relative `id`/`start_url`/`scope`, the service worker registers relatively, and the external-link check derives its base path, so the app works at a root domain (e.g. `fdat.<flextext-domain>`) as well as under `/fdat/`.
- `docs/_headers` sets `Cache-Control: no-cache` for `sw.js`, `index.html`, `app.js`, the manifest and the XSL (Cloudflare honours it; GitHub Pages ignores it). This makes updates immediate instead of relying on the browser's heuristic cache.
- Setup: Cloudflare Pages → connect the GitHub repo → build command *none*, output directory `docs`. Production branch `main`; preview deployments per pull request come for free.
- Keep `.github/workflows/pages.yml` until DNS has moved, then either delete it or turn the GitHub Pages site into a redirect page (a static `index.html` with `<meta http-equiv="refresh">` to the new URL) so old bookmarks and installed PWAs keep working. Installed PWAs are origin-bound, so users will need to reinstall from the new origin; announce it in the app's About panel for a release.
- `main.js` (the Electron browser-shell) hard-codes `PROD_URL`; update it, and its `ALLOWED` list, in the same release.
- TWA / Play Store: `docs/_twa/assetlinks.template.json` needs to be served at `/.well-known/assetlinks.json` on the origin root, which is only possible on the Cloudflare domain (not under `/fdat/` on GitHub Pages).
- Integration with the FlexText Editor's sending/receiving/assignment system is out of scope; if it ever matters, the natural hook is the same bridge API as §2 (a "host" that supplies chart XML and stores annotations), which is why that boundary is kept small.
