# Where FDAT data can be anchored in a FLEx project

**Scope.** Where FDAT can put per-row data (salience bands, custom-column values), per-marker presentation, and per-chart settings so Send/Receive carries it and the FLEx data model stays intact. It also specifies, in §7, the exact XML that FLEx's own "Export Text Chart" produces, and corrects `desktop/PLAN.md` §4 and `desktop/sidecar/fdat_lcm.py` against it. Sources are the cloned `liblcm`, `FieldWorks` (sparse), `flexbridge`, `flexlibs` trees; citations are repo-relative under `/tmp/claude-0/-home-user-fdat/fb1d7f18-f46f-5695-b961-37c4221bc0d5/scratchpad/src`.

**Provenance.** `desktop/research/flex-anchors/chart-anchors-report.md` ("CA" below) takes precedence where we overlap; its claims 3.1, 3.7, 3.9 and 2.11 were spot-checked by you and I do not re-verify them. Except where marked **[confirmed]**, everything here is single-pass code reading and is unverified against a real project.

---

## 1. Summary and recommendation

### 1.1 The short answer

**For v1, build only three things:** the FDAT possibility list + `FDAT_Band` (ReferenceCollection) on `ConstChartRow`, `FDAT_ColumnValues` (String) on `ConstChartRow`, and `FDAT_ChartSettings` (String) on `DsConstChart`. Everything else in this table — the `DsDiscourseData` field, the `StText` prologue/epilogue fields, marker colours on the possibilities, the JSON backup — is deferred until those three survive a two-machine round trip.

| FDAT data | Anchor | Why |
|---|---|---|
| **Row → salience band** | Custom **ReferenceCollection** field `FDAT_Band` on `ConstChartRow`, targeting an FDAT-owned unowned `CmPossibilityList` | Row GUID is the only per-row identity; LCM clears reference *collections* when the target item is deleted, and does **not** clear reference *atomics* (§3.4). FDAT writes ≤1 member, but a concurrent S/R can produce two (both-add is kept silently, §3.4): on load pick deterministically (lowest item GUID), rewrite to one member, and surface the discarded value. A plain `String` band code would avoid the list-deletion cascade (§3.7.4) entirely; the list is preferred because band items carry stable GUIDs, are visible and renameable in Lists, and merge per element — accept the cascade risk in exchange, and keep the JSON backup for it. |
| **Band definitions** (label, colour, order) | Items in that FDAT-owned custom list: `Name`/`Abbreviation`/`Description`, colour in `BackColor`/`ForeColor` (BGR ints), `IsProtected = true`, explicit order index in the settings JSON | List items have stable GUIDs, sync as `General/UserDefinedLists/UserList-<guid>.list`, and merge per element. Their colour fields are inert in every FLEx UI searched (sparse checkout — §5.4, medium confidence). Never encode order in the collection itself (§3.4). |
| **Row → custom-column values** | One custom **String** field `FDAT_ColumnValues` on `ConstChartRow` holding a small per-row JSON object | Merge unit is one row's one field; the "merges as one string" risk is per-row, which is acceptable. Per-column fields are only acceptable if the column set is fixed at install time, because adding a column later is a custom-field **definition** change — the one S/R operation FLEx itself warns about (§3.7.1). |
| **Column definitions** | Inside the per-chart settings JSON (below) | Not per-row; no native slot. |
| **Per-marker colour, and project-wide show/hide** | The marker `CmPossibility`'s own `ForeColor`/`BackColor` (and `Hidden`, only when the intent really is project-wide) | CA addendum 5: native, typed, per-marker, synced with `ChartMarkers.list`, keyed by GUID, and unread by FLEx. Caveats CA names: dormant ≠ reserved, and these are project-wide. |
| **Per-marker bold/italic/size, per-chart colour or visibility overrides, FDAT-specific grouping and order** | Inside `FDAT_DiscourseSettings` on `DsDiscourseData` (the same JSON as project-level settings), keyed by marker GUID — **note this is the one unverified anchor; see the row below** | No native per-possibility slot for weight/size; and colour/`Hidden` cannot vary per chart. **Do not reorder `ChartMarkersOA.PossibilitiesOS`**: that is FLEx's own cell menu order (§1.3). |
| **Per-chart settings** (title, prologue, epilogue, notes mode, display options) | Custom **String** field `FDAT_ChartSettings` on `DsConstChart` holding JSON; add custom **OwningAtomic → StText** fields `FDAT_Prologue` / `FDAT_Epilogue` if prologue/epilogue need rich text | A custom field is FDAT-namespaced, invisible to users, and removable in one step; `DsConstChart.Description` is the zero-schema alternative with the same atomic merge granularity and no definition to sync, but it is semantically "the chart's description" and a future FLEx could surface it (§2, CA 1.7). Prefer the custom field; fall back to `Description` only if a team refuses any schema change. The `StText` variant merges **per paragraph**, not as one string — **[unchecked]**, derived from strategy code (§3.6, spike §1.4 step 6). |
| **Project-level FDAT settings** (marker presentation, abbreviation glosses, band ordering) | Custom **String** field `FDAT_DiscourseSettings` on `DsDiscourseData` | The singleton that owns charts, templates and markers; it sits in the `<header>` of `Linguistics/Discourse/Charting.discourse` (CA 5.2). **Unverified**: no test exercises a custom field on the header object — spike it. Fallback: put the same JSON on `DsConstChart` and accept duplication. |
| **Everything, again, as backup** | `<project>/LinkedFiles/Others/fdat/<chartGuid>.<peerId>.json` | Insurance against custom-field/custom-list deletion, which is unrecoverable from the model. Bounded cadence and its limits: §1.2. |

All chart-object writes require project **Sharing** to be on, and writing to a `DsConstChart` or `ConstChartRow` on which the FLEx user has unsaved edits can cost them that unsaved work (§9.2). Keep write windows ≤1 s, prefer rows the user is not editing, and treat §1.4 step 10 as a gate on writing chart-level fields at all while FLEx is open.

Everything above is carried by Send/Receive: custom-field **definitions** in `FLExProject.CustomProperties` (an explicit include, written immediately after the model-version file), custom-field **values** inside the object's `<Custom name="…">` element in `Charting.discourse`, the FDAT list as its own `.list` file, and the JSON as an opaque file under `LinkedFiles/Others`. `flexbridge/src/LibFLExBridge-ChorusPlugin/Infrastructure/FlexFolderSystem.cs:47-48,57-63,77`.

### 1.2 The owner's linked-JSON idea — verdict

**Viable, but only as a per-peer backup, never as the store of record.** Three facts decide it:

1. **A 1 MiB hard cap that fails silently.** Unknown extensions fall back to `LargeFileFilter.Megabyte = 1048576`; an oversized file is added to the exclude list and `hg forget`-ten, with only a warning line in the S/R log — colleagues simply stop receiving updates. `https://raw.githubusercontent.com/sillsdev/chorus/master/src/LibChorus/sync/LargeFileFilter.cs` (lines 50-54, 67, 81-100, 145-178).
2. **It only syncs at the default project location.** The hg repo root is the folder containing the `.fwdata`; if `LangProject.LinkedFilesRootDir` has been relocated to a share, no linked file syncs at all. `liblcm/src/SIL.LCModel/DomainImpl/OverridesLangProj.cs:94-116`; `flexbridge/src/FLEx-ChorusPlugin/Infrastructure/ActionHandlers/SendReceiveActionHandler.cs:52-55`.
3. **Per-peer files give you N copies with no defined winner.** The design that makes the file safe (below) is exactly the design that makes it useless as a single source of truth: after a sync you hold one file per colleague per chart, each a snapshot of a different moment, with nothing in them to arbitrate. The model is the arbiter; the files are insurance.

It *does* sync: `LinkedFiles/Others/**.*` is an explicit include pattern and `.json` is not in the exclude list (which does exclude `**.xml`, `**.flextext`, `**.zip`). `flexbridge/.../FlexFolderSystem.cs:18-45,61-63`. No LCM object is needed — Chorus adds files by path (`hg add -I …`), per `https://raw.githubusercontent.com/sillsdev/chorus/master/src/LibChorus/VcsDrivers/Mercurial/HgRepository.cs` (AddAndCheckinFiles).

*Why the shared-filename variant is off the table:* no handler claims `.json`, so `DefaultFileTypeHandler.Do3WayMerge` records an `UnmergableFileTypeConflict` and, because Chorus always merges in `WeWin` mode, keeps the merging machine's copy — the other side's edits survive only in Mercurial history. `https://raw.githubusercontent.com/sillsdev/chorus/master/src/LibChorus/FileTypeHandlers/DefaultFileTypeHandler.cs` (lines 42-59); `.../sync/Synchronizer.cs` (lines 826-829). A per-peer filename removes that entirely: two colleagues never write the same path, so Chorus never merges these files.

**Concrete design** (this is CA addendum 3, endorsed and refined):

```
<project>/LinkedFiles/Others/fdat/<chartGuid>.<peerId>.json      # ≤ ~900 KB, one per chart per peer
```

- **Cadence and retention.** Write at most once per session close or on an explicit "Back up now"; exactly one file per peer per chart, **overwritten in place, never appended and never versioned by FDAT**. Chorus's maintainers are explicit that one oversized committed file kills the repository for the whole team (`LargeFileFilter.cs` header), so an unbounded series of ~1 MiB revisions is the failure this rule exists to prevent.
- **What it does not protect against.** It is itself user-deletable, capped at 1 MiB, absent from the repo when LinkedFiles has been relocated, and never merged. It is a last resort after a custom field or custom list is deleted — not a synchronisation channel.
- Compute the folder as `LcmFileHelper.GetOtherExternalFilesDir(lp.LinkedFilesRootDir)` (`liblcm/src/SIL.LCModel/LcmFileHelper.cs:39-45,150-154`) and **warn** when `LinkedFilesRootDir` is outside `cache.ProjectId.ProjectFolder`.
- Stamp: schema version, project GUID, chart GUID, peer/user id, UTC timestamp, LCM model version, and — critical — **row re-anchoring keys** beside every row GUID (§8.3).
- **Restore is user-initiated and diff-first.** A colleague's backup arriving by S/R may be older than the model data.
- Write order: LCM fields → `Save()` → then the JSON with the `DateModified` token observed after that save.
- **Do not point at it from the model.** See §4.2: `CmMediaURI` is an ELAN placeholder and a misuse; a `CmFile` is legitimate but buys only backup coverage for relocated LinkedFiles folders; the file syncs either way.

