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
   │ list projects / charts,      │        │ + fdat annotation store      │
   │ export chart, write back     │        │   keyed by GUIDs (§5)        │
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
| `getAnnotations(chartGuid)` / `putAnnotations(chartGuid, data)` | same | The GUID-keyed annotation document (§5). |
| `setRowNotes(rowGuid, text)` | `setRowNotes` | First write-back (Phase 2). |
| `closeProject()` | `closeProject` | Releases the LCM cache. |

The renderer keeps working without a host: `host-glue.js` does nothing unless `window.fdatHost` exists, so the same bundle still runs as the web app.

## 3. What happens to the existing web-app code

| Area in `docs/app.js` | Desktop fate |
|---|---|
| XML parsing, XSLT render, column resize, export (HTML/print) | Kept as-is. |
| Marker order/visibility/style, abbreviations, salience bands, custom columns, notes mode, free-translation display | Kept; their persistence moves from localStorage to the annotation store, keyed by FLEx GUIDs (rows: `data-row-guid`, cells: `data-cell-guid`, tokens: `data-guid`, which the XSL already passes through). |
| Free-translation *editing* | Replaced by reading `Segment.FreeTranslation`; editing stays in FLEx. |
| Hierarchical settings (language/genre/document), legacy-key sync, settings import/export, row/token GUID registries, file input | Removed in the desktop build. Language-level things (abbreviation names, marker styles) become per-project preferences in the store. |
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

## 5. Where annotations live

FLEx custom fields cannot be attached to chart rows or cells (custom fields exist for lexical entries/senses/examples/allomorphs and notebook records, not `ConstChartRow`), so FDAT-specific data needs a home. Recommended layering:

1. **Read what FLEx has.** Free translations from segments, notes from rows, markers from the Chart Markers list. No duplication.
2. **Annotation store next to the project, keyed by GUIDs.** One JSON document per chart at `<FieldWorks Projects>\<Project>\fdat\<chartGuid>.json` (or a single SQLite file), holding: salience band tree and `{ rowGuid: bandId }`, custom column definitions and `{ rowGuid: { columnId: value } }`, marker styling/order/visibility (`{ tagGuid: style }`), abbreviation names, prologue/epilogue, display prefs. Plain files, diffable, easy to back up, and independent of the FieldWorks data version. Note that Send/Receive does not sync arbitrary project files; document this, and consider Phase 3 options below if team sharing matters.
3. **Write back to FLEx only where a native field exists.** Row notes (`ConstChartRow.Notes`) first. Two FLEx-native options exist for salience bands if sharing via Send/Receive becomes important: (a) a "Salience" possibility list plus `TextTag` spans (the Tagging view's mechanism), or (b) chart markers in a dedicated column. Both are visible in FLEx itself, which may or may not be wanted; defer until there is a real need.

## 6. Phases

### Phase 0 — spike (1–2 days on a Windows machine with FieldWorks + FLExTools)

- Run `sidecar/fdat_lcm.py list-charts <Project>` and `export <Project> <chartGuid> out.xml`.
- Load `out.xml` in the web app (`npm run dev:web`, paste or pick the file). It must render like FLEx's own export of the same chart; fix the mapping in §4 until it does.
- Check whether the sidecar can open a project while FLEx has it open (see §7) and how long opening a large project takes.
- Exit criterion: a real chart renders from LCM with `guid` attributes on rows, cells and tokens.

### Phase 1 — desktop v1, read-only (new repository)

- `shell/` from this folder as the starting point: `app://` bundle serving, sidecar supervision, `fdatHost` bridge, project/chart picker in `host-glue.js`.
- Package: Electron app + embedded Python (python.org "embeddable" build) + `flexlibs`, `pythonnet` wheels; NSIS installer. FieldWorks must be installed separately (documented requirement; the sidecar reports a clear error otherwise).
- Settings: keep the renderer's localStorage for display prefs in v1 (unchanged code), so v1 is "the web app, fed by FLEx". Ship this to real users early.
- Exit criterion: a user opens FDAT, picks a project and chart, and gets the chart with resize/markers/export working, with no XML export step.

### Phase 2 — GUID-keyed annotations and first write-back

- Annotation store (§5.2) behind the bridge; the salience, custom-column, marker and abbreviation panels read/write it instead of localStorage; assignments keyed by `data-row-guid` / `data-guid` instead of row labels.
- Free translations read from segments (tooltip + inline modes keep working; the editor goes away).
- Row notes write-back (`setRowNotes`), with a "project is open in FLEx" guard.
- Remove the language/genre/document hierarchy and settings import/export from the desktop build (the split described in §3).
- Exit criterion: annotations survive re-charting in FLEx (rows moved/merged) and a project rename.

### Phase 3 — polish and decide the web app's future

- Excel export (ROADMAP §3) now has stable column identities; do it here.
- Team sharing of annotations (FLEx-native representation, or a store the team syncs some other way).
- Web app: keep as the viewer for exported XML on Mac/Linux/tablets, or freeze it. Either way the renderer stays shared.

## 7. Risks and open questions

- **Project locking.** LCM projects are opened by one process at a time unless both use the shared backend. flexlibs opens with `FLExProject.OpenProject(name, writeEnabled)`; verify in Phase 0 whether that succeeds while FLEx has the project open, and design the UI for the "close it in FLEx first" case (read-only snapshot + "Refresh" button is acceptable for v1).
- **FieldWorks version coupling.** flexlibs loads the installed FieldWorks; a FieldWorks upgrade can require a flexlibs upgrade. Pin flexlibs per FieldWorks major version and detect mismatches at sidecar start.
- **Python packaging.** Embedded Python + pythonnet is ~40 MB; acceptable. Signing the installer (already a roadmap item) matters more once a second executable is bundled.
- **Send/Receive.** The annotation store is not synced by FLEx; say so in the UI and keep the store one file per chart so it can be copied by hand or synced by other means.
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
