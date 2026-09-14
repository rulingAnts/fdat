# Where FDAT data can be anchored in a FLEx project

Scope: per-row colour bands and custom-column values (must link to specific `ConstChartRow`s), per-marker styling/visibility/order, per-chart settings (title, prologue/epilogue, display preferences) — all synced by Send/Receive (FLExBridge/Chorus) without touching the FLEx data model. Sources are the cloned `liblcm`, `FieldWorks` (sparse), `flexbridge`, `flexlibs`, `flextools`, plus GitHub-hosted Chorus files; paths are repo-relative under the scratchpad `src/` root. The chart-anchors report (`/home/user/fdat/desktop/research/flex-anchors/chart-anchors-report.md`) takes precedence where it overlaps and is cited as "CA §x.y".

**Verification status.** Apart from the CA report's spot-checked claims (CA 3.1, 3.7, 3.9, 2.11) and eight findings marked *[confirmed]* below, every finding in this report is *[unchecked]*: a single agent's reading of the code, not re-verified. Two findings were *[refuted]* and are used here only in their corrected form (custom-property collection strategies are keyed by `name`, not singleton — implication unchanged; `LexEntry` alone has a hand-written `RemoveAReferenceCore` clearing custom atomic refs — implication unchanged). Nothing here has been executed against a real project. Each section says where it rests on unchecked material; Section 10 lists what needs a real project.

---

## 1. Summary and recommendation

### 1.1 The short answer

| FDAT data | Recommended anchor | Why (and why not the alternatives) |
|---|---|---|
| **Row → salience band** | Custom **ReferenceCollection** field on `ConstChartRow` (FDAT enforces ≤1 member) pointing at an item of an FDAT-owned, unowned custom list (`CmCustomItem`, `IsProtected=true`); band colours in the item's `ForeColor`/`BackColor`. Fallback: a custom `String` field holding a band code. | Keyed by row GUID, invisible in FLEx, merged per row by FLExBridge. **Not** `ReferenceAtomic` (a deleted band leaves a dangling `objsur`; LCM does not clear custom atomic refs). **Not** `TextTag` (segment-anchored, not row-anchored; visible in Tagging tab, both concordances and Lists; incomplete 3+-segment support). |
| **Row → custom-column values** | One custom `String` field per FDAT column on `ConstChartRow` (`FDAT_Col_<slug>`), or one `String` field holding a small per-row JSON object. Column definitions live with chart settings (below). | Row-scoped, granular merge (per field per row), no FLEx UI reads them. `ConstChartRow.Notes`/`Label` are FLEx-owned (CA 1.11). |
| **Marker colour / visibility** | The marker's own `CmPossibility.ForeColor`, `BackColor`, `UnderColor`, `UnderStyle`, `Hidden` (BGR ints; FLEx neither renders nor exposes them). Order = the list's own order. | Native slots, synced with the `ChartMarkers.list`, keyed by marker GUID. FLEx's chart does not read them (no visual side effect). |
| **Marker bold/italic/size, abbreviation glosses** | Bold/italic/size: in the per-chart or per-project FDAT settings JSON keyed by marker GUID. Glosses: `CmPossibility.Description` (MultiString, user-visible in Lists) if the linguist should see them; otherwise settings JSON. | No native per-item font slot other than styles; styles are heavyweight (name-collision hazard, §6). |
| **Per-chart settings** (title, prologue, epilogue, display options, column defs) | Custom fields on `DsConstChart`: a `String` field `FDAT_Settings` (JSON) plus, if prologue/epilogue need rich text, a custom **OwningAtomic StText** field `FDAT_Text` (merges per paragraph). | Chart GUID is the durable anchor (CA §2). `DsConstChart.Name/Description` are unused by FLEx (CA 1.7) but are FLEx's fields; prefer explicit FDAT fields. |
| **Project-wide FDAT prefs** (default preset, schema version) | One item in the FDAT custom list (e.g. `FDAT Settings` list, single `CmCustomItem`, JSON in `Description` or a custom `String` field on `CmCustomItem`). | Unowned custom lists sync as their own `.list` file; nothing else FLEx-shaped is project-global and free. |
| **Per-user display state** (column widths, notes side) | FDAT's own local settings — **not** the project. | FLEx keeps the equivalent in its local PropertyTable; Send/Receive should not carry it. |

All of the above stays inside FLEx's own extension points (custom fields through `IFwMetaDataCacheManaged.AddCustomField`, possibility lists, built-in colour ints), is serialised generically by LCM, and is split/validated/merged generically by FLExBridge (CA 3.7, spot-checked). The residual design rule is: **anchor to the chart and its rows, not to Segments, Texts or tags**, which matches the owner's "starting data is the Text Chart tab" framing.

### 1.2 The owner's linked-JSON idea: verdict

**Viable as a mechanism, not recommended as the primary store.** Facts (all *[unchecked]*, consistent across four independent findings):

- A file under `<project>/LinkedFiles/Others/**` (any subfolder) is included by FLExBridge's explicit include list; `.json` is not in the exclude list (`.xml`, `.zip`, `.flextext` are) — `flexbridge/src/LibFLExBridge-ChorusPlugin/Infrastructure/FlexFolderSystem.cs:18-45,61-63`.
- No LCM object is needed for it to sync (`hg add -I …`) — Chorus `HgRepository.cs` `AddAndCheckinFiles`.
- Hard cap **1 MiB** per file for extensions no handler claims; an oversize file is silently excluded/`hg forget`ten with only a log warning — Chorus `LargeFileFilter.cs:50-54,81-100,145-178`.
- **No merge**: FLExBridge's handler declines `.json`, Chorus falls to `DefaultFileTypeHandler`, which records an `UnmergableFileTypeConflict` and keeps the merging machine's copy (`WeWin`) — the other user's edits are silently dropped from the working copy — Chorus `DefaultFileTypeHandler.cs:42-59`, `Synchronizer.cs:826-829`.
- Only syncs when `LangProject.LinkedFilesRootDir` is the default in-project folder — `liblcm/src/SIL.LCModel/DomainImpl/OverridesLangProj.cs:94-116`; FLExBridge roots the repo at the `.fwdata` folder.
- "Text can have more than one media file": yes, `Text.MediaFiles` (OA `CmMediaContainer`) owns a collection of `CmMediaURI`s — `liblcm/src/SIL.LCModel/MasterLCModel.xml:1632-1656,3902-3906` — but `CmMediaURI.MediaURI` is a raw URI string documented as an ELAN placeholder, shown read-only under "Media" in the Text Info tab (`FieldWorks/Src/Common/Controls/DetailControls/MediaInfoSlice.cs:158-190`), exported into `.flextext` (`InterlinearExporter.cs:884-895`), and in practice an absolute per-machine path. Using it as a pointer to FDAT's JSON is a semantic misuse; do not.

Concrete design **if** it is used (e.g. as an export/cache or for a v1 without LCM writes):

```
<project>/LinkedFiles/Others/fdat/<chartGuid>.json      one compact file per chart, refuse to write > ~900 KB
no LCM pointer object (sync does not need one)           or, optionally, a CmFile in a CmFolder "FDAT" under
                                                         LangProject.MediaOC (InternalPath "Others/fdat/<guid>.json")
                                                         via DomainObjectServices.FindOrCreateFolder/File — never CmMediaURI
resolve the folder as LcmFileHelper.GetOtherExternalFilesDir(lp.LinkedFilesRootDir); refuse/warn when that is
outside cache.ProjectId.ProjectFolder
```

Given whole-file last-merger-wins semantics, it must never hold data two colleagues edit between syncs. Model objects give per-row/per-field merging for free; that is decisive.

### 1.3 Spike first, on a real project (Windows, FLEx + flexlibs)