**Do not use a `.txt` extension** to dodge the 1 MiB cap. It lifts the cap and gives you diff3 line merging, but `TextFileTypeHandler` *throws* on an overlapping-line conflict and `ChorusMerge` exits 1; what happens to the file then is unestablished. `https://raw.githubusercontent.com/sillsdev/chorus/master/src/LibChorus/FileTypeHandlers/text/TextFileTypeHandler.cs` (lines 21-33, 49-106).

### 1.3 Three corrections to the plan you should act on now

- **Row bands do not belong in `TextTag`.** PLAN's mapping table and Phase 2 still put bands in a Text Markup Tags sub-list plus `TextTag`s (`PLAN.md:118`, `PLAN.md:214`), and safety rule 1 says "use `TextTag` for bands" (`PLAN.md:161`). Four reasons against, detailed in §5.5: it anchors to `(Segment, index)` word spans, not to `ConstChartRow`, and a marker-only row has no span at all; a row can cross 3+ segments, where FLEx's own tag support is incomplete and `ChangeToDifferentIndex` throws `NotImplementedException`; the tags are loudly visible and hand-editable in four places colleagues use daily (Tagging tab, Concordance, Complex Concordance, Lists); and they land in `Linguistics/TextCorpus/Text_<guid>.textincorpus`, not `Charting.discourse`, so per-row chart data would merge independently of the chart it belongs to. The `ConstChartRow` custom field replaces all of this.
- **Marker presentation: keep CA's split, and keep FLEx's list order.** PLAN puts visibility in `CmPossibility.Hidden`, colour in `ForeColor`, and display order in the list order (`PLAN.md:117,151`). Colour is right and CA addendum 5 recommends it: store FDAT's marker colours in `ForeColor`/`BackColor`, with CA's two caveats (dormant is not reserved; the values are project-wide). `Hidden` is usable only when the intent really is "this marker is uninteresting in this whole project"; per-chart or per-view hiding must live in FDAT's settings JSON keyed by marker GUID, as must bold/italic/size. **Display order is different and PLAN is wrong there**: reordering `ChartMarkersOA.PossibilitiesOS` changes the order of FLEx's own cell context menu (`FieldWorks/Src/LexText/Discourse/ConstituentChartLogic.cs:2370-2372,3139-3181`), which violates PLAN rule 4 and CA's "FDAT should **read** the hierarchy, not restructure it". Read the list's hierarchy for grouping; store any FDAT-specific order and grouping as an explicit index in `FDAT_DiscourseSettings`. On uninstall, reset any colour FDAT wrote to `-1073741824` (transparent).
- **A custom field on `Text` would be invisible, and FDAT would own its whole lifecycle.** Background, because `PLAN.md:200`'s Phase 0 checklist still says to verify "a custom field added to `Text` (definition and value) arrives on the other machine": LCM will create it, but `Text/FullInformation` has no `customFields` placeholder (`FieldWorks/DistFiles/Language Explorer/Configuration/Parts/Cellar.fwlayout:62-75`, **[confirmed]**) and `DataTree.EnsureCustomFields` is called from nowhere else (`FieldWorks/Src/Common/Controls/DetailControls/DataTree.cs:2309-2325,2487-2532`), so it appears in no FLEx UI; the Custom Fields dialog never offers `Text` and filters existing fields to its own six classes, so it cannot be deleted there either (`FieldWorks/Src/xWorks/AddCustomFieldDlg.cs:109-133`, verified in this review). Since chart-class fields are the recommendation anyway, retarget that spike line at `ConstChartRow`/`DsConstChart` (§1.4 steps 1-3).

### 1.4 What to spike first on a real project (in this order)

