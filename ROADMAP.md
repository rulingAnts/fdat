# FDAT – Near‑term Roadmap

This is a lightweight, developer‑facing roadmap of features we intend to ship soon. It focuses on the Discourse/Text Chart viewer, persistence, and export pipeline.

Priority ordering (top = higher priority):
1) Custom fields (columns, chips, overlays)
2) Improved import/export and local storage at all levels
3) Excel (.xlsx) export with formatting and merges
4) Restore salience band formatting options
5) In‑chart search and filtering

---

## 1) Custom fields (columns, chips, overlays)

Goal
- Let users define and apply custom fields that show up as: (a) additional chart columns, (b) inline chips alongside tokens, or (c) formatting overlays (e.g., highlight rows meeting a condition).

Scope
- Field definitions UI: name, type (text, multi‑select tags/chips, boolean, color), scope (Language / Genre / Document), and placement (column | chip | overlay).
- Row‑scoped values keyed by row GUIDs; token‑scoped values keyed by token GUIDs; document‑scoped defaults.
- Column placement rules: before/after Notes, or within a specific header group; chip placement rules: before/after specific marker classes (e.g., after listRef pairs).
- Overlay rules: conditional expressions (simple rule builder) to set background/outline per row or cell.
- Persistence integrated with existing hierarchical store (HIERARCHICAL_SETTINGS_KEY) with export/import.

Acceptance criteria
- Users can define a field and see it appear in the chart (as chosen column/chip/overlay) without breaking layout or export.
- Row/token values persist and round‑trip through settings export/import.
- HTML export includes the rendered fields (static snapshot). For Excel export, fields map to columns/cell comments or styles where applicable.

Implementation notes
- Data model
  - Document.level: { customFields: { defs: FieldDef[], rows: { [rowGuid]: { [fieldId]: value } }, tokens: { [tokenGuid]: { [fieldId]: value } } } }
  - FieldDef: { id, name, type, placement, scope, options?, group?, columnPosition?, chipClass?, overlayStyle? }
- Rendering hooks
  - Columns: extend thead/tbody render by inserting new colgroup/tds aligned to field defs; avoid mutating XSLT—add DOM augmentation post‑transform.
  - Chips: inject small spans within .interlinear flow near target pairs by selector.
  - Overlays: apply CSS classes/data‑attrs to rows/cells based on rule evaluation.
- Authoring UX: start minimal (JSON editor or simple dialog), iterate to a guided rule builder.

## 2) Improved import/export and local storage (all levels)

Goal
- Make saving, loading, and sharing settings/data reliable and granular at the Viewer, Language, Genre, and Document levels.

Scope
- Single source of truth: consolidate legacy keys into hierarchical storage with explicit versioning and migrations.
- Granular export/import: per Language, per Genre, per Document; plus a “Everything” bundle.
- Safer merges: preview changes; choose merge/replace for each subtree (abbrevs, listRefs, salience, customFields, freeTrans, notes, GUID registries).
- Backups & restore points: timestamped snapshots; easy rollback.

Acceptance criteria
- Exporting any scope produces a JSON with metadata { app, version, exportedAt, scope } and only relevant subtree.
- Importing shows a diff/summary and applies chosen merge strategy without corrupting unrelated scopes.
- Migrations run once and preserve legacy data; version bumps don’t break existing users.

Implementation notes
- Formalize a schema version (e.g., settingsVersion) within HIERARCHICAL_SETTINGS_KEY.
- Introduce utilities: getScope(settings, ctx), setScope(settings, ctx), mergeWithStrategy(existing, incoming, plan).
- Provide UI affordances near each section header (Language, Genre, Document) for scoped export/import.

## 3) Excel (.xlsx) export with formatting and merges

Goal
- Export the current chart to a native Excel file that preserves table structure, merged cells, borders, header thickness, and basic styles/ colors.

Scope
- Use a library that supports cell merges, borders, column widths, and styles (e.g., ExcelJS).
- Map HTML structure to a sheet:
  - Respect colspans as merged cells.
  - Preserve thick group borders and row end borders (sentence/paragraph).
  - Carry through bold/italic/underline and listRef/clauseMkr emphasis.
  - Respect notes column width and optional hide/endnotes mode.
- Reasonable mapping for salience color fills (with opacity approximation) and custom fields.

Acceptance criteria
- Opening the .xlsx in Excel shows merged header/body cells consistent with the chart.
- Visible borders are recognizable (thicker group rails, end-of-sentence/paragraph lines).
- No broken formulas/links; content is text with minimal styling.

Implementation notes
- Prefer ExcelJS for richer styling and merges over CSV (CSV cannot preserve merges or styling).
- Derive widths from rendered table layout where possible; otherwise choose sensible defaults.
- Provide this via Export dialog alongside current HTML export.

## 4) Restore salience band formatting options

Goal
- Re‑expose and enhance salience display controls, including opacity and an optional dedicated column.

Scope
- Controls: show/hide legend, show/hide salience column, limit color to salience cell only, opacity slider.
- Optional per‑band color and nesting retained from current definitions.
- Apply uniformly to the rendered chart and to exports (HTML; best‑effort mapping for Excel colors).

Acceptance criteria
- Toggling “Show salience column” inserts/removes a column without breaking layout.
- Opacity slider updates the color strength live.
- Legend reflects current band tree and colors.

Implementation notes
- Some UI pieces already exist; consolidate them and ensure consistent persistence in hierarchical settings.
- Ensure print rules (compact mode) behave well with the salience column and colors.

## 5) In‑chart search and filtering

Goal
- Quickly find and highlight content within a rendered chart and optionally filter rows.

Scope
- Global search box with instant highlights and next/prev navigation.
- Column/marker filters:
  - Filter by marker types (listRef, clauseMkr, rownum, note, words, glosses).
  - Per‑column text filter (e.g., limit matches to a selected column group).
- Performance on large charts; keep UI responsive.
- Keyboard support and accessible announcements for results.

Acceptance criteria
- Typing in the search shows match count and highlights matches across the chart.
- Next/prev jumps between visible matches, auto‑scrolling into view.
- Optional toggle: “Filter rows to matches” hides non‑matching rows.
- Works offline and does not modify the underlying data or export unless enabled.

Implementation notes
- DOM‑driven highlighting to avoid re‑transforming XML.
- Consider a separate overlay layer for highlights to avoid altering line breaks.
- Debounced search with a cap on traversals per frame for large charts.

---

## Nice‑to‑have (after the above)

- Export presets: Named presets capturing chart display settings (headers, notes, marker order/styles, salience display, custom fields) for quick reuse.
- Inline accessibility polish: Improve focus outlines and aria‑labels for controls within the viewer toolbar.

## Tracking and delivery

- Each item should be developed behind a feature flag/toggle in the UI and verified in both PWA and Electron shell.
- Add minimal unit or integration tests where feasible (DOM mapping utilities, export mapping functions).
- Update README with usage notes once shipped.