1. **Programmatic custom fields on chart classes.** With FLEx closed, from flexlibs/pythonnet call `IFwMetaDataCacheManaged.AddCustomField("ConstChartRow", "FDAT_Band", ReferenceCollection, CmPossibility.clsid, …, listRoot)` and `("DsConstChart", "FDAT_Settings", String, 0, …, kwsAnal)`; write values; `Save()`; reopen in FLEx (chart tab, Lists, Custom Fields dialog must be unaffected); run FixFwData (clean); Send/Receive two machines (definition file + values arrive; both-add on different rows merges without conflict).
2. **Dangling-reference behaviour**: delete a band item in Lists on machine B, sync, load on A — confirm the `ReferenceCollection` value is simply gone and nothing throws; confirm a `ReferenceAtomic` variant does leave a dangling `objsur` (to justify avoiding it).
3. **Shared backend**: enable "Share project contents with programs on this computer"; open FDAT alongside FLEx; write a row custom field while the chart tab is open; observe the ~10 s pickup, and provoke the "cannot save your changes" dialog by having unsaved FLEx edits on the same row.
4. **Export equivalence**: rewrite `fdat_lcm.py` per §7, diff against "Export Text Chart → Discourse XML" of the same chart.
5. **(Only if the JSON file is kept)** commit a 2 MB `.json` under `LinkedFiles/Others/fdat/` and confirm it is dropped; edit the same file on two machines and confirm the WeWin outcome.

---

## 2. Anchor points table

Legend: OA/OC/OS = owning atomic/collection/sequence; RA/RC/RS = reference atomic/collection/sequence; "S/R" = Send/Receive; "merge" = FLExBridge 3-way merge granularity.