1. **Create the custom fields.** `IFwMetaDataCacheManaged.AddCustomField("ConstChartRow", "FDAT_Band", ReferenceCollection, CmPossibilityTags.kClassId, …)` and the `DsConstChart` String, from flexlibs/pythonnet, **with FLEx closed**, inside a UOW, then `Save()`. Confirm `<AdditionalFields><CustomField class="ConstChartRow" …/>` appears in the `.fwdata`, and that FLEx then opens the project without complaint and its Custom Fields dialog does not list or crash on them.
2. **Write a value and Send/Receive to a second machine.** Confirm `FLExProject.CustomProperties` and the `<Custom name="FDAT_Band">` element inside `Linguistics/Discourse/Charting.discourse`, and that the value arrives.
3. **Two-machine concurrent add.** Machine A sets a band on row 3, machine B on row 7, both S/R. Expect a clean merge (per-object, GUID-keyed). Then both edit row 3 and confirm you get a conflict note rather than corruption. Also band the *same* row on both machines and confirm whether you end up with a two-member collection (§3.4) — that decides the load-time reconciliation rule.
4. **Delete a band item.** With a row referencing an FDAT band item, delete that item in the Lists area. Confirm the row's `<Custom name="FDAT_Band">` becomes empty rather than retaining an `<objsur>`; repeat after closing and reopening the project (values loaded from disk are not registered as incoming refs). If a dangling objsur survives, the band anchor must change. The whole §1.1 band recommendation rests on this asymmetry, which is code-reading only.
5. **Run `FixFwData.exe`** (the FLEx install's `FixFwData`, `FieldWorks/Src/Utilities/FixFwData/Program.cs:20-47`) on a *closed* copy after the write round; exit code must be 0 and no "removing undefined custom property" lines.
6. **The `OwningAtomic → StText` merge.** Edit different paragraphs of `FDAT_Prologue` on two machines, then the same paragraph, and observe conflict granularity. This is the only evidence for the per-paragraph claim in §1.1/§3.6.
7. **The `DsDiscourseData` header field.** Set `FDAT_DiscourseSettings`, S/R, and verify the value survives the split/merge of the `<header>` element. This is the one anchor recommendation resting on inference.
8. **Row deletion.** Empty a row that carries a band and a column value, with and without text in `Notes`. Expect: with Notes, the row survives with its GUID and FDAT data; without, the row is deleted and the FDAT data goes with it. Then trigger `RemoveMissingMarker` on a marker-only row and confirm the new GUID — the §8.3 step-4 fallback must catch it.
9. **The linked-file path.** Drop a `.json` into `LinkedFiles/Others/fdat/` from outside FLEx and confirm the next S/R carries it (the `**.*` glob across a nested subfolder is inferred from hg semantics, not read in FLExBridge). Commit a ~2 MB file and watch the S/R log to confirm the installed Chorus really caps unknown extensions at 1 MiB.
10. **Write while FLEx is editing.** With Sharing on and FLEx open on the same chart with an unsaved row insertion, have FDAT write `FDAT_ChartSettings` on that `DsConstChart`. Confirm whether the ConflictingSave dialog appears and what the FLEx user loses. This decides whether FDAT may write chart-level fields at all while FLEx is open.
11. **The export spec (§7).** Export the same chart from FLEx ("Export Text Chart" → Discourse XML) and from the rewritten sidecar and diff. This is an export task, not a storage task, but PLAN §4 is wrong in several places and the fixture depends on it.

---

## 2. Anchor points table

Merge granularity below is FLExBridge's: every concrete class element is matched by `guid` and merged **per element, not atomically** (`flexbridge/.../DomainServices/FieldWorksMergeServices.cs:108-120`; CA 5.4); `<Str>` and each `<AStr>` alternative are atomic; `AUni` is per writing system.

| Object / property | What it can hold | Owner & cardinality | S/R file & merge granularity | Visible / editable in FLEx | Behaviour & risks | Citation |
|---|---|---|---|---|---|---|
| **`DsConstChart` custom `String`** | JSON per-chart settings | 1 per chart | `Linguistics/Discourse/Charting.discourse`; key `Custom_DsConstChart_<name>`; one `<Str>` = atomic | No UI anywhere | Whole-field conflict if two people edit the same chart's settings between syncs | `flexbridge/.../FieldWorksElementToMergeStrategyKeyMapper.cs:49-58`; `FieldWorksMergeServices.cs:208-323`; CA 3.7 |
| **`DsConstChart` custom `OwningAtomic`→`StText`** | Rich prologue/epilogue, multi-paragraph JSON | 1 per chart | Same file; nests as `<Custom name><StText guid><Paragraphs><ownseq class="StTxtPara">…`; **merges per paragraph [unchecked]**, order significant | No UI | Paragraph inserts/deletes merge by GUID; put one logical unit per paragraph | §3.6; `flexbridge/.../CmObjectNestingService.cs:108-141`; `CmObjectValidator.cs:592-604` |
| **`DsConstChart.Name` (MultiUnicode) / `.Description` (MultiString)** | Short title / prose | 1 each | Same file; `AUni` per WS / `AStr` atomic per WS | Not read, displayed or exported by any FLEx code in the sparse checkout (CA 1.7, inferred from grep) | Free native slots, no schema change; but semantically "chart name/description", and a future FLEx could surface them | CA 1.3, 1.7, 1.8, 1.9 |
| **`ConstChartRow` custom `String`** | Per-row custom-column values, band code | 1 per row per field | Same file, inside `<ownseq class="ConstChartRow">`; atomic per row per field | No UI (chart VC renders fixed fragments only) | The best per-row anchor. Row GUID lifetime: §8 | CA 3.4, 3.5, 3.7; `FieldWorks/Src/LexText/Discourse/ConstChartVc.cs:277-302` |
| **`ConstChartRow` custom `ReferenceCollection`→`CmPossibility`** | Band link | 0..n (FDAT writes ≤1) | Same file; `<Custom name><refcol guid t="r"/>`; **set merge by guid, both sides' additions kept, order never significant** | No UI | LCM clears the ref when the target item is deleted (the vector is an `IReferenceSource`) | §3.4; `liblcm/src/SIL.LCModel/DomainImpl/Vectors.cs:222-236,780-825` |
| **`ConstChartRow` custom `ReferenceAtomic`** | — | — | — | — | **Avoid.** Deleting the target leaves a dangling `<objsur>`; FLExBridge's validator does not detect it; only `FixFwData` strips it, silently | §3.4 |
| **`ConstChartRow.Notes` (String)** | Row prose | 1 | Same file; `<Str>` atomic | **Yes** — the Notes column, the only editable cell | User-owned. Dumped to `<project>/SavedNotes.txt` when rows are cleared; keeps a row alive when otherwise empty | `FieldWorks/Src/LexText/Discourse/MakeCellsMethod.cs:118-123,491-524`; `ConstituentChartLogic.cs:2935-2957`; `liblcm/.../OverridesLing_Disc.cs:27-48` |
| **`ConstChartRow.Label` (String)** | — | 1 | — | Yes (row number) | **Machine-owned**: `RenumberRows` rewrites it on every insert/delete/end-of-sentence change | `ConstituentChartLogic.cs:1727-1765` |
| **`DsDiscourseData` custom `String`** | Project-level FDAT discourse settings | 1 per project | `Charting.discourse` `<header>`; atomic | No UI | **Inferred** that header-element custom props merge normally — spike it (§1.4 step 7) | CA 5.2; `flexbridge/.../DiscourseAnalysisBoundedContextService.cs:60-88` |
| **`DsDiscourseData.ChartMarkers` items (`CmPossibility`)** | Marker identity; `ForeColor`/`BackColor`/`UnderColor`/`UnderStyle` (BGR ints), `Hidden`, `SortSpec`, `Description`, `Discussion` (StText) | n | `Linguistics/Discourse/ChartMarkers.list`; per-item, per-field | Name/Abbrev/Description **yes** (Lists); colour fields **no** (filtered out of the editor) | Colour fields are dead in every FLEx UI searched; the chart never reads them. Reordering the list **is** user-visible | `MasterLCModel.xml:354-378`; `completeFilter.xml:6-16`; `ConstChartVc.cs:73-140,644-662` |
| **FDAT-owned unowned `CmPossibilityList` + `CmCustomItem`s** | Band/column vocabularies with GUIDs, names, colours | n | `General/UserDefinedLists/UserList-<guid>.list`; per item/per field | **Yes**, as a normal custom list in Lists; user can rename, reorder, and **delete the list** | Deleting the list deletes every custom field referencing it, on any class | `flexbridge/.../UserDefinedListsBoundedContextService.cs:22-42`; `FieldWorks/Src/xWorks/DeleteCustomList.cs:97-119`; CA 3.6 |
| **`TextTag` in `StText.Tags`** | (Segment,index) span → one possibility | n per text | `Linguistics/TextCorpus/Text_<guid>.textincorpus`; per-object by guid, both-side adds kept | **Yes** — Tagging tab row, Concordance, Complex Concordance, Lists | Anchors to words, not to rows; user-editable; maintained/deleted by `AnalysisAdjuster` | §5 |
| **`Segment` custom `String`** | Per-clause data | 1 per segment per field | `…textincorpus`; atomic | **Yes** — offered by the Custom Fields dialog, selectable as an interlinear line, exported as `item type="custom"` | Also listed in the **Text Chart tab's** Configure Interlinear Lines dialog (**[confirmed]**), though the chart silently drops it | §3.5 |
| **`RnGenericRec` (Notebook)** | 9 `StText` fields + custom fields; `Text` ref | 1 record per text if FDAT makes one | `Anthropology/…`; per-object | **Yes** — appears in the user's Notebook | Full merge support; heavyweight and user-visible | `MasterLCModel.xml:2323-2489`; `AddCustomFieldDlg.cs:122-124` |
| **`LangProject.Styles` (`StStyle`)** | Named character styles (`Rules` = TsTextProps) | n | `General/FLExStyles.style`; per-style by guid | Yes (Styles dialog) | **Duplicate `Name` fails FLExBridge validation** and can roll back the whole S/R; `FixFwData` deletes duplicates | §6.3 |
| **`LinkedFiles/Others/**`** | Any bytes | n files | Synced as opaque files | No | 1 MiB cap, no merge, default-location only | §1.2, §4 |
| **`Text.MediaFiles` → `CmMediaContainer.MediaURIs`** | Any number of URI strings | 1 container, n URIs | `…textincorpus`; per-object | Read-only line in the Text **Info tab** ("Media") in current FLEx | ELAN placeholder; round-trips through `.flextext` export/import as if it were a recording | §4.2 |
| **`ConstChartTag.Tag`** | A marker possibility, per cell | n per row | `Charting.discourse` | **Yes** — renders as orange `(ABBR)` in the chart and in exports | No validation that the possibility is in ChartMarkers, but a foreign one cannot be un-checked from the menu | CA 4.1-4.3; `ConstituentChartLogic.cs:2370-2372,3138-3222` |

---

## 3. Custom fields

### 3.1 What LCM allows vs what FLEx's dialog offers

LCM has **no class whitelist**. `LcmMetaDataCache.AddCustomField(className, fieldName, type, destClass, help, ws, listRoot)` only does `CheckClid(className)`, rejects a name colliding with a built-in field, and allocates `flid = clid*1000 + 500 + n` (`liblcm/src/SIL.LCModel/Infrastructure/Impl/LcmMetaDataCache.cs:920-965`; CA 3.1, spot-checked). `CmObject` serialises and loads `<Custom name="…">` generically for every type on every class (`liblcm/src/SIL.LCModel/DomainImpl/CmObject.cs:3050-3152,3177-3330`).

FLEx's dialog offers exactly six classes — LexEntry, LexSense, LexExampleSentence, MoForm (Lexicon), **Segment** (Texts & Words), RnGenericRec (Notebook) — and *filters existing custom fields to those classes*, so FDAT's fields on chart classes are invisible and undeletable there (`FieldWorks/Src/xWorks/AddCustomFieldDlg.cs:109-133`, re-read and verified in this review).

Type mapping the dialog uses, which FDAT should mirror so fields look "normal" (`AddCustomFieldDlg.cs:395-437`):

| Dialog type | `CellarPropertyType` | `DstCls` |
|---|---|---|
| Single-line text | `String` (first anal/vern WS) or `MultiUnicode` | — |
| Multiparagraph text | `OwningAtomic` | `StText` |
| Number | `Integer` | — |
| Date | `GenDate` | — |
| List reference (single) | `ReferenceAtomic` | `CmPossibility` + `ListRootId` |
| List reference (multiple) | `ReferenceCollection` | `CmPossibility` + `ListRootId` |

`Segment` gets **only** Single-line text in the dialog.

### 3.2 How definitions sync

Definitions live in the `.fwdata` header `<AdditionalFields><CustomField name class type [destclass] [wsSelector] [helpString] [listRoot] [label]/>` and are re-registered at startup **by (class name, field name)** — flids are not stored (`liblcm/.../XMLBackendProvider.cs:226-257,552-569`). FLExBridge splits them into `FLExProject.CustomProperties`, always written, included immediately after the model-version file, and re-inserted on Receive (`flexbridge/.../FlexFolderSystem.cs:47-48`; `FLExProjectSplitter.cs:73-124`; `FLExProjectUnifier.cs:131-145`). Each `<CustomField>` merges **atomically**, matched on `(name, class)`; the validator requires `name/class/type/key` and allows only `destclass/wsSelector/helpString/listRoot/label` (`FieldWorksMergeServices.cs:75-82`; `CustomPropertiesTypeHandlerStrategy.cs:36-93`). `class` is not checked against the model.

Practical rules: **address fields by name** via `mdc.GetFieldId2(clid, name, true)` on every machine; **prefix distinctively** (`FDAT_…`) so a future built-in field name cannot collide (migration 7000069 renamed colliding custom fields — `liblcm/.../DataMigration/DataMigration7000069.cs:356-405`); **never change a field's type**.

### 3.3 How values sync and merge

Before merging any data file FLExBridge loads the definitions into its own `MetadataCache` (`AddCustomPropInfo`, silently skipping unknown class names) and the discourse handler passes `addCustomPropertyInformation: true` (`flexbridge/.../MetadataCache.cs:463-508`; `Handling/FieldWorksCommonFileHandler.cs:57-62`; CA 3.7). Each custom property gets its own strategy keyed `Custom_<Class>_<Prop>`, derived from the `<Custom>` element's `name` attribute and its **parent element's name** — which for rows is the `ownseq class="ConstChartRow"` shape (`FieldWorksElementToMergeStrategyKeyMapper.cs:47-58`). `CmObjectValidator` accepts `<Custom>` whose name is a known custom property of that class; the "exactly two attributes" rule applies only to basic value types (`CmObjectValidator.cs:83-120,654-696`).

### 3.4 Reference fields and deletion — the decisive asymmetry

Deleting a `CmPossibility` in the Lists area is gated **only** by `CmPossibility.CanDelete`, which never consults incoming references (`liblcm/.../OverridesCellar.cs:1720-1729`, **[confirmed]**). So an FDAT band item is freely deletable unless you set `IsProtected = true` (`MasterLCModel.xml:379-383`). Then:

- **`ReferenceCollection` / `ReferenceSequence`: cleaned up.** `LcmReferenceCollection` is itself an `IReferenceSource`, registers in the target's incoming refs when fluffed, and its `RemoveAReference` does `Remove(target)` — a normal, registered, undoable modification. `liblcm/src/SIL.LCModel/DomainImpl/Vectors.cs:222-236,264-269,780-825`. The band assignment is silently lost, but the data stays valid. (`ConstChartRow.RemoveObjectSideEffectsInternal` only reacts to `kflidCells`, so this does not trigger the row's delete-if-empty logic — `OverridesLing_Disc.cs:27-49`.)
- **`ReferenceAtomic`: not cleaned up.** Custom atomic refs *do* register incoming refs when set in-session (`CmObject.cs:3012-3027`), so the referrer is visited on delete. But `RemoveAReferenceCore` is an empty base whose per-class override is **generated only over the class's *model* atomic-reference properties** (`liblcm/src/SIL.LCModel/LcmGenerate/RemoveAReferenceCore.vm.cs:15-25`), and `ConstChartRow` has **no** reference properties at all (`MasterLCModel.xml:2679-2694`) so gets no override. The only hand-written exception in the whole model is `LexEntry` (`OverridesLing_Lex.cs:3418-3427`). Worse, values loaded from disk are never registered at all: `GetCustomPropertyForSDA` converts the stored `CmObjectId` to an hvo without `AddIncomingRef` (`CmObject.cs:2866-2872`), unlike the generated `ConvertIdToAtomicRef`. **Result:** a dangling `<objsur>` in `Charting.discourse`; FLExBridge's validator only checks `guid` parses and `t=="r"` (`CmObjectValidator.cs:541-560`); only `FixFwData`'s `OriginalFixer` strips it, logging "removing link to nonexisting object" and dropping the emptied `<Custom>` element (`liblcm/src/SIL.LCModel.FixData/FwDataFixer.cs:220-225,272-322`). Reading it in the meantime throws `KeyNotFoundException` after reload (`CmObjectIdentityMap.cs:327-336`).

**Collections and concurrent additions.** Custom collection properties get a `FindByKeyAttribute("name")` strategy (they serialise as `<Custom name="X">`), and in FLExBridge **collection order is never significant**: both machines' independent additions are kept with no conflict (`FieldWorksMergeServices.cs:208-260`; corroborated by `flexbridge/src/LibFLExBridge-ChorusPluginTests/Handling/Anthropology/FieldWorksAnthropologyTypeHandlerTests.cs:178-206` and Chorus's `Run_BothAddedDifferentKeyedNodes_OrderIrrelevant_NoConflict`). Two consequences: **never encode ordering** (column order, band order) in a collection — store an explicit index; and FDAT's "≤1 member" is a write-time rule only, so reconcile a two-member `FDAT_Band` deterministically on load (§1.1).

### 3.5 `Segment` and `RnGenericRec`

- **`Segment`** is the one class the dialog exposes in Texts & Words, Single-line text only. It is *not* invisible: it renders as an editable freeform line under each segment in Baseline/Gloss/Analyze, exports as `item type="custom"` in `.flextext` (`FieldWorks/Src/LexText/Interlinear/InterlinVc.cs:2765-2800`; `InterlinearExporter.cs:121-124`), **and is offered as a tickable line in the Text Chart tab's Configure Interlinear Lines dialog** (`InterlinLineChoices.cs:560-608`, **[confirmed]**). If a user ticks it, the chart body, ribbon, print view and "Export Text Chart" all silently drop it (`spec.WordLevel == false` → the per-line loop `break`s; `InterlinVc.cs:2475-2500`), and the exporter's `Debug.Assert` for unknown flids is never reached because custom fields go through the non-asserting `AddStringProp`. Safe, but user-visible in the texts tabs — wrong home for machine data. If you use it anyway, create it as `String`/`MultiUnicode` with ws `kwsAnal`, because `CreateSpec` `Debug.Fail`s on other writing systems (`InterlinLineChoices.cs:962-990`).
- **`RnGenericRec`** supports custom fields and can reference a `Text` (`MasterLCModel.xml:2323-2489`); one record per text would be a fully merged container for prologue/epilogue. Cost: it appears in the linguist's Notebook. Only worth it if you want the data user-visible.
- **Neither is a per-row anchor.** A chart row is a clause; a segment can span several rows and a row can cover part of a segment (`ConstChartWordGroup.BeginSegment/EndSegment` + indices, `MasterLCModel.xml:2824-2838`).

### 3.6 The `OwningAtomic → StText` custom field

An `OwningAtomic → StText` custom field on any concrete class nests in the split file exactly like a built-in owning property: `CmObjectNestingService` derives the property name from the `name` attribute, finds it in the class's `AllOwning` cache and replaces the `<objsur t="o">` with the owned element, recursing (`flexbridge/.../CmObjectNestingService.cs:108-141`); flattening has an explicit custom-owning branch (`CmObjectFlatteningService.cs:101-146`). This shape already exists in production for Notebook "Multiparagraph text" fields — FLExBridge's own test fixture is `<RnGenericRec><Custom name='Like'><StText guid=…><Paragraphs><ownseq class='StTxtPara' …>` (`flexbridge/src/LibFLExBridge-ChorusPluginTests/Handling/Common/StyleContextGeneratorTests.cs:76-111`).

Merge: the `<Custom>` wrapper is **not atomic** (`NumberOfChildren = ZeroOrOne`); Chorus descends into the `StText` (GUID-keyed class strategy), `Paragraphs` gets `SignificantOrderPolicy`, each `ownseq` `StTxtPara` is matched by guid, and **only each paragraph's `<Str>` is atomic** (`FieldWorksMergeServices.cs:208-236,296-298,357-372`). This confirms `PLAN.md:152` ("it merges per paragraph"); the "merges as one string" warning at `PLAN.md:230` remains correct for the `String` remainder field and should not be generalised to the StText variant. Design consequence: put one logical unit per paragraph (paragraph 1 = header/version, one paragraph per row or per section). No FLExBridge test performs a 3-way merge of such a field, so this is **[unchecked]** — spike §1.4 step 6.

Cleanup if the definition is ever removed: `CustomPropertyFixer` strips the undefined `<Custom>` element, then `FwDataFixer`'s multi-pass loop removes the now-disowned `StText` and its paragraphs/segments over the next passes — deleted, not orphaned (`liblcm/src/SIL.LCModel.FixData/CustomPropertyFixer.cs:40-80`; `FwDataFixer.cs:63-66,236-263,355-384`). LCM's own delete path (`FieldDescription.UpdateCustomField`) `DeleteObjOwner`s the owned StText before `DeleteCustomField` — FDAT's uninstall must do the same (`liblcm/src/SIL.LCModel/FieldDescription.cs:355-388`; §3.8).

### 3.7 Programmatic-creation risks

1. **Send/Receive of definition *changes* is the fragile moment.** FLEx warns users in its own dialog: "FLEx currently has only limited ability to Send/Receive custom field changes… It is possible to get into a situation where some team members cannot merge their changes and must Get the project again… We recommend that teams agree on one person who will make all custom field changes." (`FieldWorks/Src/xWorks/xWorksStrings.resx:897-911`; shown whenever the project has an S/R repo, `AddCustomFieldDlg.cs:183-189`.) **Mitigation:** create *all* FDAT fields in one idempotent step with fixed names, never rename or retype; tell the team the first FDAT user should S/R immediately and everyone else should S/R before running FDAT. This is why per-column custom fields are the wrong shape for user-created columns (§1.1).
2. **Do it with FLEx closed.** FLEx refuses its own dialog when another app is connected (`FieldWorks/Src/xWorks/XWorksViewBase.cs:715-723`). Whether LCM permits a non-master shared peer to `AddCustomField` is unverified — assume not.
3. **Value types need back-filling.** For `Integer`/`GenDate`, `FieldDescription` marks every instance of the class modified so the default `<Custom val="0"/>` is written (`FieldDescription.cs:336-418`). `BasicCustomPropertyFixer` maps class→subclasses only by a hard-coded MoForm kludge (`liblcm/src/SIL.LCModel.FixData/BasicCustomPropertyFixer.cs:36-66`; CA 3.9), so: **declare on concrete classes only** (`ConstChartRow`, `DsConstChart`, `DsDiscourseData`), never on abstract `DsChart`/`ConstituentChartCellPart`, and **prefer `String`/`ReferenceCollection`/`OwningAtomic`**, which are optional elements needing no default.
4. **Deleting a custom list deletes every field that references it, on any class** (`DeleteCustomList.cs:97-119`; CA 3.6) — and deleting a custom field deletes all its data. These are the two unrecoverable paths the JSON backup exists for.
5. **flexlibs has no creation API.** It offers `GetFieldID(className, fieldName)` (any class), `GetCustomFieldValue` (String, Multi*, Integer, ReferenceAtom, ReferenceCollection) and `LexiconSetFieldText/Integer/ListFieldSingle/Multiple` — the "Lexicon" names are cosmetic, they take any hvo and flid and go through `DomainDataByFlid` (`flexlibs/flexlibs/code/FLExProject.py:898-1000,1060-1180,1349-1402`). There is **no** `AddCustomField` wrapper; call the MDC directly through pythonnet. flexlibs' setters do **not** cover `OwningAtomic`/`GenDate`.
6. **Prefer `FDAT_Data` to `"FDAT data"`.** LCM only checks name uniqueness, and the name becomes a merge key verbatim on a class FLEx's dialog never sees; a space is untested there.

### 3.8 Uninstall: the four steps

No FLEx UI can see or delete these fields (§1.3, §3.1), so FDAT owns the whole lifecycle. "Remove FDAT data from this project" must, inside a UOW:

1. For each `OwningAtomic → StText` field, `DeleteObjOwner` the owned `StText` on every object **before** deleting the definition — this is exactly what `FieldDescription.UpdateCustomField` does (`liblcm/src/SIL.LCModel/FieldDescription.cs:355-388`); `DeleteCustomField`'s contract requires the data to be gone first.
2. Clear values in the other custom fields, then `IFwMetaDataCacheManaged.DeleteCustomField(flid)` for each FDAT field, addressed by name.
3. Delete the FDAT-owned possibility list **after** its referencing fields are gone (deleting it first cascades into them — `DeleteCustomList.cs:97-119`), having first cleared `IsProtected` on its items.
4. Reset any `ForeColor`/`BackColor` FDAT wrote on Chart Markers to `-1073741824` (transparent/unset, `liblcm/src/SIL.LCModel.Core/Text/ColorUtil.cs:109-114`), and delete the `LinkedFiles/Others/fdat/` files. Then `Save()`.

---

## 4. Linked-file design

### 4.1 Where the file must live

`<project>/LinkedFiles/Others/` (or `Pictures`/`AudioVisual`), computed from `LcmFileHelper.ksLinkedFilesDir`/`ksOtherLinkedFilesDir` (`liblcm/src/SIL.LCModel/LcmFileHelper.cs:39-45,150-154`). `LinkedFiles/Others` is exactly where FLEx's own *Insert → Link to File* puts user files (`FieldWorks/Src/FwCoreDlgs/MoveOrCopyFilesController.cs:46-53,100-140`), so an `fdat/` subfolder there is conventional. Anywhere else in the project folder is not synced (`flexbridge/.../FlexFolderSystem.cs:12-17,60-64`). Size, merge and extension constraints are in §1.2 (**1 MiB** for `.json`; **no merge**; never `.xml`/`.zip`/`.flextext`, which are globally excluded). FLEx's own Backup includes the file when LinkedFiles is in-project and the user ticks "include linked files" (`liblcm/src/SIL.LCModel/DomainServices/BackupRestore/ProjectBackupService.cs:120-135,240-275`).

### 4.2 Four ways to reference it from the model, and what FLEx does with each