| Object / property | What it can hold | Owner, cardinality | S/R and merge | Visible / editable in FLEx | FLEx behaviour and risks | Citation |
|---|---|---|---|---|---|---|
| **`DsConstChart`** (CmMajorObject) — custom field | Any LCM type: String, MultiUnicode, Integer, RA/RC, OA StText… | one chart per (text, template) in `DsDiscourseData.Charts` (OC) | `Linguistics/Discourse/Charting.discourse`; per-object by GUID; custom prop keyed `Custom_DsConstChart_<name>`; `Str` atomic, OA StText per paragraph | No UI anywhere (no layout for the class; dialog filters it out) | Chart GUID stable for the life of the text; charts are never deleted except with the text. Definition must be on the concrete class (not abstract `DsChart`). | CA 1.7-1.8, 2.5, 3.1-3.9; `flexbridge/…/DomainServices/FieldWorksMergeServices.cs:208-323` |
| `DsConstChart.Name` (MultiUnicode) / `.Description` (MultiString) | free text | inherited | `AUni` per WS / `AStr` atomic | Never read/displayed/exported by FLEx | Usable, but they are FLEx's fields; a future FLEx could surface them. Prefer explicit FDAT custom fields. | CA 1.3, 1.7, 1.9 |
| **`ConstChartRow`** — custom field | String / MultiUnicode / Integer / RC / OA StText | rows in `DsConstChart.Rows` (OS, order significant) | same file; per-row by GUID; each custom field merges as its own element (`Str` atomic per field) | No UI (no DataTree, dialog filters, chart VC renders fixed fragments) | Row GUID survives in-place edits; row auto-deletes when emptied unless Notes non-empty; recreated with a new GUID in `RemoveMissingMarker`; wiped by Clear-from-here/cleanup. Deleting the row deletes its custom values cleanly (`DeleteObjectBasics`). | CA 1.11, 2.6-2.13, 3.4-3.5; `liblcm/src/SIL.LCModel/DomainImpl/CmObject.cs:2530-2573` |
| `ConstChartRow.Notes` (String, one WS) | user prose (TsString) | one per row | `Str` atomic | Yes — the Notes column, in-place edited; exported as `<note>`; dumped to `SavedNotes.txt` on delete | FLEx-owned; only write it for the user's explicit "edit notes" action. A hyperlink run there would show in exports/SavedNotes. | `FieldWorks/Src/LexText/Discourse/MakeCellsMethod.cs:118-123,513-524`; `ConstituentChartLogic.cs:2935-2957` |
| `ConstChartRow.Label` (String) | row number | — | — | Yes | Rewritten by `RenumberRows` on every insert/delete/EOS change — never a key. | `FieldWorks/Src/LexText/Discourse/ConstituentChartLogic.cs:1727-1765` |
| **Cell parts** (`ConstChartWordGroup`, `ConstChartTag`, …) — custom field | as above | `ConstChartRow.Cells` (OS) | per object by GUID | No UI | GUIDs are the least stable: merging into an occupied cell deletes the source word group; word moves shrink/grow/create groups. Do not key on them. | CA 2.7-2.10; `ConstituentChartLogic.cs:4780-4786,3769-3880` |
| `ConstChartTag.Tag` → FDAT possibility (a "Salience" column) | one possibility per cell | — | per object | Yes — rendered as orange `(abbr)` in the chart and exports | Column must be a template leaf or FLEx rewrites it (`ReportAndFixBadCellPart`); non-marker possibilities cannot be unchecked from the marker menu. Visible metadata; violates "markers" semantics. | CA 4.1-4.6; `MakeCellsMethod.cs:156-192,302-325` |
| **`ChartMarkers` list items** (`CmPossibility`) `ForeColor/BackColor/UnderColor/UnderStyle/Hidden` | BGR ints (0xC0000000 = none), 0-127, bool | items of `DsDiscourseData.ChartMarkers` (OA list) | `Linguistics/Discourse/ChartMarkers.list`; per item by GUID, each basic prop its own element | Not displayed anywhere in the examined FLEx (chart VC never reads them; Lists editor filter hides them) | Native, synced, invisible slots for marker colour/visibility. Confidence medium: only the sparse checkout was searched for renderers. | `liblcm/src/SIL.LCModel/MasterLCModel.xml:352-378`; `FieldWorks/DistFiles/Language Explorer/Configuration/Lists/Edit/DataEntryFilters/completeFilter.xml:6-16`; `ConstChartVc.cs:73-140` |
| `CmPossibility.Name/Abbreviation/Description/Discussion`, list order, `SortSpec`, `IsProtected` | text, rich text (StText), ordering, delete guard | — | same file | Yes — Lists area | Users can rename/reorder; in-use `IsProtected` items cannot be deleted. Key by GUID. | `MasterLCModel.xml:306-385`; `liblcm/src/SIL.LCModel/DomainImpl/OverridesCellar.cs:1720-1729` |
| **Unowned custom list** (`CmPossibilityList`, items `CmCustomItem`) | FDAT vocabularies: bands, column value sets, a settings item | unowned; created by `ICmPossibilityListFactory.CreateUnowned(name, ws)` | `General/UserDefinedLists/UserList-<guid>.list`; per item by GUID; both-add of items is conflict-free (unsorted lists: `AmbiguousInsertConflict` note, both kept) | Yes — Lists area ("Delete Custom List" available) | Name must be project-unique; set `ItemClsid`, `Depth`, `WsSelector`, `IsClosed` as the dialog does. Deleting the whole list deletes every custom field whose `ListRootId` is that list (CA 3.6). | `liblcm/src/SIL.LCModel/DomainImpl/FactoryAdditions.cs:1545-1571`; `FieldWorks/Src/xWorks/CustomListDlg.cs:596-620`; `FieldWorks/Src/xWorks/DeleteCustomList.cs:97-119` |
| **`Segment`** — custom field (String/MultiUnicode via UI; any type via LCM) | per-sentence values | `StTxtPara.Segments` (OS) | `Linguistics/TextCorpus/Text_<guid>.textincorpus` | Yes — offered in the Custom Fields dialog (Texts & Words → Segment); appears as a tickable line in every interlinear tab's *and the chart tab's* Configure Interlinear Lines dialog; editable freeform line in Baseline/Gloss/Analyze; exported as item type `custom` | Chart body/export silently drop it (non-word-level spec). Per sentence, not per row (rows cross/split segments). User-visible machine data. | `FieldWorks/Src/LexText/Interlinear/InterlinLineChoices.cs:560-608` *[confirmed]*; `InterlinVc.cs:2475-2500,2765-2800` |
| `Segment.Notes` (OS `Note.Content` MultiString), `Segment.Reference` (String) | free text | many per segment | same file; `AStr` atomic per note | Notes: yes (interlinear Note line); Reference: read-only (import only) | Pollutes the linguist's notes; per sentence. Not recommended. | `MasterLCModel.xml:259-304` |
| **`TextTag`** (`StText.Tags`, OC) → possibility in `LangProject.TextMarkupTags` | one possibility over a word span (segment + analysis index) | any number per text | `Text_<guid>.textincorpus`; both-add conflict-free by GUID | Yes: Tagging tab (bracketed abbreviation row per tag type; users can apply/remove), simple Concordance "Tagging" line, Complex Concordance "Tag" constraint *[confirmed]*, Lists "Text Markup Tags". Not in Print view or interlinear exports. | Maintained by `AnalysisAdjuster` like word groups; same-type overlaps replaced by user tagging; 3+-segment spans partly unsupported (`NotImplementedException` path). Not row-anchored. | `liblcm/src/SIL.LCModel/MasterLCModel.xml:655-671`; `FieldWorks/Src/LexText/Interlinear/InterlinTaggingChild.cs:399-438,521-559,625-652`; `ComplexConcTagDlg.cs:42-83` |
| **`Text`** — custom field (incl. OA StText) | per-text JSON | `Text` is unowned, top-level | `Text_<guid>.textincorpus`; OA StText merges per paragraph (`Str` atomic per `StTxtPara`), not as one string | **No**: dialog never offers `Text`; `Text/FullInformation` layout has no `customFields` hook; DataTree/Avalonia generate slices only from that hook *[confirmed]* | Invisible and undeletable in FLEx (PLAN §5 option 1's two assumptions are wrong). Text-level, not chart-level; cross-file GUID references to rows are plain text. | `FieldWorks/DistFiles/Language Explorer/Configuration/Parts/Cellar.fwlayout:62-77`; `FieldWorks/Src/Common/Controls/DetailControls/DataTree.cs:2309-2325,2487-2532`; `flexbridge/…/DomainServices/CmObjectNestingService.cs:108-141` *[confirmed]* |
| `Text.Description` ("Comment") / `Text.Source` (MultiString) | rich text incl. hyperlink runs | one each | `AStr` atomic | Yes — Text Info tab | User-editable prose; not for machine data. | `FieldWorks/DistFiles/Language Explorer/Configuration/Parts/CellarParts.xml:173-192` |
| `Text.MediaFiles` → `CmMediaContainer.MediaURIs` (OC `CmMediaURI.MediaURI` Unicode) | URI strings | many per text | same file | Read-only list under "Media" in Info tab; round-trips via `.flextext` | ELAN placeholder; absolute paths; not a linked-file mechanism. Do not use. | `MasterLCModel.xml:1632-1656`; `MediaInfoSlice.cs:158-190`; `BIRDInterlinearImporter.cs:1372-1403` |
| **`RnGenericRec`** (Notebook record) with `Text` RA + custom fields (dialog-supported) | nine StText fields, custom fields of all six types | `RnResearchNbk.Records` | `Anthropology/…`; per record | Yes — Notebook | Legit container for per-text prose but clutters the user's Notebook; per text not per chart. | `MasterLCModel.xml:2323-2489`; `AddCustomFieldDlg.cs:122-124` |
| **`StStyle`** (`LangProject.Styles`, OC) | named character/paragraph formatting (`Rules`) | project-wide | `General/FLExStyles.style`; by GUID; **duplicate names fail validation and roll back S/R** | Yes — Styles dialog | Only for run-level formatting inside TsStrings; create with fixed GUIDs and check-before-create. | `flexbridge/…/Handling/Common/StyleFileTypeHandlerStrategy.cs:37-77`; `liblcm/src/SIL.LCModel.FixData/DuplicateStyleFixer.cs:20-79` |
| **`CmBaseAnnotation`** (`LangProject.Annotations`) with `BeginObject` RA any object, `CompDetails` Unicode ("data … used by specialized computer agents … XML") | machine data on any object | OC | `General/FLExAnnotations` file exists in the include list | Unknown | Model-sanctioned but FLEx 7+ moved away from annotations; FLEx tolerance and FLExBridge handling of new `CmAnnotationDefn`s unverified. Not recommended without a test. | `MasterLCModel.xml:759-950`; `FlexFolderSystem.cs:96-100` |
| **`LinkedFiles/Others/**` file** | any bytes ≤ 1 MiB | filesystem | opaque; `UnmergableFileTypeConflict`, merging machine wins | Not shown (unless linked from a TsString) | See §4. | `FlexFolderSystem.cs:61-63`; Chorus `LargeFileFilter.cs`, `DefaultFileTypeHandler.cs` |
| `CmFile` in `CmFolder` under `LangProject.Media/Pictures/FilePathsInTsStrings` | `InternalPath` relative to LinkedFiles | OC | nested in `General/LanguageProject.langproj` (inferred); both-add keeps duplicates | Not shown unless referenced | Optional bookkeeping pointer for a sidecar; extends FLEx backup to relocated LinkedFiles. | `MasterLCModel.xml:219-226,1244-1256,5329-5353`; `liblcm/src/SIL.LCModel/DomainServices/BackupRestore/ProjectBackupService.cs:240-275` |

---

## 3. Custom fields on chart classes, Segment and RnGenericRec

### 3.1 What LCM allows vs what FLEx's dialog offers

- **LCM**: `LcmMetaDataCache.AddCustomField(className, fieldName, CellarPropertyType, destClass)` only checks the class exists and the name does not collide with a built-in field; flid = `clid*1000+500+n` — `liblcm/src/SIL.LCModel/Infrastructure/Impl/LcmMetaDataCache.cs:920-965` (CA 3.1, spot-checked). Public API with help/ws/listRoot overloads: `IFwMetaDataCacheManaged.cs:62-150`. Any `CmObject` subclass serialises `<Custom name=…>` values generically (Guid, Boolean, Integer, GenDate, Time, Unicode, String, Binary, OA/RA `objsur`, Multi*, all four vector types) — `liblcm/src/SIL.LCModel/DomainImpl/CmObject.cs:3050-3152,3177-3330`.
- **FLEx dialog**: Lexicon → LexEntry/LexSense/LexExampleSentence/MoForm; Texts & Words → **Segment only, Single-line text only**; Notebook → RnGenericRec — `FieldWorks/Src/xWorks/AddCustomFieldDlg.cs:109-150`. Existing fields on other classes are filtered out (`:129-133`), so they can be neither seen nor deleted there.
- **Dialog type mapping to copy** (so programmatic fields look normal): SingleLineText → `String` (ws `kwsAnal`/`kwsVern`) or `MultiUnicode`; Multiparagraph → `OwningAtomic` DstCls `StText`; Number → `Integer`; Date → `GenDate`; List ref → `ReferenceAtomic`/`ReferenceCollection` DstCls `CmPossibility` + `ListRootId` — `AddCustomFieldDlg.cs:395-437`.

### 3.2 Exact recommended definitions

| Field | Class | Type | DstCls / ListRoot | WS | Notes |
|---|---|---|---|---|---|
| `FDAT_Settings` | `DsConstChart` | `String` | — | `kwsAnal` | JSON: version, title, column definitions, display options, marker font styles keyed by marker GUID. Single `Str`, atomic merge — keep small, edit rarely. |
| `FDAT_Text` (optional) | `DsConstChart` | `OwningAtomic` | `StText` | — | Prologue/epilogue as paragraphs; merges per paragraph. |
| `FDAT_Band` | `ConstChartRow` | `ReferenceCollection` | `CmPossibility`, ListRoot = FDAT bands list GUID | — | FDAT keeps ≤1 member. |
| `FDAT_Col_<slug>` | `ConstChartRow` | `String` | — | `kwsAnal` | One per custom column; or a single `FDAT_Cells` String with per-row JSON if columns are many/dynamic. |

Rules: fixed, distinctive names (avoid future built-in collisions — migration 7000069 renamed clashing custom fields, `liblcm/src/SIL.LCModel/DomainServices/DataMigration/DataMigration7000069.cs:356-405`); create idempotently by `GetFieldId2(clid, name, true)` first; never rename or retype (retype = delete-then-add on one machine only); create on **concrete** classes only (`FdoClassInfo` caches concrete classes; `BasicCustomPropertyFixer` keys on exact `rt` class name — CA 3.8-3.9); prefer optional-element types (String, Multi*, references, OA) over value types (Integer/GenDate need every instance marked modified so a default `val="0"` is written — `liblcm/src/SIL.LCModel/FieldDescription.cs:336-418`).

### 3.3 How definitions and values sync

- Definitions: `.fwdata <AdditionalFields><CustomField class= name= type= [destclass wsSelector helpString listRoot label]/>` → FLExBridge splits into `FLExProject.CustomProperties` (always written, included right after `FLExProject.ModelVersion`), merged atomically per `(name, class)`, re-inserted on Receive — `flexbridge/src/LibFLExBridge-ChorusPlugin/Infrastructure/FlexFolderSystem.cs:47-48`; `DomainServices/FLExProjectSplitter.cs:73-124`; `DomainServices/FieldWorksMergeServices.cs:75-82`; validator `Handling/CustomProperties/CustomPropertiesTypeHandlerStrategy.cs:36-93` (does not check the class is known).
- Values: loaded into FLExBridge's `MetadataCache` before any merge (unknown class names silently skipped) — `Infrastructure/MetadataCache.cs:463-508`; the discourse handler passes `addCustomPropertyInformation: true` (CA 3.7). Merge strategy `Custom_<Class>_<name>`, keyed by `name` attribute; type-specific like built-ins — `FieldWorksMergeServices.cs:208-323`; `Handling/FieldWorksElementToMergeStrategyKeyMapper.cs:47-58`. `CmObjectValidator` accepts `<Custom>` for any declared property: basic value types need exactly two attributes (`name`, `val`); OA validates the single nested child; RA/RC check `objsur` structure only (no existence check) — `DomainServices/CmObjectValidator.cs:83-131,541-604,654-696`.
- OA StText custom field *[confirmed nesting]*: nested as `<Custom name="…"><StText guid><Paragraphs><ownseq class="StTxtPara"…>` exactly like `Text.Contents`; `Paragraphs` order-significant, each `Str` atomic ⇒ merges **per paragraph**. A production fixture exists (Notebook record `<Custom name='Like'><StText>`) — `flexbridge/src/LibFLExBridge-ChorusPluginTests/Handling/Common/StyleContextGeneratorTests.cs:76-111`. PLAN §5/§7 "merges as one string" is wrong for this type.
- Both-add on custom RC fields from two machines: kept as a union, no conflict (guid-keyed `refcol`, order irrelevant; LCM writes collections guid-sorted) — `FieldWorksMergeServices.cs:212-215,398-402`; `liblcm/src/SIL.LCModel/Infrastructure/Impl/DataSortingService.cs:103-120`.

### 3.4 Deletion and dangling references (why ReferenceCollection, not ReferenceAtomic)

- `CmPossibility.CanDelete` never consults incoming references; only `IsProtected` (and template/column/text-markup checks) blocks deletion — `liblcm/src/SIL.LCModel/DomainImpl/OverridesCellar.cs:1720-1729` *[confirmed]*. FLEx's delete UI is gated solely by `CanDelete` — `FieldWorks/Src/xWorks/RecordClerk.cs:1508-1523`; `FieldWorks/Src/FdoUi/Dialogs/ConfirmDeleteObjectDlg.cs:207`.
- Custom **RC/RS** fields: the vector is an `IReferenceSource`, registers incoming refs on fluff-up, and `RemoveAReference` removes the deleted item as a normal registered modification — `liblcm/src/SIL.LCModel/DomainImpl/Vectors.cs:664,780-808,821-825`. Clean loss of the assignment, no dangling data; does not trigger the row's delete-if-empty (checks `kflidCells` only — `OverridesLing_Disc.cs:27-49`).
- Custom **RA** fields: `GetCustomPropertyForSDA` never calls `AddIncomingRef` for disk-loaded values; generated `RemoveAReferenceCore` iterates only model atomic props (`ConstChartRow` has none; `LexEntry` is the sole hand-written exception) — `CmObject.cs:2860-2872,3504-3513`; `liblcm/src/SIL.LCModel/LcmGenerate/RemoveAReferenceCore.vm.cs:11-25`; `OverridesLing_Lex.cs:3418-3427`. The dangling `objsur` is written to `Charting.discourse`, passes FLExBridge validation, and reading it after reload throws `KeyNotFoundException` (`liblcm/src/SIL.LCModel/Infrastructure/Impl/CmObjectIdentityMap.cs:327-348`) — a FLEx or FDAT crash unless FixFwData has stripped it.
- FixFwData: `OriginalFixer` removes any `objsur` (custom included) with an unknown guid and drops the emptied `<Custom>`; `CustomPropertyFixer` strips undefined `<Custom>` elements; an orphaned custom-owned StText is deleted over successive passes — `liblcm/src/SIL.LCModel.FixData/FwDataFixer.cs:63-66,138-147,272-322`; `CustomPropertyFixer.cs:40-80`. **But** FLExBridge runs FixFwData only after an actual 3-way merge (`PrepareForPostMergeCommit`), not on a pull-only `SimpleUpdate` — `flexbridge/…/Infrastructure/FlexBridgeSynchronizerAdjunct.cs:66-124`. CA 3.10's "runs before Send/Receive" should be read as "after a merge, before commit".
- Deleting a custom field definition: mirror `FieldDescription.UpdateCustomField` — delete owned StTexts (`DeleteObjOwner`) / clear values first, then `DeleteCustomField` — `FieldDescription.cs:355-388`; `LcmMetaDataCache.cs:1010-1030`.

### 3.5 Programmatic-creation risks

- FLEx itself warns that S/R of definition **changes** is fragile and recommends one designated person adds fields; concurrent additions of the same name are the failure mode — `FieldWorks/Src/xWorks/xWorksStrings.resx:897-911`; `AddCustomFieldDlg.cs:183-189`. FDAT: create once, first user S/Rs immediately, others S/R before first use.
- FLEx refuses to add fields while another app shares the project — `FieldWorks/Src/xWorks/XWorksViewBase.cs:715-723`. FDAT should create fields only as the sole opener (FLEx closed).
- flexlibs has no create/delete helper; `GetFieldID`, `GetCustomFieldValue`, `LexiconSetFieldText/Integer/ListField*` work on any hvo/flid (String, Multi*, Integer, CmPossibility refs only) — `flexlibs/flexlibs/code/FLExProject.py:898-1000,1060-1180,1349-1402`. Creation and OA/StText handling go through pythonnet directly (`IFwMetaDataCacheManaged(project.MetaDataCacheAccessor).AddCustomField(...)` inside a UOW, then `Save()`).
- `Segment` fields: user-visible everywhere (§2 table); a non-string or fixed-WS Segment field would `Debug.Fail` in `InterlinLineChoices.CreateSpec` and hit `AddStringProp` on a non-string flid in the texts tabs — `InterlinLineChoices.cs:962-990`; `InterlinVc.cs:2798`. If ever used, make it String with `kwsAnal`.
- `RnGenericRec` fields: fully dialog-supported and displayed; only relevant if FDAT wants a Notebook-visible per-text page. Not needed for chart-scoped data.

---

## 4. Linked file design (if a sidecar file is used at all)

**Where it must live.** `<project>/LinkedFiles/{AudioVisual|Others|Pictures}/**.*` or `SupportingFiles/**.*` — nothing else in the project folder syncs (explicit include policy) — `flexbridge/…/Infrastructure/FlexFolderSystem.cs:14-17,61-64`. `LinkedFiles/Others` is precisely where FLEx's own "Insert › Link to File" copies user files — `FieldWorks/Src/FwCoreDlgs/MoveOrCopyFilesController.cs:46-53,100-140`; folder constants in `liblcm/src/SIL.LCModel/LcmFileHelper.cs:39-45,150-154`. Extension must not be `.xml`, `.zip`, `.flextext` (globally excluded, exclude wins) — `FlexFolderSystem.cs:18-45`.

**Limits.** 1 MiB per file (`LargeFileFilter.Megabyte` fallback for unknown extensions; the 2022 "10 MB" raise applies only to image/audio handlers); oversize → excluded, `hg forget` if tracked, warning in the S/R log only — Chorus `LargeFileFilter.cs:50-54,81-100,145-178`; `DefaultFileTypeHandler.cs:76-90`. Chorus decides by extension only, not content.

**Merge.** None for `.json`: `UnmergableFileTypeConflict` note in `<file>.NewChorusNotes`, merging machine's copy kept (`WeWin` default) — Chorus `DefaultFileTypeHandler.cs:42-59`, `Synchronizer.cs:826-829`, `MergeSituation.cs:106-118`. A `.txt` file would get diff3 line merging with no size cap but throws on overlapping conflicts (`ChorusMerge` exit 1; aftermath unverified) — Chorus `TextFileTypeHandler.cs:21-33,49-106`.

**Referencing it from the model** — what FLEx does with each:

| Pointer | Mechanism | FLEx behaviour | Verdict |
|---|---|---|---|
| None (by convention) | `hg add -I` picks it up by path | Nothing; not in FLEx backup unless LinkedFiles is in-project and "include linked files" is ticked (then everything under it is included) | Simplest; fine |
| `CmFile` in a `CmFolder` "FDAT" under `LangProject.MediaOC` (`InternalPath` = `Others/fdat/<guid>.json`) | `DomainObjectServices.FindOrCreateFolder/File` | Shown nowhere (unreferenced CmFiles are invisible); included in backup even when LinkedFiles is relocated; two machines can create duplicate CmFiles (no uniqueness) | Optional bookkeeping |
| External-link run (`kodtExternalPathName` + relative path, style `Hyperlink`) in e.g. `Text.Description` + `CmFile` under `FilePathsInTsStringsOA` | `StringServices.MarkTextInBldrAsHyperlink(…, LinkedFilesRootDir)`; `FindOrCreateFile` | Clickable in Info tab; `Process.Start` on `.json` opens whatever Windows associates; path is user-editable prose; FLEx rewrites the path when LinkedFiles moves | Only for a human-facing "open in FDAT" link; not for machine discovery |
| `CmMediaURI` in `Text.MediaFilesOA.MediaURIsOC` | raw URI string | Listed read-only under "Media" in the Text Info tab, exported into `.flextext`, never opened unless a Segment references it; absolute path per machine | Do not use |

Citations: `liblcm/src/SIL.LCModel/DomainServices/DomainObjectServices.cs:2289-2318`; `liblcm/src/SIL.LCModel/DomainServices/StringServices.cs:56-93,131-200`; `FieldWorks/Src/Common/SimpleRootSite/VwBaseVc.cs:225-278`; `FieldWorks/Src/Common/RootSite/RootSiteEditingHelper.cs:1097-1165`; `MediaInfoSlice.cs:158-190`; `ProjectBackupService.cs:120-135,240-275`.

**Preconditions FDAT must check.** `lp.LinkedFilesRootDir` inside `cache.ProjectId.ProjectFolder` (else warn: nothing syncs); FLEx is not notified of file changes after S/R (re-read on demand); writing the file does not require an LCM transaction and does not trip LCM's "file modified by another program" save guard (that guard watches only the `.fwdata`) — `liblcm/src/SIL.LCModel/Infrastructure/Impl/XMLBackendProvider.cs:518-535`.

---

## 5. Tags and lists

**TextTag semantics.** Five properties: `BeginSegment`/`EndSegment` (RA Segment), `Begin/EndAnalysisIndex` (int into `Segment.Analyses`), `Tag` (RA CmPossibility); owned in `StText.Tags` (OC) — `MasterLCModel.xml:655-671,489`. Created by `ITextTagFactory.CreateOnText(begPoint, endPoint, tagPoss)` with no check that `tagPoss` is in `TextMarkupTags` — `liblcm/src/SIL.LCModel/DomainImpl/FactoryAdditions.cs:963-993`. Maintained by `AnalysisAdjuster` (indices shifted, endpoints moved, deleted when the words go) — `liblcm/src/SIL.LCModel/DomainImpl/AnalysisAdjuster.cs:302-307,521-746`. Spans may cross a segment boundary; 3+-segment spans are only partly supported (lookup checks Begin/End segments only; `ChangeToDifferentIndex` throws `NotImplementedException` if both ends must move across segments) — `InterlinTaggingChild.cs:625-652`; `OverridesLing_Wfi.cs:104-127`.

**Text Markup Tags structure.** `LangProject.TextMarkupTags` (OA list) is strictly two-level: top-level "tag types" (`RRG Semantics`, `Syntax` by default), sub-possibilities = tags; the Lists tree handler refuses deeper nesting and promotions/demotions — `liblcm/src/SIL.LCModel/DomainImpl/OverridesLangProj.cs:565-606`; `FieldWorks/Src/xWorks/RecordBarTreeHandler.cs:805-866`. FLEx refuses to delete a type/tag any `TextTag` references or the only tag type — `OverridesCellar.cs:1707-1728`; `FdoUiCore.cs:1765-1790`. If FDAT ever creates the list, call `ILangProject.GetDefaultTextTagList()` first (an empty list gets replaced) — `OverridesLangProj.cs:565-606`.

**Where FDAT tags would surface** (all *[unchecked]* except the concordance dialog *[confirmed]*): Tagging tab (submenu "Salience" with bands, checkable; bracketed abbreviation on an extra row under the words — `InterlinTaggingVc.cs:101-166,291-310`), simple Concordance "Tagging" line (`ConcordanceControl.cs:930-932,1208-1226`), Complex Concordance "Tag" constraint and matcher (`ComplexConcTagDlg.cs:42-83`; `ComplexConcParagraphData.cs:199-222` — an "any tag" search hits them too), Lists › Text Markup Tags. **Not** in Print view (`InterlinPrintVc : InterlinVc`, empty `AddExtraBundleRows` — `InterlinVc.cs:1757-1762`) nor in any interlinear export (`InterlinearExporter.cs` has no TextTag code; `FlexInterlinear.xsd` has no tag element). Same-type overlaps: user tagging deletes the existing tag of the same type — `InterlinTaggingChild.cs:521-559`.

**Why tags are a poor fit here.** They are (a) anchored to word spans, not `ConstChartRow` (FDAT would need a matching rule between tag span and the union of the row's word groups, and row edits in the chart would not move the tag); (b) stored in `Text_<guid>.textincorpus`, away from the chart; (c) visible, hand-editable clutter in three views the colleague uses daily; (d) hostage to the 3+-segment limitation. They remain the right tool only for word-level data the linguist should see in the Tagging tab.

**Custom lists** (bands, column value sets, settings item): unowned `CmPossibilityList` (`Owner == null` is FLEx's definition of "custom"), `ItemClsid = CmCustomItem`, created by `CreateUnowned(guid, name, ws)`; mirror the Add Custom List dialog's `DisplayOption`, `PreventDuplicates`, `IsSorted`, `WsSelector`/`IsVernacular`, `Depth` (1 flat / 127 hierarchical), unique `Name` — `FactoryAdditions.cs:1545-1571`; `CustomListDlg.cs:271-286,596-620`. `IsClosed=true` stops users inserting items (Configure disabled) — `RecordList.cs:3762-3768`. Sync: `General/UserDefinedLists/UserList-<guid>.list`, validated and 3-way merged — `flexbridge/…/Contexts/General/UserDefinedLists/UserDefinedListsBoundedContextService.cs:22-42`; `Handling/Common/ListFileTypeHandlerStrategy.cs:31-66`. Use fixed GUIDs for the list and its seed items so two machines that both run FDAT first produce "both added same" rather than duplicates. Remember the `DeleteCustomList` cascade (CA 3.6): deleting the FDAT bands list deletes `FDAT_Band` on every row.

**Colour fields.** `ForeColor/BackColor/UnderColor` are Win32 BGR ints (`ColorTranslator.ToWin32`), `0xC0000000` (= −1073741824) means unspecified; `UnderStyle` 0-127; `Hidden` bool — `liblcm/src/SIL.LCModel.Core/Text/ColorUtil.cs:109-114`; `DataMigrationServices.cs:634-642`. No examined FLEx view renders them; the Lists editor hides them; the chart takes all colours from the installed `ConstituentChartStyleInfo.xml` and never reads possibility colours — `ConstChartVc.cs:73-140,206-210`. So PLAN §5's "colour is used by some FLEx views" is unsupported (medium confidence — sparse checkout), and FDAT colours stored there are FDAT-only.

---

## 6. Rich text, notes and styles

- **`ConstChartRow.Notes` vs `Segment.Notes`.** Row Notes: one non-multilingual TsString per clause row, edited in the chart's Notes cell (the only editable cell), exported as `<note>`, dumped to `SavedNotes.txt` on delete — `MakeCellsMethod.cs:118-123,441-444,493-524`; `ConstituentChartLogic.cs:2935-2957`. Segment Notes: a sequence of `Note` objects (MultiString `Content`) per sentence, shown in the interlinear Note line (hidden unless enabled) — `InterlinDocForAnalysis.cs:148-156,2350-2361`. A row can cover part of a segment and a segment can span rows, so segment notes never map 1:1 to rows. FDAT should write Row Notes only as the user's explicit edit of that field.
- **TsString links.** External-file/URL link = `ktptObjData` starting with `kodtExternalPathName` (4) + path, plus `ktptNamedStyle = "Hyperlink"`; serialised as `externalLink="…"` on the `<Run>`; validated and merged atomically by FLExBridge — `liblcm/src/SIL.LCModel.Core/KernelInterfaces/TextServ.idh:343-347`; `TsPropsSerializer.cs:257-275`; `flexbridge/…/DomainServices/CmObjectValidator.cs:346-390`. Store the LinkedFiles-relative form (`Others\fdat\x.json`) — `liblcm/src/SIL.LCModel/LinkedFilesRelativePathHelper.cs:126-149`. **Object-GUID hot links** (`kodtNameGuidHot`/`kodtOwnNameGuidHot`) must not be written: `FwBaseVc.GetStrForGuid` throws for anything but footnotes/pictures and `DoHotLinkAction` handles only external paths — `FieldWorks/Src/Common/RootSite/FwBaseVc.cs:204-218`; `VwBaseVc.cs:169-172,225-227`. The supported deep link to an object is an external-link run whose URL is a `silfw://localhost/link?…tool=chartmarkEdit&guid=…` FieldWorks link — `FwLinkArgs.cs:39-84,307-335`; `LinkListener.cs:337-348`; tool id `chartmarkEdit` from `Lists/areaConfiguration.xml:95-96`.
- **Character styles.** `StStyle` in `LangProject.Styles`; create via `IStStyleFactory.Create(styleList, name, context, structure, function, isCharStyle, userLevel, isBuiltin)` or the fixed-GUID overload + `LcmStyleSheet.PutStyle` for `Rules` — `FactoryAdditions.cs:1673-1697`; `LcmStyleSheet.cs:348-380`. Synced as `General/FLExStyles.style`; **two same-named styles with different GUIDs fail validation and roll back the whole S/R**, and `DuplicateStyleFixer` deletes the later one — `StyleFileTypeHandlerStrategy.cs:37-77`; Chorus `Synchronizer.cs:397-412`; `DuplicateStyleFixer.cs:20-79`. Whether the chart's Notes cell honours run-level named styles is unverified (`OpenNoteCell` applies cell-level "normal" formatting). Recommendation: FDAT does not need styles at all for its own data; if it ever styles Notes text, use deterministic GUIDs and look up by name before creating.
- **flexlibs** wraps only plain `TsStringUtils.MakeString`; rich text, links and styles go through the .NET APIs directly — `flexlibs/flexlibs/code/FLExProject.py:68-69,170-192`.

---

## 7. Chart export format and corrections

### 7.1 Exact "Export Text Chart → Discourse XML" output (`DiscourseExporter`, no transform: `Plain.xml` mode `doNothing` — `FieldWorks/DistFiles/Language Explorer/Export Templates/Discourse/Plain.xml:1-4`; `DiscourseExportDialog.cs:72-95,163-174`)

XmlTextWriter, UTF-8, text NFC-normalised. Structure (`DiscourseExporter.cs:83-120`):

```xml
<document>
  <chart>
    <row type="title1">                                     <!-- one title row per template depth, n from 1 -->
      <cell cols="1"><main /></cell>                         <!-- row-number header, ALWAYS empty -->
      <cell cols="K"><main><lit lang="en">Group</lit></main></cell> …   <!-- K = leaf count; a leaf directly under
                                                                          the root is labelled here and gets an empty
                                                                          placeholder cell in lower title rows -->
      <cell cols="1"><main><lit lang="analWs">Notes</lit></main></cell> <!-- only in title1; empty cell in lower rows;
                                                                          FIRST in the row when NotesColumnOnRight=false;
                                                                          whole row reversed for RTL -->
    </row>
    <row type="title2"> … leaf names as <lit lang=…> … </row>
    <row [endPara="true" | endSent="true"] type="normal|dependent|speech|song" [id="1a"]>
                                                              <!-- attribute order endPara/endSent, type, id; only ONE of
                                                                   endPara/endSent (endPara wins); id = Label, omitted if empty -->
      [<cell cols="1"><main><note lang="…">…</note></main></cell>]      <!-- notes cell here if notes-on-left -->
      <cell cols="1"><main><rownum lang="en">1a</rownum></main></cell>
      <cell [reversed="true"] cols="N"><main>…</main>[<glosses><gloss lang="analWs">…</gloss>…</glosses>]</cell> …
                                                              <!-- one per template column; merged cells span N; empty
                                                                   columns <cell cols="1"><main /></cell>, or
                                                                   <main><lit lang="analWs">---</lit></main> in columns
                                                                   whose English name is "Subject" or "Verb" -->
      [<cell cols="1"><main><note lang="…">…</note></main></cell>]      <!-- default: notes on right; empty Notes still
                                                                          yields an empty <note lang/> (inferred) -->
    </row>
  </chart>
  <languages>                                                <!-- AFTER chart; only WSs actually used -->
    <language lang="xyz" font="Charis SIL" [vernacular="true"] [RightToLeft="true"]/>
  </languages>
</document>
```

Contents of `<main>`, in `CellsOS` order (space separators dropped):

| Cell part | Output | Source |
|---|---|---|
| `ConstChartWordGroup` | per **wordform** occurrence (punctuation skipped): `<word [moved="true"] lang="vernWs">baseline text</word>`; gloss buffered and emitted after `</main>` as `<gloss lang="analWs">` (`***` when no gloss). Only Word + Word Gloss lines are exported. | `DiscourseExporter.cs:146-170,257-285`; `OverridesLing_Disc.cs:209-231` |
| `ConstChartTag` with `TagRA` | `<lit noSpaceAfter="true" lang="analWs">(</lit><listRef lang="ws">ABBR</listRef><lit noSpaceBefore="true" lang="analWs">)</lit>`; text = Abbreviation in the first analysis WS that has one, else Name. In a Subject/Verb cell a `<lit>---</lit>` precedes it. | `ConstChartVc.cs:277-298,670-725`; `ConstituentChartStyleInfo.xml:15` |
| `ConstChartTag` with `TagRA=null` | `<lit lang="analWs">---</lit>` | `MakeCellsMethod.cs:340-372` |
| `ConstChartClauseMarker` | `<lit noSpaceAfter="true">[</lit><clauseMkr target="1b" lang="en">1b</clauseMkr>[<lit noSpaceAfter="true">-</lit><clauseMkr target="1c" lang="en">1c</clauseMkr>]<lit noSpaceBefore="true">]</lit>` — first and last dependent-row labels only | `ConstChartVc.cs:435-444,573-594`; `DiscourseExporter.cs:130-139` |
| `ConstChartMovedTextMarker` | `<moveMkr lang="userWs" [targetFirstOnLine="false"]>Preposed|Postposed</moveMkr>` (not `<<`/`>>`); the target group's words carry `moved="true"` | `DiscourseExporter.cs:150-152,287-297`; `ConstChartVc.cs:266-276,421-433` |
| Dependent/speech/song rows | `<lit noSpaceAfter="true">[</lit>` before the first word group of a `StartDependentClauseGroup` row, `<lit noSpaceBefore="true">]</lit>` after the last word group of an `EndDependentClauseGroup` row; list-ref tags stay outside; an auto-missing Subject/Verb column after the last part moves the close bracket into that cell | `MakeCellsMethod.cs:125-133,244-276,330-404` |
| `lit` spacing | `noSpaceBefore` if it starts with `]` or `)`; `noSpaceAfter` if it ends with `[`, `(` or `-`; attributes precede `lang`; direction marks/empties dropped | `DiscourseExporter.cs:242-248,306-312` |
| Merged cells | `MergesBefore` → one cell covering all unoccupied columns up to and including the part's column (`reversed="true"` if >1); `MergesAfter` → `cols` = next part's column − this column (one less if that next part `MergesBefore` and ≥2 empty columns), or all remaining columns | `MakeCellsMethod.cs:194-242,455-469` |

### 7.2 Corrections to `PLAN.md` §4 (`/home/user/fdat/desktop/PLAN.md:80-96`)

| Row | Correction |
|---|---|
| Template → title rows | One `title{n}` row per template **depth**, not exactly two; leaves under the root get placeholder cells; Notes header only in `title1`; row-number header empty; Notes cell side is a per-user PropertyTable setting (`notesOnRight`), not data. |
| `ConstChartRow` | `Label` also feeds `id="…"`; only one of `endPara`/`endSent`; attribute order `endPara|endSent, type, id`. |
| `ConstChartWordGroup` | Iterate **wordform occurrences** (skip punctuation), use segment **baseline text** (not `WfiWordform.Form`), `lang` on every element, `cols` always present, `moved="true"` on moved groups; merge widths per the algorithm above. |
| `ConstChartTag` | Wrapped in `(`/`)` `lit`s; `---` auto-missing markers in empty Subject/Verb cells. |
| `ConstChartClauseMarker` | Two `clauseMkr` elements with `target=` plus `-` lit and `[`/`]` lits — not `"1b-1c"` text. |
| `ConstChartMovedTextMarker` | `<moveMkr>Preposed/Postposed</moveMkr>`, not `<lit><<</lit>`. |
| `<languages>` | After `<chart>`, with `font`, `vernacular`, `RightToLeft`; only used WSs. |
| Word identity | "`<word guid>` per analysis" is wrong: the IAnalysis GUID is shared by every occurrence of the same wordform and is replaced in place when glossed (§8.2). |

Also §5 (PLAN.md:112-131): "colour is used by some FLEx views" — no evidence; Text custom field is **not** offered by the dialog and **not** shown in the Info tab; OA StText merges per paragraph, not as one string; the parenthetical "not offered on … `Segment`" is inverted (Segment is offered). §7: "the JSON remainder in a custom field merges as one string" — true only for String/Unicode fields.

### 7.3 Corrections to `/home/user/fdat/desktop/sidecar/fdat_lcm.py` (`export_chart_xml`, lines 189-271)

| Lines | Issue | Fix |
|---|---|---|
| 129-138 `template_columns` | Assumes exactly two levels | Collect leaves depth-first at any depth (`CollectColumns`, `ConstituentChartLogic.cs:900-921`); build header rows per depth with placeholder cells (`MultilevelHeaderModel.cs:16-80`). |
| 140-157 `analyses_of` | Yields every analysis incl. punctuation; walks `para.SegmentsOS` by index | Iterate `wg.GetOccurrences()` (wordforms only, `OverridesLing_Disc.cs:209-231`) or filter `HasWordform`. |
| 158-176 | Form from `WfiWordform.Form` | Use the occurrence's `BaselineText` (segment text) in the baseline WS. |
| 196-204 | `<languages>` before `<chart>`, no `font`/`RightToLeft`, all current WSs | Emit after `</chart>`, only WSs used, with `font=ws.DefaultFontName`, `vernacular`, `RightToLeft`. |
| 208-219 | Bare-text title cells `#`/`Row`/`Notes` in both rows; no `<main>`/`<lit>`; no `cols` on some cells | Emit `<cell cols="1"><main /></cell>` for the row-number header, `<main><lit lang=…>` for labels, Notes only in `title1`, `cols` always. |
| 222-227 | Both `endSent` and `endPara`; `type` before them; no `id` | `endPara` else-if `endSent`, then `type`, then `id=Label` (omit if empty). |
| 239 | `<rownum>` without `lang="en"`, no `cols` on the cell | `<cell cols="1"><main><rownum lang="en">…</rownum></main></cell>`. |
| 230-238, 240-264 | Cells bucketed per leaf; `MergesBefore/After` ignored; no `cols`; no `---`; no `lang` | Implement `MakeCellsMethod` width algorithm; emit `cols`; auto-missing markers for English "Subject"/"Verb" leaves; `lang` on `word`/`gloss`/`lit`/`listRef`. |
| 247 | `<word guid=analysisGuid>` | `guid` = `segGuid:index` (or `wgGuid:ordinal`), analysis GUID in a separate attribute (§8.2). |
| 249-252 | `<listRef>` without `(`/`)` lits; `guid` = part GUID | Add the lits; keep the part GUID under a distinct attribute name if needed, since FLEx emits none. |
| 253-256 | Single `"1b-1c"` `clauseMkr`, no `target`, no brackets | Two `clauseMkr target=`, `-` lit, `[`/`]` lits. |
| 257-258 | `<lit><<</lit>` | `<moveMkr>Preposed|Postposed</moveMkr>` (+ `targetFirstOnLine="false"` when an earlier moved group exists in the target's row) and `moved="true"` on the target group's words. |
| (missing) | Dependent/speech/song bracket lits | Implement `FindCellPartToStart/EndDependentClause` rules. |
| 265-266 | Empty Notes → `<main/>` | FLEx emits an empty `<note lang="…"/>` (inferred); renderer tolerant either way. |
| 103-119 `charts()` | `text.Title` — `Text` has `Name`, not `Title` (`MasterLCModel.xml:240-244`) | Use `text.Owner`… actually `chart.BasedOnRA` is the **StText**; the Text is `stText.Owner` (`IText.Name`). |

Also the renderer XSLT (`/home/user/fdat/docs/textchart/textchart-to-html.xsl:246-258,300-330`) only treats `title1`/`title2` as headers and takes the label from `cell[1]`, so notes-on-left and 3-level charts mis-render; either normalise in the sidecar (notes last, collapse header levels) or extend the XSLT.

---

## 8. GUID stability and re-anchoring

### 8.1 Stability by object (from CA §2, plus this investigation)

| Object | Stable across | Lost / replaced when |
|---|---|---|
| `DsConstChart` | everything but text deletion | text deleted |
| `ConstChartRow` | in-place edits, column changes, `CellsOS.MoveTo` (same object re-inserted), renumbering | row emptied (auto-delete unless Notes non-empty); `RemoveMissingMarker` recreation (new GUID, only Label/flags carried, no word group present); "Clear chart from here on"; `CleanupInvalidChartCells` on open (baseline edits); possibly Undo/Redo (unverified) |
| `ConstChartWordGroup` | moves into empty cells | merge into occupied cell (source deleted), word moves (shrink/grow/create), baseline edits |
| `ChartMarkers` / custom-list items | rename, reorder | user deletion (unless `IsProtected`) |
| `Segment` | unaffected sentences (reused on reparse) | sentence merges delete the second segment |
| Word token | — | has **no GUID**; identity = `(Segment, index)` — `liblcm/src/SIL.LCModel/DomainServices/AnalysisOccurrence.cs:25-45,74-78` *[confirmed]* |

Citations: `ConstituentChartLogic.cs:1399-1422,1446-1515,2426-2470,2813-2965,3482-3537,4634-4669,4780-4786`; `liblcm/src/SIL.LCModel/DomainImpl/Vectors.cs:2077-2100`; `OverridesLing_Disc.cs:27-48`.

### 8.2 Token identity for the sidecar

The IAnalysis GUID is shared by every occurrence of the same wordform ("may well not be unique in the file" — `InterlinearExporter.cs:1093-1102`) and is replaced in place when the user glosses (`StTxtPara.cs:1078-1090`). `AnalysisAdjuster` keeps `(segment, index)` valid only for objects it collects — `TextTag` and `ConstChartWordGroup` (`AnalysisAdjuster.cs:302-307`; `InterfaceAdditions.cs:326-330`) — and Make/Break-phrase and full reparse rewrite `Segment.Analyses` with no adjustment at all (`AnalysisOccurrence.cs:252-297`; `ITextUtils.cs:426-441`). FLExBridge merges `Segment.Analyses` atomically (`FieldWorksMergeServices.cs:245-252`), so indices can drift after a conflicting sync.

Therefore: emit `data-guid = "<segmentGuid>:<index>"` (render-time identity), plus the parent word-group GUID and ordinal, plus the analysis GUID as descriptive data. Persist nothing per token unless anchored to a FLEx-maintained `IAnalysisReference` (the containing word group, or — if a durable per-token GUID is truly needed — a one-token `TextTag`, with all the visibility caveats of §5).

### 8.3 Re-anchoring strategy for rows

Store per row: `rowGuid` (primary). On load, for every stored row GUID not found in `chart.RowsOS`:

1. Compute a **live** signature for each current row from its first `ConstChartWordGroup`: `(chartGuid, columnGuid, BeginSegment.Guid, BeginAnalysisIndex, baseline text of the first occurrence)`. Read these from the word group at reconciliation time (FLEx maintains them), never from a stored snapshot; FLEx's own `IsAnalogousTo` compares column + baseline text (`OverridesLing_Disc.cs:80-100`).
2. Match the orphaned data by the signature stored at last save; tie-break by row ordinal/Label, then by Notes text. Flag, do not silently re-bind, when only ordinal/Label match (the `RemoveMissingMarker` path has no word group; only position and Label carry over).
3. Keep unmatched data in a "detached" bucket in `FDAT_Settings` (per chart) for the user to reassign or discard; never delete on the first miss (rows can reappear via Undo, unverified).
4. Recompute signatures on every save.

For band/column values stored as custom fields **on the row itself**, steps 1-3 are only needed for the recreation/wipe cases; in-place edits carry the fields with the row automatically.

---

## 9. Concurrency, locking, write discipline, validation, deep links

- **Backends.** Non-shared `kXML`: exclusive `<Name>.fwdata.lock`, second opener gets `LcmFileLockedException` (`XMLBackendProvider.cs:371-396`). Shared `kSharedXML`: chosen automatically when `ProjectLexiconSettings.ProjectSharing` is on (FLEx Project Properties › Sharing › "Share project contents with programs on this computer") — `liblcm/src/SIL.LCModel/LcmCache.cs:209-226`; `LcmSettings.cs:66-74`; `FwProjPropertiesDlg.cs:139-145`. flexlibs requests `kXML` and is upgraded only by that setting — `flexlibs/flexlibs/code/FLExLCM.py:72-110`. Pre-check with `ProjectLockingService.IsProjectLocked(path)` (`ProjectLockingService.cs:62-67`).
- **Shared mode mechanics.** Per-project mutex + memory-mapped commit log; the master peer (first opener) alone rewrites the `.fwdata`; a non-master's commits are durable on disk only after the master's next save; FLEx auto-saves ~10 s after the last save and 2 s after last activity — `SharedXMLBackendProvider.cs:19-36,127-158,377-488`; `UnitOfWorkService.cs:226-262`. FLEx polls the commit log in that save; reconciled foreign changes are applied as a non-undoable UOW with ordinary `PropChanged`s — `ChangeReconciler.cs:200-303` *[confirmed]*. Custom-field-only changes generate a `PropChanged` that no chart notifier displays: no redraw, no crash (`ChangeReconciler.cs:769-800,912-990`; `FieldWorks/Src/views/VwNotifier.cpp:424-482`). Lists editor and marker abbreviations update live; the Tagging tab likely shows stale tags until Refresh (private cache, inferred).
- **The conflict rule (design-critical).** A foreign change to any object the FLEx user has unsaved edits on — even a different field — is irreconcilable (only `DateModified` and `OwningCollection` differences are tolerated); FLEx then pops "FieldWorks cannot save your changes…" and halts auto-save until the user Refreshes, reverting their unsaved work — `ChangeReconciler.cs:55-166`; `UnitOfWorkService.cs:329-434`; `FieldWorks/Src/FdoUi/Dialogs/ConflictingSaveDlg.resx:121`. So an FDAT save of `FDAT_Band` on a row the linguist is charting, or of `FDAT_Settings` on a chart they are adding rows to, can trigger it. Mitigations: write chart-object custom fields only when FLEx is closed or after an explicit "save to project" with a warning; keep FDAT's unsaved window short (UOW + `Save()` per action); or place hot data on objects FLEx never dirties (an OA StText's `StTxtPara`s owned by `DsConstChart` — the chart itself then gets only a `DateModified` change, which is tolerated — an inferred, untested property).
- **Write recipe.** `NonUndoableUnitOfWorkHelper.Do(cache.ActionHandlerAccessor, () => …)` then `IUndoStackManager.Save()` per user action (`NonUndoableUnitOfWorkHelper.cs:26-166`; `UnitOfWorkService.cs:284-305`) — not flexlibs' single session-long `BeginNonUndoableTask` (`FLExProject.py:256-290`), which cannot `Save()` mid-session. Never migrate (`DisableDataMigration=True`; on `FP_MigrationRequired` tell the user to open in FLEx) — `FLExProject.py:225-247`. Never touch `.fwdata` directly while any LCM process holds it (FLEx's next save silently refuses on a changed timestamp — `XMLBackendProvider.cs:518-535`). Load the installed FieldWorks assemblies so the model version matches (`FLExLCM.py:22-30`).
- **Schema changes.** Create custom fields, lists and (if any) styles only as the sole opener; FLEx blocks its own dialog with multiple peers (`XWorksViewBase.cs:715-723`) and warns that S/R of definition changes is fragile.
- **Send/Receive.** FLEx refuses S/R while other apps are connected and drops its lock for FLExBridge (`FLExBridgeListener.cs:310-361`); FLExBridge writes an empty `<Name>.fwdata.lock` during S/R (`SendReceiveActionHandler.cs:69-75`). FDAT must dispose its cache before S/R and report "project locked" rather than crash.
- **Validation.** `FixFwData.exe` (`SIL.LCModel.FixData.FwDataFixer`) rewrites the closed `.fwdata`; run only when no process holds the project (`FwDataFixer.cs:16-47`; `FieldWorks/Src/Utilities/FixFwData/Program.cs:20-47`). FLExBridge runs it only after real merges (§3.4).
- **Deep links.** `silfw://localhost/link?` + URL-encoded `database=<proj>&tool=interlinearEdit&guid=<TextGuid>&tag=ConstituentChart&InterlinearTab=ConstituentChart` (the same shape FLEx's own history links use; external launch untested) — `FwLinkArgs.cs:39-84,307-333`; `InterlinMaster.cs:512-517,1343-1360`; `LinkListener.cs:582-586`; flexlibs `BuildGotoURL` (`FLExProject.py:478-520`). Note the guid is the **Text**'s (`IText`), not the StText or chart.

---

## 10. Open questions needing a real project or unreachable documents

**Need a real project (Windows, FLEx + flexlibs):**
1. Programmatic custom fields on `ConstChartRow`/`DsConstChart` end to end: creation from pythonnet, FLEx open/close, FixFwData, two-machine S/R, both-add merge on custom RC fields, and whether a non-master shared peer may call `AddCustomField` at all.
2. Dangling-reference behaviour for custom RA vs RC fields after the target possibility is deleted (same session and after reload); whether `ICmObjectRepository.GetObject` throws for a GUID missing after S/R.
3. Shared-backend UX: the ~10 s pickup, the conflict dialog when FLEx has unsaved edits on the same row/chart, whether chart-logic caches throw when a foreign reconcile deletes a displayed row, and whether typical user projects have ProjectSharing enabled.
4. Byte-for-byte equivalence of the rewritten sidecar export with "Discourse XML"; empty-Notes `<note>` emission; behaviour with extra enabled interlinear lines (release-build `Debug.Assert`).
5. Whether Undo/Redo restores deleted rows/word groups/TextTags with their original GUIDs.
6. If the linked-file route is kept: the 1 MiB cap on the installed Chorus build, `**.*` matching nested `fdat/` subfolders, WeWin outcome on a two-machine edit, and whether the `UnmergableFileTypeConflict` note is surfaced to users.
7. Whether the chart's Notes cell renders run-level character/Hyperlink styles; whether an externally launched `silfw://` link lands on the chart tab.
8. Whether a user layout override (`<project>/ConfigurationSettings/Text.fwlayout` with a `customFields` placeholder) loads and syncs, should FDAT ever want its Text-level data visible.
9. Whether custom OA StText content (JSON in `StTxtPara.Contents`) survives TsString normalisation/escaping unchanged and is left alone by paragraph/segment machinery.

**Unreachable here (software.sil.org / downloads.languagetechnology.org blocked):** *Technical Notes on FieldWorks Send-Receive.pdf* (also shipped at `<FW code dir>/Helps/Language Explorer/Training/` and under Help › Resources in FLEx), the FLEx 9.1 Conceptual Model PDF, *Python for FlexTools and FLEx 9.1*, the help topic `khtpProjectProperties_Sharing`, and the FieldWorks technical-documents page. The owner's own notes in `../refs/sil-docs-notes.md` (CA appendix) already cover the S/R sync scope, the 10 MB image/audio limit, per-object merge and the `CustomField` type list; nothing found here contradicts them.