| Mechanism | What FLEx does | Verdict |
|---|---|---|
| **`CmMediaURI` on `Text.MediaFilesOA.MediaURIsOC`** (the owner's "linked file of the text") | *Yes*, a Text can hold many — `MediaFiles` is one atomic `CmMediaContainer` owning a **collection** of `CmMediaURI`, each a single Unicode URI string (`MasterLCModel.xml:1632-1656,3902-3906`). But it is documented as "a placeholder for ELAN data, not modifiable or viewable in flex"; the only writer is `.flextext` (BIRD) import (`FieldWorks/Src/LexText/Interlinear/BIRDInterlinearImporter.cs:1372-1403`); in current FLEx the Text **Info tab** shows every URI as read-only static text via `MediaInfoSlice` (`FieldWorks/Src/Common/Controls/DetailControls/MediaInfoSlice.cs:158-190`; older versions show nothing); `InterlinearExporter` writes every one into `.flextext` as `<media location=…>` (`InterlinearExporter.cs:884-895`); playback is attempted only if a **Segment** references it (`InterlinVc.cs:1138-1150`). | **Do not use.** Semantic misuse; the URI is absolute in practice (per-machine); it leaks into `.flextext` exports as if it were a recording. |
| **`CmFile` in a `CmFolder` under `LangProject.MediaOC`** | `CmFile.InternalPath` is stored relative to `LinkedFilesRootDir` (`liblcm/.../OverridesCellar.cs:1916-1968`); create with `DomainObjectServices.FindOrCreateFile(folder, path)` (`DomainServices/DomainObjectServices.cs:2289-2318`). FLEx shows nothing for an unreferenced `CmFile`. Its one real benefit: backup covers it even when LinkedFiles has been relocated (`ProjectBackupService.cs:240-275`). | **Optional.** Legitimate, invisible, relative-path-safe. Two machines can both create a `CmFile` for the same path (no uniqueness check, no fixer) — reconcile on load. |
| **External-link run in a TsString** (`kodtExternalPathName`) | A real hyperlink: `StringServices.MarkTextInBldrAsHyperlink` sets `ktptNamedStyle = "Hyperlink"` + `ktptObjData = (char)4 + relativePath` and registers a `CmFile` in `LangProject.FilePathsInTsStringsOA` (`liblcm/.../DomainServices/StringServices.cs:56-93`; `FieldWorks/Src/Common/RootSite/RootSiteEditingHelper.cs:1097-1165`). Clicking `Process.Start`s the file — on a colleague's machine a `.json` opens in whatever Windows associates (`FieldWorks/Src/Common/SimpleRootSite/VwBaseVc.cs:225-278`). FLEx also rewrites such paths when LinkedFiles moves (`StringServices.cs:131-200`). | **No.** Requires a user-visible text field to host it; opens the raw JSON in Notepad. |
| **Unreferenced, by convention** | Nothing. Chorus adds and removes the file by path alone. | **Recommended.** Simplest, no model write, no cross-machine path problem. |

---

## 5. Tags and lists — and why tags are a poor fit here

### 5.1 `TextTag` semantics

`TextTag` (owned in `StText.Tags`, an owning **collection**) has exactly `BeginSegment`, `EndSegment` (Segment refs), `BeginAnalysisIndex`, `EndAnalysisIndex` (indices into `Segment.Analyses`), `Tag` (CmPossibility ref) — no free-text field (`MasterLCModel.xml:489,655-671`). Create with `ITextTagFactory.CreateOnText(begin, end, tagPoss)`, which validates the occurrences and non-null possibility but **not** that the possibility is in `TextMarkupTags` (`liblcm/.../FactoryAdditions.cs:963-993`). Tags of different top-level categories may overlap; a new tag of the **same** category replaces overlapping ones (`FieldWorks/Src/LexText/Interlinear/InterlinTaggingChild.cs:521-559`). Multi-segment support is explicitly incomplete: tag lookup only checks Begin/End segments ("this won't work for multi-segment tags where a tag can reference 3+ segments") and `ChangeToDifferentIndex` throws `NotImplementedException` when both endpoints of a multi-segment tag need adjusting (`InterlinTaggingChild.cs:625-652`; `liblcm/.../OverridesLing_Wfi.cs:104-127`).

### 5.2 Text Markup Tags structure

`LangProject.TextMarkupTags` is a strict two-level list: top-level items are tag *types*, their `SubPossibilities` are the tags (`MasterLCModel.xml:5344-5348`; `liblcm/.../OverridesLangProj.cs:565-606`). The Lists tree handler refuses to demote a type, promote a tag, or nest deeper (`FieldWorks/Src/xWorks/RecordBarTreeHandler.cs:805-866`). Deletion of an in-use tag or type is refused, naming the text (`liblcm/.../OverridesCellar.cs:1707-1728`; `FieldWorks/Src/FdoUi/FdoUiCore.cs:1765-1790`).

### 5.3 Custom lists

Unowned `CmPossibilityList`s (`Owner == null` is how FLEx identifies them), created with `ICmPossibilityListFactory.CreateUnowned(name, ws)` which sets `ItemClsid = CmCustomItem` (`liblcm/.../FactoryAdditions.cs:1545-1571`; `AddCustomFieldDlg.cs:591-596`). Mirror what FLEx's Add Custom List dialog sets: `DisplayOption`, `PreventDuplicates`, `IsSorted`, `WsSelector`, `Depth` (1 flat / 127 hierarchical), `Description`, and a **project-unique Name** (`FieldWorks/Src/xWorks/CustomListDlg.cs:271-286,596-620`). `IsClosed = true` stops users inserting items in the Lists area (`FieldWorks/Src/xWorks/RecordList.cs:3762-3768`). Sync: `General/UserDefinedLists/UserList-<guid>.list`, validated and 3-way merged like any list (`flexbridge/.../Handling/Common/ListFileTypeHandlerStrategy.cs:31-66`).

### 5.4 Colour fields — do they render?

`ForeColor`, `BackColor`, `UnderColor`, `UnderStyle`, `Hidden` exist on every `CmPossibility` and are documented as the formatting for overlay possibilities (`MasterLCModel.xml:354-378`). What the model says was removed is `CmOverlayTag`'s *own* formatting, not overlays themselves: "In the original model, we had model CmOverlayTag that could carry their own formatting apart from the formatting defined in the CmPossibility. In the current model, we have removed this capability." (`MasterLCModel.xml:636-640`) — `CmOverlay` (class 21) and `LangProject.Overlays` still exist. The evidence that nothing renders these fields today is therefore the grep, not the model comment: a search for `kflidForeColor|kflidBackColor|kflidUnderColor|kflidUnderStyle|kflidHidden` across the (sparse) FieldWorks checkout found **nothing**; liblcm sets them only in migrations and XML list import; the Lists data-entry filter hides them (`FieldWorks/DistFiles/Language Explorer/Configuration/Lists/Edit/DataEntryFilters/completeFilter.xml:6-16`). **So FLEx will neither render nor let users edit FDAT's colours** in anything searched — confidence **medium** (overlay-era and Scripture UI not inspected; §10). Encode as **Win32 BGR** (`0x00BBGGRR`) via `ColorTranslator.ToWin32`; `-1073741824` (`0xC0000000`) means transparent/unset (`liblcm/src/SIL.LCModel.Core/Text/ColorUtil.cs:109-114`; `DomainServices/DataMigration/DataMigrationServices.cs:634-642`).

### 5.5 Why `TextTag` is the wrong anchor for row bands

Given your framing (the chart is the starting data, not the tagging tab):

1. **It anchors to the wrong thing.** A tag addresses `(Segment, index)` word spans, not `ConstChartRow`. A row's extent must be derived from the union of its `ConstChartWordGroup` spans, and rows that contain only a marker (no word group) have no span at all — they cannot be tagged.
2. **Rows can cross 3+ segments**, where FLEx's own support is incomplete (§5.1).
3. **It is loudly visible in four places a colleague uses daily** (all **[confirmed]** where marked): the **Tagging tab** gains a new "Salience" row of bracketed abbreviations under every word (`InterlinTaggingVc.cs:101-166,291-310`) and a checkable "Salience" submenu colleagues can apply/remove by hand (`InterlinTaggingChild.cs:399-438`); the **Complex Concordance** tag chooser lists the whole `TextMarkupTags` list and its matcher walks `StText.TagsOC`, so FDAT spans become search hits — including for a bare "any tag" query (`ComplexConcTagDlg.cs:42-83` **[confirmed]**; `ComplexConcParagraphData.cs:199-222`); the simple **Concordance**'s "Tagging" line likewise (`ConcordanceControl.cs:543-552,1208-1226`); and the **Lists** area, where colleagues can rename and reorder the bands (`Lists/Edit/toolConfiguration.xml:319-325`). It does *not* leak into the Print view or any interlinear export — inferred from the VC hierarchy and a grep of the sparse checkout (`InterlinPrintVc` extends `InterlinVc`, whose `AddExtraBundleRows` is empty; `InterlinearExporter.cs` has no TextTag code; all 15 interlinear XSLTs have zero tag references).
4. **It lands in the wrong sync file** — `Linguistics/TextCorpus/Text_<guid>.textincorpus`, not `Charting.discourse` — so per-row chart data would merge independently of the chart it belongs to (`flexbridge/.../TextCorpusBoundedContextService.cs:18-25,86-100`).

What tags *are* good for: they are FLEx-maintained. `AnalysisAdjuster` shifts their indices, moves endpoints across segments, and deletes them when their words are deleted (`liblcm/.../AnalysisAdjuster.cs:302-307,521-746`). If you ever need a **durable per-token GUID**, a one-token `TextTag` (Begin == End) referencing an FDAT-owned possibility is the right object — that is the one place I would still reach for tags. Likewise, do **not** put a non-marker possibility into `ConstChartTag.TagRA`: nothing crashes and it renders as an orange `(abbr)`, but users cannot un-check it from the marker menu (`ConstituentChartLogic.cs:2253-2263,3138-3222`; CA 4.1-4.3 — PLAN rule 1 is right).

---

## 6. Rich text, notes and styles

### 6.1 `ConstChartRow.Notes` vs Segment notes

`ConstChartRow.Notes` is a single `String` (one WS, formatted) edited in place in the chart's Notes cell — the only editable cell, since row-number and data cells are `ktptNotEditable` — and it is user prose: FLEx rescues it to `<project>/SavedNotes.txt` when rows are cleared and exports it as `<note>` (`MasterLCModel.xml:2679-2690`; `MakeCellsMethod.cs:118-123,441-444,491-524`; `ConstituentChartLogic.cs:2935-2957`). FDAT should write it only when the user types it in FDAT's Notes cell (PLAN rule 4). `Segment.NotesOS` (an owning sequence of `Note`, each a `MultiString`, shown on the interlinear "Note" line) is a different scope and cannot be colonised: rows link to segments only through `ConstChartWordGroup.BeginSegment/EndSegment` + indices, and a segment can span several rows, so a Segment note can never be assumed to belong to one row (`MasterLCModel.xml:227-235,259-267,2824-2838,4897-4913`; `InterlinDocForAnalysis.cs:148-156,2350-2361`).

### 6.2 TsString links

- **External file / URL links work and are clickable** anywhere the views engine renders (chart Notes cell included): run property `ktptObjData = (char)FwObjDataTypes.kodtExternalPathName + path`, serialised as `externalLink="…"` on the `<Run>` (`liblcm/src/SIL.LCModel.Core/KernelInterfaces/TextServ.idh:343-347`; `TsPropsSerializer.cs:257-275,986-989`). Store the path **relative** to LinkedFilesRootDir (`Others\fdat\x.json`) — `LinkedFilesRelativePathHelper.GetRelativeLinkedFilesPath` (`liblcm/.../LinkedFilesRelativePathHelper.cs:126-149`).
- **Object-GUID links do NOT work.** `kodtNameGuidHot`/`kodtOwnNameGuidHot` runs are rendered through `IVwViewConstructor.GetStrForGuid`, and `FwBaseVc.GetStrForGuid` **throws `NotImplementedException` for anything but footnotes and pictures**; `VwBaseVc.DoHotLinkAction` acts only on external paths, and no FLEx VC in the checkout handles GUID hot links (`FieldWorks/Src/Common/RootSite/FwBaseVc.cs:204-218`; `Src/Common/SimpleRootSite/VwBaseVc.cs:169-172,225-227`). **Never write such a run into Notes or Description** — an ORC run would make FLEx views throw.
- **The supported way to link to a FLEx object** is an *external-link* run whose URL is a FieldWorks link: `silfw://localhost/link?` + urlencoded `database=…&tool=…&guid=…&tag=…` — what "Copy Location as Hyperlink"/"Paste Hyperlink" produce; `LinkListener.HandleLocalHotlink` follows it in-process (`FieldWorks/Src/Common/FwUtils/FwLinkArgs.cs:39-84,307-335`; `Src/xWorks/LinkListener.cs:229-260,337-348`). Tool id for the Chart Markers list is `chartmarkEdit` (`Lists/areaConfiguration.xml:95-96`).
- TsStrings merge **atomically** in FLExBridge (each `<Str>`, each `<AStr>` alternative); `externalLink`/`link`/`ownlink`/`namedStyle` are all accepted run attributes (`flexbridge/.../CmObjectValidator.cs:346-390`; `FieldWorksMergeServices.cs:365-377`).

### 6.3 Character styles

FDAT's salience colours do not need styles at all — colour lives on the list item and is rendered by FDAT's own HTML. If FDAT ever does create an `StStyle`, know the trap: styles sync to `General/FLExStyles.style`, merged by **GUID**, but the file validator **rejects two styles with the same `Name`**, and Chorus treats a post-merge validation failure as fatal — "your project will be moved back to the last Send/Receive" (`flexbridge/.../Handling/Common/StyleFileTypeHandlerStrategy.cs:37-77`; `https://raw.githubusercontent.com/sillsdev/chorus/master/src/LibChorus/sync/Synchronizer.cs` lines 397-412). Even if it got through, `DuplicateStyleFixer` deletes the later duplicate (`liblcm/src/SIL.LCModel.FixData/DuplicateStyleFixer.cs:20-79`). **So: use fixed, deterministic GUIDs per style name** (so two machines' additions merge as "both added same"), and always look up by name before creating. `"Hyperlink"` already exists in every project (`FieldWorks/DistFiles/Language Explorer/FlexStyles.xml:76-80`; `StyleServices.cs:42`).

---

## 7. Chart export format and corrections to PLAN §4 / `fdat_lcm.py`

### 7.1 Exact spec (FLEx's `DiscourseExporter`)

The "Discourse XML" export item runs the raw exporter with `mode="doNothing"` — there is no hidden transform (`FieldWorks/DistFiles/Language Explorer/Export Templates/Discourse/Plain.xml:1-4`; `Src/LexText/Discourse/DiscourseExportDialog.cs:72-95,163-174`). The exporter is an `IVwEnv` intercepting the same view-constructor calls that draw the on-screen chart, so the XML mirrors the display, brackets and all.

```
<document>
  <chart>
    <row type="title1">                                  <!-- one per template tree depth, n from 1 -->
      <cell cols="1"><main /></cell>                     <!-- row-number header: ALWAYS empty -->
      <cell cols="K"><main><lit lang="analWs">Group</lit></main></cell> …  <!-- K = leaf count under the node -->
      <cell cols="1"><main><lit lang="analWs">Notes</lit></main></cell>    <!-- title1 only; empty cell in lower rows -->
    </row>
    <row type="title2"> … leaf column names as <lit lang=…> … </row>
    <row [endPara="true" | endSent="true"] type="normal|dependent|speech|song" [id="1a"]>
      [<cell cols="1"><main><note lang="…">…</note></main></cell>]      <!-- notes cell here when NotesColumnOnRight XOR RightToLeft is false -->
      <cell cols="1"><main><rownum lang="en">1a</rownum></main></cell>
      <cell [reversed="true"] cols="N"><main>…</main>[<glosses><gloss lang="analWs">…</gloss>…</glosses>]</cell> …
      [<cell cols="1"><main><note lang="…">…</note></main></cell>]      <!-- otherwise here (the default) -->
    </row>
  </chart>
  <languages>                                            <!-- AFTER chart; only WSs actually used -->
    <language lang="xyz" font="Charis SIL" [vernacular="true"] [RightToLeft="true"]/>
  </languages>
</document>
```

Rules that matter (`DiscourseExporter.cs:83-386`; `ConstChartVc.cs`; `MakeCellsMethod.cs`; unit tests `DiscourseTests/DiscourseExportTests.cs:317-594`):

- **Row attributes** in order `endPara|endSent`, `type`, `id`. Only **one** of endPara/endSent is written (`endPara` wins). `id` = `Label` text, omitted when empty. `type` from `ClauseType`.
- **Writing systems:** only `rownum` and `clauseMkr` are hard-coded English (`WsLineNumber = GetWsFromStr("en")`); header labels carry the possibility name's writing system, words the vernacular WS, glosses and literals the analysis WS.
- **`cols` is always present on every cell**, including empty ones (`<cell cols="1"><main /></cell>`). `reversed="true"` (written before `cols`) on a `MergesBefore` cell spanning >1 column.
- **Merge widths:** `MergesBefore` → one cell covering every unoccupied column up to and including the part's column; `MergesAfter` → `cols` = next part's column index − this column (one less if that next part `MergesBefore` and ≥2 empty columns), else all remaining columns.
- **Words:** one `<word [moved="true"] lang="vernWs">baseline text</word>` per **wordform occurrence** (punctuation occurrences skipped), text from the **segment baseline**, not `WfiWordform.Form`. Glosses buffered and emitted after `</main>` inside `<glosses>`; a gloss-less analysis yields the literal `***`. Only the Word and Word-Gloss lines are exported by default.
- **List markers:** `<lit noSpaceAfter="true" lang="analWs">(</lit><listRef lang="ws">ABBR</listRef><lit noSpaceBefore="true" lang="analWs">)</lit>`. Text = `Abbreviation` in the first analysis WS that has one, else `Name`.
- **Missing markers:** `<lit lang="analWs">---</lit>` — automatically in every empty cell of a column whose **English** name is `Subject` or `Verb`, and for a `ConstChartTag` with `TagRA == null`.
- **Clause markers:** `<lit noSpaceAfter="true">[</lit><clauseMkr target="1b" lang="en">1b</clauseMkr>[<lit noSpaceAfter="true">-</lit><clauseMkr target="1c" lang="en">1c</clauseMkr>]<lit noSpaceBefore="true">]</lit>` — **first and last** dependent rows only, as **two** elements with a `target` attribute.
- **Moved text:** `<moveMkr lang="userWs" [targetFirstOnLine="false"]>Preposed</moveMkr>` or `Postposed` — **not** `<<`/`>>` (those are screen-only); the target group's words carry `moved="true"`.
- **Dependent/speech/song rows:** `<lit noSpaceAfter="true">[</lit>` before the first word group of a `StartDependentClauseGroup` row, `<lit noSpaceBefore="true">]</lit>` after the last of an `EndDependentClauseGroup` row. List-ref tags stay outside the brackets.
- **`lit` spacing:** `noSpaceBefore` if the literal starts with `]` or `)`; `noSpaceAfter` if it ends with `[`, `(` or `-`. Directionality marks, empty strings and single spaces are dropped; text is NFC-normalised.
- **Notes cell:** an empty `Notes` still produces an empty `<note lang="…"/>` (inferred from `get_StringProp` returning an empty TsString; the tests only cover a non-empty note).
- **Notes side and column widths are per-user `PropertyTable` local settings**, not data, and not synced (`ConstituentChart.cs:790-800,1555-1604`).

### 7.2 Corrections to `PLAN.md` §4

| PLAN row | Correction |
|---|---|
| `ConstChartMovedTextMarker` → "`<lit>` with `<<` / `>>`" (`PLAN.md:95`) | **Wrong.** It is `<moveMkr>Preposed</moveMkr>` / `Postposed`, plus `moved="true"` on the target's `<word>`s, plus `targetFirstOnLine="false"` when an earlier moved group exists in that row. `DiscourseExporter.cs:150-152,287-297`; `ConstChartVc.cs:421-433`. Your XSLT already has a `moveMkr` template. |
| `ConstChartClauseMarker` → "Text = the dependent rows' labels (`1b`, `1b-1c`)" (`PLAN.md:94`) | **Wrong.** Two separate `<clauseMkr target="…">` elements with a `-` `<lit>` between, wrapped in `[` `]` lits. `DiscourseExporter.cs:130-139`; `ConstChartVc.cs:435-444,573-594`. |
| Template row: "`title1` = top-level groups, `title2` = leaf columns" (`PLAN.md:89`) | Incomplete. FLEx emits **one title row per tree depth** with placeholder cells; a leaf directly under the root is labelled in title1 and gets an empty cell in lower rows. `MultilevelHeaderModel.cs:16-80`; `DiscourseExporter.cs:361-386`. |
| `ConstChartRow` … "`Label` → `<rownum>`" (`PLAN.md:90`) | Also add `id="<Label>"` on the `<row>` element. |
| "`ConstChartRow.Notes` → `<note>` in the last cell" (`PLAN.md:91`) | The Notes cell is **first** when `notesOnRight` is false (or, in an RTL chart, when it is true) — the test is `NotesColumnOnRight XOR RightToLeft`. |
| `ConstChartWordGroup` → "`<word guid>` per analysis" (`PLAN.md:92`) | **`guid` cannot be a token key** — see §8.2. Also: wordform occurrences only (skip punctuation), baseline text, and `(` `)` lits around `listRef`. |
| `<languages>` "Informational" (`PLAN.md:96`) | Emitted **after** `<chart>`, with `font`, and `vernacular`/`RightToLeft` flags. |
| Missing entirely | The automatic `---` missing markers in `Subject`/`Verb` columns, which every default-template export contains. |

Also: your renderer's XSLT recognises only `title1`/`title2` as header rows and takes the row label from `cell[1]` (`docs/textchart/textchart-to-html.xsl:246-258,300-330`). A 3-level template or a notes-on-left export mis-renders. Either normalise in the sidecar (always emit notes last; collapse extra header levels) or extend the XSLT. I would normalise in the sidecar — you control it.

### 7.3 Corrections to `desktop/sidecar/fdat_lcm.py`

`export_chart_xml` (line 189) currently mirrors the synthetic fixture, so it diverges from FLEx at essentially every point. Concrete fixes:

| Line(s) | Now | Should be |
|---|---|---|
| 196-206 | `<languages>` before `<chart>` | Move after `</chart>`; add `font`, `RightToLeft`; emit only WSs actually used |
| 208-219 | `<cell cols="1">#</cell>`, `<cell>Row</cell>`, `Notes` in both title rows, bare text | `<cell cols="1"><main /></cell>` for the row-number header; `<main><lit lang=…>` for group/leaf labels; `Notes` header in title1 only; one title row per template depth (`template_columns` at line 129 assumes exactly two levels — make it recursive over `SubPossibilitiesOS` and emit placeholders) |
| 223-226 | `endSent` and `endPara` written independently | `if EndParagraph: endPara else if EndSentence: endSent`; attribute order endPara/endSent → type → id |
| 220-227 | no `id` | `id=<Label text>` when non-empty |
| 230-241 | parts bucketed by leaf, merges ignored | Implement the `MergesBefore`/`MergesAfter` width algorithm; always write `cols`; write `reversed="true"` on multi-column `MergesBefore` cells; emit `<cell cols="1"><main /></cell>` per empty column |
| 244-249 | `<word guid=<analysis guid>>`; `analysis_form_and_gloss` uses `WfiWordform.Form` | Emit the **occurrence key** (§8.2), keep the analysis GUID in a separate attribute; use the segment **baseline** text; skip punctuation occurrences (`analyses_of`, line 140, currently yields every `IAnalysis` including `PunctuationForm`); `moved="true"` when a `ConstChartMovedTextMarker` targets the group; gloss `***` when absent |
| 250-253 | bare `<listRef>` | Wrap in `<lit noSpaceAfter>(</lit>` … `<lit noSpaceBefore>)</lit>`; add `lang` |
| 254-257 | single `<clauseMkr>1b-1c</clauseMkr>` | Two `<clauseMkr target=…>` + `-` lit, inside `[` `]` lits |
| 258 | `<lit>&lt;&lt;</lit>` | `<moveMkr lang=…[ targetFirstOnLine="false"]>Preposed|Postposed</moveMkr>` |
| 266 | `<main></main>` (no `<note>`) for empty notes | `<main><note lang="…"/></main>` |
| — | absent | `---` missing markers for empty `Subject`/`Verb` columns and null-`TagRA` tags; `lang` attributes on every `word`/`gloss`/`lit`/`listRef`/`clauseMkr`/`rownum`/`note`; dependent/speech/song bracket lits |

`test/fixtures/sample-chart.xml` is synthetic and shares every divergence — regenerate it from a real export once the spike runs. In particular the fixture's speech-row quote lits are something FLEx never emits.

---

## 8. GUID stability and re-anchoring

### 8.1 What survives what

| Edit in FLEx | `DsConstChart` | `ConstChartRow` | `ConstChartWordGroup` |
|---|---|---|---|
| Row renumber / label change | — | **kept** (only `Label` rewritten) | — |
| Move cell into an **empty** cell/row | — | kept | **kept** (`ColumnRA` change or `CellsOS.MoveTo` re-inserts the same object) |
| Move/merge into an **occupied** cell | — | kept | **destroyed** (destination grows, source removed) |
| Move single words | — | kept | shrink/grow; emptied group deleted; new group created in an empty destination |
| Remove a row's last cell part | — | **deleted**, unless `Notes` has text | — |
| `RemoveMissingMarker` on a marker-only row | — | **deleted and recreated with a NEW GUID** (label/flags copied) | n/a (no word group existed) |
| "Clear chart from here on" | kept | **deleted** | deleted |
| Baseline edit | kept | may be deleted | adjusted or deleted by `AnalysisAdjuster` |
| Chart open (`CleanupInvalidChartCells`) | kept | may be deleted; **all rows cleared** if no word group remains (Notes dumped to `SavedNotes.txt`) | invalid ones deleted |
| Template deleted | retargeted to default | — | — |
| Text deleted | chart deleted with it | — | — |

`ConstituentChartLogic.cs:1399-1422,1446-1515,1727-1765,2426-2470,2813-2965,3482-3537,3769-3920,4700-4890`; `liblcm/.../OverridesLing_Disc.cs:27-48`; `liblcm/.../Vectors.cs:2077-2100`; CA §2.

**Net:** `DsConstChart.Guid` is durable for the life of the text (but expect **several charts per text**, one per `(BasedOn, Template)` pair — CA 2.2). `ConstChartRow.Guid` is a good working key that can nevertheless vanish. **Cell-part GUIDs are the least stable — key nothing on them.**

### 8.2 Word tokens have no GUID — a correction to PLAN §4

A word token is an `AnalysisOccurrence`, literally the pair `(Segment, Index)`, with equality defined on exactly those two values and no GUID of its own (`liblcm/src/SIL.LCModel/DomainServices/AnalysisOccurrence.cs:25-45,74-78`). The GUID FLEx writes on `<word>` in its own interlinear export is the `IAnalysis` GUID, and FLEx's own comment says it "may well not be unique in the file" (`FieldWorks/Src/LexText/Interlinear/InterlinearExporter.cs:1093-1102`) — every occurrence of the same wordform shares it, and it is **replaced in place** whenever the user glosses the word (`AnalysisOccurrence.cs:52-66`).

**Emit instead:** `data-guid="<segmentGuid>:<index>"` as the render-time token identity, plus the enclosing `ConstChartWordGroup` GUID and the analysis GUID as separate, descriptive attributes. `docs/app.js:261-290` already builds a token registry keyed `rowIdx:kind:pos`; a real occurrence key replaces it.

For anything FDAT *persists* per token, anchor to a FLEx-maintained `IAnalysisReference` — the containing `ConstChartWordGroup` (GUID + ordinal within `GetOccurrences()`) or a one-token `TextTag`. Those are the only two classes `AnalysisAdjuster` maintains (`liblcm/.../AnalysisAdjuster.cs:302-307`; `InterfaceAdditions.cs:326-330`).

### 8.3 Concrete re-anchoring strategy for rows

Persist, alongside every row GUID, a **re-anchoring tuple** — and recompute it from live objects on every load/refresh, never compare it against a stale snapshot:

```json
{
  "rowGuid": "…",
  "anchor": {
    "chartGuid": "…",
    "rowIndex": 12,
    "label": "3b",
    "firstGroup": { "segmentGuid": "…", "analysisIndex": 4, "columnGuid": "…", "baselineText": "wataka" },
    "clauseType": "normal", "endSentence": true
  }
}
```

Reconciliation on load:

1. **Row GUID hit** → done.
2. **Miss** → match on `(firstGroup.segmentGuid, analysisIndex, columnGuid)` read **live** from each row's first `ConstChartWordGroup`. These are the fields FLEx itself keeps current across baseline edits: `AnalysisAdjuster` shifts indices by removed/added counts, moves endpoints to a following segment on overflow, snaps inexact endpoints to the nearest wordform, deletes the reference when its text is gone, and re-homes references onto the surviving segment when segments merge (`AnalysisAdjuster.cs:521-746,878-975`).
3. **Tie-break on `baselineText`** — this is what FLEx's own `IConstChartWordGroup.IsAnalogousTo` does (same column + same baseline text of each occurrence; `liblcm/.../OverridesLing_Disc.cs:80-100`).
4. **Marker-only rows have no word group** (the `RemoveMissingMarker` recreation path in particular): fall back to `(chartGuid, rowIndex, label, clauseType)` and require an exact match.
5. **No match** → mark the data *orphaned*, keep it, and surface it in the UI. Never silently drop it and never silently re-bind on a weak match.

Caveats to design for:

- `ChangeToDifferentIndex` **clamps** into `[0, Count-1]` rather than invalidating, so a WordGroup can silently land on a neighbouring word (`OverridesLing_Disc.cs:179-197`).
- **Make-phrase / Break-phrase and full reparse rewrite `Segment.Analyses` directly with no reference adjustment** — FLEx's own comment: "Joining words renumbers the occurrences" (`AnalysisOccurrence.cs:252-328`; `FocusBoxController.cs:417-451`). Indices can be semantically wrong while still in range.
- FLExBridge merges `Segment.Analyses` **atomically** (one side wins wholesale) while WordGroup/TextTag indices merge per object, so indices can drift after a conflicting S/R with no local edit (`FieldWorksMergeServices.cs:245-252`).
- Run the reconciliation on **every refresh**, not just at load (FLEx edits arrive mid-session — §9).

---

## 9. Concurrency, write discipline, validation, deep links

### 9.1 Can FDAT run beside FLEx?

Only if the project's **Sharing** setting is on. LCM promotes a plain `kXML` open to `kSharedXML` when `LcmSettings.IsProjectSharingEnabled(projectFolder)` is true (`liblcm/src/SIL.LCModel/LcmCache.cs:209-226`; `LcmSettings.cs:66-74`); the user toggles it in **Project Properties → Sharing**, "Share project contents with programs on this computer" (`FieldWorks/Src/FwCoreDlgs/FwProjPropertiesDlg.cs:139-146`). flexlibs documents exactly this as the remedy for `FP_FileLockedError` (`flexlibs/flexlibs/code/FLExProject.py:208-232`). Otherwise the second opener hits `SimpleFileLock` on `<Name>.fwdata.lock` and gets `LcmFileLockedException` (`liblcm/.../XMLBackendProvider.cs:371-396`). Check first with `ProjectLockingService.IsProjectLocked(path)` (`liblcm/.../ProjectLockingService.cs:62-67`) and show the Sharing-tab remedy — **never toggle it silently**. (CA's "Addendum: project sharing mode" covers this; nothing new contradicts it.)

Shared mode = a per-project `GlobalMutex` plus two memory-mapped files forming a commit log; the first peer takes the `.lock` file and is **Master**, the only process that rewrites the `.fwdata` (`SharedXMLBackendProvider.cs:19-36,96-158`). So **FDAT's writes are on disk only after the Master's next save**.

### 9.2 What the FLEx user sees when FDAT writes

FLEx's save timer runs unconditionally (no unsaved-changes check), throttled to ≥10 s since the last save and ≥2 s since the last user activity, so an idle FLEx picks up FDAT's commits in **~10-12 s** (`liblcm/.../UnitOfWorkService.cs:174-262,287-345`). `SharedXMLBackendProvider.Commit` reads unseen foreign records and, if `ChangeReconciler.OkToReconcileChanges()` passes, applies them as a non-undoable UOW and `SimulateRedo()`s it — ordinary `PropChanged` notifications, **no forced MasterRefresh** (`SharedXMLBackendProvider.cs:377-418`; `ChangeReconciler.cs:200-303`). A **custom-field-only** change *does* produce a `PropChanged` (the reconciler diffs `<Custom>` elements too), but the rootbox's notifier finds no displayed occurrence and does nothing: no redraw, no crash, **no visible effect** (`ChangeReconciler.cs:769-800`; `FieldWorks/Src/views/VwNotifier.cpp:424-482`; `ConstChartVc.cs:245-306`). That is exactly what you want from additive, FDAT-namespaced data.

**The one severe failure mode:** a foreign change to *any object* the FLEx user has **unsaved** edits on — even a different field — is irreconcilable (only `DateModified` and `OwningCollection` differences auto-merge on a shared object). It pops the modal "FieldWorks cannot save your changes" dialog, halts auto-save, and a user Refresh **reverts all their unsaved work** (`ChangeReconciler.cs:55-166`; `UnitOfWorkService.cs:245-246,329-434`; `FieldWorks/Src/FdoUi/Dialogs/ConflictingSaveDlg.resx:121`). Writing a custom field on a `DsConstChart` while the user has unsaved edits on that chart is exactly this case: the custom-field difference is not one of the two exempt kinds, so the fact that `Rows` is an owning sequence rather than a collection does not even come into it. **Mitigation:** keep FDAT's write windows short (≤1 s), prefer writing to `ConstChartRow` objects the user is not currently editing, and consider warning when FLEx is a peer. Spike §1.4 step 10 decides whether chart-level writes are allowed at all with FLEx open.

### 9.3 Write discipline

```
open read-only            FLExProject.OpenProject(name)          # no UOW held
refresh poll (N s)        IUndoStackManager.Save()               # no local changes → pulls & reconciles foreign changes
write                     BeginNonUndoableTask() → set fields → EndNonUndoableTask() → Save()
```

- The canonical wrapper is `NonUndoableUnitOfWorkHelper.Do(cache.ActionHandlerAccessor, () => {…})`, which rolls back and rethrows on exception (`liblcm/src/SIL.LCModel/Infrastructure/NonUndoableUnitOfWorkHelper.cs:26-166`).
- `Save()` is **illegal while a UOW is open** — it rolls back and throws `"Commit at wrong place"` (`UnitOfWorkService.cs:284-305`). flexlibs' stock `OpenProject(writeEnabled=True)` holds one non-undoable task open for the whole session (`FLExProject.py:256-290`), which is fine for a script and **wrong for a long-running app** — do not copy it.
- **Never touch `<Name>.fwdata` directly.** LCM compares the file's last-write time before saving and refuses if another program touched it: "FieldWorks cannot safely save your changes, because another program has modified the file" (`liblcm/.../XMLBackendProvider.cs:518-535`). Writing FDAT's own file under `LinkedFiles` does not trip this.
- **Set `LcmSettings.DisableDataMigration = True`** and surface `FP_MigrationRequired` as "open this project in FLEx once first" — SIL's explicit guidance (`flexlibs/flexlibs/code/FLExLCM.py:72-110`; `FLExProject.py:239-247`). A non-master shared peer cannot migrate anyway (`SharedXMLBackendProvider.cs:108-111`).
- **Cheap refresh token:** LCM bumps `DateModified` on the nearest owner that has one, and rows/cells are owned by `DsConstChart`, which has one via `CmMajorObject` — so any row or cell edit bumps `DsConstChart.DateModified` (`liblcm/.../CmObject.cs:3654-3675`; `UndoStack.cs:295-311`; CA addendum 3). Track a second token on `DsDiscourseData.ChartMarkersOA.DateModified` for marker/template changes, and record the token observed right after FDAT's own saves so the app does not re-export in a loop.

### 9.4 Send/Receive interaction

FLEx **refuses S/R while another application is connected** — "Please close all other applications that are using this project before continuing" — and unlocks/saves the project before launching FLExBridge (`FieldWorks/Src/LexText/Lexicon/FLExBridgeListener.cs:310-361`; `LexEdStrings.resx:581-583`). FLExBridge then writes its own empty `<Name>.fwdata.lock` for the duration (`flexbridge/src/FLEx-ChorusPlugin/.../SendReceiveActionHandler.cs:69-75`). So: **FDAT must dispose its cache before the user can S/R** — expose an explicit "disconnect" and surface "project is locked (FLEx or Send/Receive is running)" rather than crashing.

### 9.5 Validation

`FixFwData.exe` (from the FLEx install dir; `FieldWorks/Src/Utilities/FixFwData/Program.cs:20-47`, wrapping `liblcm/src/SIL.LCModel.FixData/FwDataFixer.cs`) rewrites the closed `.fwdata` and returns exit code 1 if anything was reported. Run it **only when every process has released the project**. Note FLExBridge itself runs the fixer in `PrepareForPostMergeCommit` — i.e. **after an actual 3-way merge**, not on a pull-only update (`flexbridge/.../FlexBridgeSynchronizerAdjunct.cs:66-124`). So a colleague who only receives can carry a dangling reference for a while; that is another argument for `ReferenceCollection` over `ReferenceAtomic`.

### 9.6 Deep links into FLEx

`silfw://localhost/link?` + urlencoded `database=<Proj>&tool=<tool>&guid=<guid>&tag=<tag>[&<Prop>=<value>]` (`FieldWorks/Src/Common/FwUtils/FwLinkArgs.cs:39-84,307-333`). There is **no discourse-chart tool**; the chart is a tab inside `interlinearEdit`. FLEx's own history links carry `tag=<tab>` plus a property-table entry, and `LinkListener` applies every `PropertyTableEntries` item after jumping (`InterlinMaster.cs:512-517,1225-1256`; `LinkListener.cs:582-586`). So, **inferred, needs an end-to-end Windows test**:

```
silfw://localhost/link?database%3d<Proj>%26tool%3dinterlinearEdit%26guid%3d<TextGuid>%26tag%3dConstituentChart%26InterlinearTab%3dConstituentChart
```

Build it with `FwAppArgs(project.ProjectId.Handle, "interlinearEdit", textGuid)` as flexlibs does (`flexlibs/flexlibs/code/FLExProject.py:478-520`) and launch with `os.startfile`. For a marker, `tool=chartmarkEdit&guid=<markerGuid>` (`Lists/areaConfiguration.xml:95-96`).

---

## 10. Open questions

**Not settled by the §1.4 spikes** (either untestable this week or outside a two-machine round trip):

1. **Does any FLEx UI outside the sparse checkout render `CmPossibility.ForeColor`/`BackColor`?** Only `Src/{LexText,xWorks,Common,FdoUi}` and `Configuration` were searched. This is the residual risk in putting marker colours on the possibilities (§1.1, §5.4).
2. **Are `DsChart.Name`/`.Description` displayed anywhere in FLEx** (Lists, bulk edit, a browse column)? CA 1.7 is an inference from a grep of the sparse checkout; it decides whether `Description` is a legitimate zero-schema fallback for `FDAT_ChartSettings`.
3. **Undo/Redo of a deleted row or cell part** — does LCM restore the original GUID? (Open in CA too.) Determines how aggressively FDAT should orphan data.
4. **Does the chart's Notes cell honour run-level character styles?** `OpenNoteCell` comments "Note shouldn't be formatted" and applies cell-level `"normal"` formatting.
5. **Does a large project's open time make the read-only + poll model practical?** Measure alongside the spike.
6. **Does FLEx accept a custom field name containing a space** (`"FDAT data"`) on a class its dialog never sees? Avoid the question: use `FDAT_Data` (§3.7.6).
7. **The `silfw://` deep link with `InterlinearTab=ConstituentChart`**, both with FLEx closed and already running.

**Documents that exist only on hosts blocked from this environment** (please fetch them yourself; I could not):

- **"Technical Notes on FieldWorks Send-Receive"** (PDF) — open from an installed FLEx: **Help → Resources → "Technical Notes on FieldWorks Send-Receive…"**, shipped at `<FW code dir>/Helps/Language Explorer/Training/Technical Notes on FieldWorks Send-Receive.pdf` (`FieldWorks/DistFiles/Language Explorer/Configuration/Main.xml:163`; `Src/LexText/LexTextDll/LexTextApp.cs:612-624`). Also published at `software.sil.org/fieldworks/support/technical-documents/` (**blocked**). Wanted for: what it says about LinkedFiles, size limits, and `do_not_share_project.txt`.
- **"FLEx 9.1 Conceptual Model"** and **"Python for FlexTools and FLEx 9.1"** PDFs at `downloads.languagetechnology.org` (**blocked**). The FLExTools wiki points at both; `MasterLCModel.xml` in the clone is the authoritative model reference in the meantime.
- **`khtpProjectProperties_Sharing`** help topic on `software.sil.org` (**blocked**) — the only prose on the Sharing setting besides the flexlibs docstring.
- The FLExTools wiki has **no** page on custom fields, creating them, or the `FLExProject` custom-field API (`https://github.com/cdfarrow/FLExTools/wiki/Technical-documentation`), and flexlibs' sphinx docs contain no `custom` mention — so there is **no documented precedent** for programmatic custom-field creation. FDAT is relying on the LCM API directly, which is well-defined but untrodden.

---

## Appendix: Reviewer notes

Every correction from both reviews was applied. Three were applied with a change of shape rather than verbatim:

- **Review 1 #3 (marker styling vs CA addendum 5).** I adopted CA's split rather than my own blanket "put all three in FDAT's own store": colour on `ForeColor`/`BackColor`, `Hidden` only for project-wide intent, everything else (bold/italic/size, per-chart overrides, FDAT grouping and order) in `FDAT_DiscourseSettings` keyed by marker GUID. The one place I keep my stronger line is **display order**: CA itself says FDAT should read the marker hierarchy and not restructure it, and reordering `ChartMarkersOA.PossibilitiesOS` demonstrably changes FLEx's own cell context menu (`ConstituentChartLogic.cs:2370-2372,3139-3181`), so PLAN's "display order = list order" stays rejected. That is consistent with CA, not a departure from it.
- **Review 2 #15 (scope vs §7).** I extended the Scope sentence to name the export spec rather than splitting §7 into a separate document, because §7.2/§7.3 are the corrections the owner asked for in this report's brief. §1.4's export step was demoted to last and labelled as an export task, not a storage spike.
- **Review 2 #18 (dedupe §10).** Rather than cross-referencing spike numbers item by item, I deleted the six §10 entries that the §1.4 steps now cover and kept only what a two-machine round trip cannot answer, plus the blocked documents.