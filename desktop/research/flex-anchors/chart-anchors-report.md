# Chart-level anchors and custom fields on chart classes (investigation report)

Produced by a focused investigator agent over the cloned sources (liblcm, FieldWorks sparse checkout,
FLExBridge). Four decision-critical claims (3.1, 3.7, 3.9, 2.11) were re-read in the source by the
session owner and hold. Other claims are as the agent reported them; the main research workflow's
skeptics have not covered this report.

Source roots (scratchpad clones):
- LCM = `liblcm/src/SIL.LCModel`, FIX = `liblcm/src/SIL.LCModel.FixData`
- FW = `FieldWorks` (sparse checkout), FB = `flexbridge/src/LibFLExBridge-ChorusPlugin`

## Q1 — Fields on DsConstChart; does FLEx use Name/Description?

| # | Claim | Evidence | Source | Conf. | Stated/Inferred |
|---|---|---|---|---|---|
| 1.1 | `DsConstChart` own fields: `BasedOn` (ref atomic StText), `Rows` (owning seq ConstChartRow). | `<rel num="1" id="BasedOn" card="atomic" sig="StText">` … `<owning num="2" id="Rows" card="seq" sig="ConstChartRow">` | LCM/MasterLCModel.xml:4897-4913 | High | Stated |
| 1.2 | Inherited from `DsChart`: `Template` (ref atomic CmPossibility) — "Template must refer to a top-level CmPossibility in … the template possibility lists of the DsDiscourseData". | comment | MasterLCModel.xml:4885-4896 | High | Stated |
| 1.3 | Inherited from `CmMajorObject`: `Name` (MultiUnicode), `DateCreated`, `DateModified` (Time), `Description` (MultiString), `Publications` (owning col Publication), `HeaderFooterSets` (owning col PubHFSet). Publications/HeaderFooterSets comments refer to Scripture/TE only. | | MasterLCModel.xml:240-257 | High | Stated |
| 1.4 | `ConstChartRow`: `Notes` (String), `ClauseType` (Integer enum Normal/Dependent/Song/Speech), `EndParagraph`, `EndSentence`, `StartDependentClauseGroup`, `EndDependentClauseGroup` (Boolean), `Cells` (owning seq ConstituentChartCellPart), `Label` (String). | | MasterLCModel.xml:2679-2691 | High | Stated |
| 1.5 | `ConstituentChartCellPart` (abstract): `Column` (ref atomic CmPossibility), `MergesAfter`, `MergesBefore`. Subclasses: `ConstChartWordGroup` (BeginSegment/EndSegment refs, Begin/EndAnalysisIndex), `ConstChartMovedTextMarker` (WordGroup ref, Preposed), `ConstChartClauseMarker` (DependentClauses ref seq ConstChartRow), `ConstChartTag` (`Tag` ref atomic CmPossibility; "If Tag is null … 'missing' marker"; "The CmPossibilities come from the list of chart tags"). | | MasterLCModel.xml:2813-2871 | High | Stated |
| 1.6 | `DsDiscourseData` (singleton): `ConstChartTempl` (OA CmPossibilityList), `Charts` (OC DsChart), `ChartMarkers` (OA CmPossibilityList; "top-level is several different kinds of markers … below those are the (sometimes hierarchical) lists"). | | MasterLCModel.xml:4914-4935 | High | Stated |
| 1.7 | No FLEx code reads or writes a chart's `Name` or `Description`. Whole-`Src` grep for `IDsConstChart|DsConstChart|DsChart` outside the Discourse folder hits only `LinkListener.cs:521-524` (jumps to `BasedOnRA`) and `InterlinearTextsRecordClerk.cs:335` (creates a chart). Inside Discourse, `.Name`/`.Description` hits are column/possibility names only. | grep | FW/Src/xWorks/LinkListener.cs:521-524; FW/Src/LexText/Interlinear/InterlinearTextsRecordClerk.cs:325-337; FW/Src/LexText/Discourse/* | High | Inferred from grep of the sparse checkout |
| 1.8 | Configuration XML has no layout/part for `DsConstChart`/`DsChart`; only the two DsDiscourseData lists are configured (`chartmarkEdit`, `charttempEdit`). | | FW/DistFiles/Language Explorer/Configuration/Lists/areaConfiguration.xml:96,99,601,611; Lists/Edit/toolConfiguration.xml:101 | High | Stated (grep) |
| 1.9 | The exporter writes `<document><chart>…` with no chart name/description; only row Label/Notes and column names are emitted. | `m_writer.WriteStartElement("chart"); m_vc.Display(this, OpenObject, ConstChartVc.kfragPrintChart);` | FW/Src/LexText/Discourse/DiscourseExporter.cs:84-93, 127-130, 162 | High | Stated |
| 1.10 | `DateModified` on the chart is maintained by LCM: the UndoStack updates the nearest owner with a DateModified property whenever an owned object is dirtied; rows/cells are owned by the chart. `DateCreated` is set at creation. | | LCM/Infrastructure/Impl/UndoStack.cs:295-311; LCM/DomainImpl/CmObject.cs:3639-3675; FB tests …/FieldWorksDiscourseAnalysisTypeHandlerTests.cs:150-152 | High (mechanism) | Inferred |
| 1.11 | `ConstChartRow.Notes` is user-visible/editable (Notes column) and `Label` is auto-renumbered — neither is free for FDAT. | `vwenv.AddStringProp(ConstChartRowTags.kflidNotes, this)`; `RenumberRows`; `DeleteMyselfIfEmpty` keeps a row alive only if Notes non-empty | ConstChartVc.cs:301-302; ConstituentChartLogic.cs:1727, 1582-1587; LCM/DomainImpl/OverridesLing_Disc.cs:41-47 | High | Stated |

Net: `Name`, `Description`, `Publications`, `HeaderFooterSets` on DsConstChart are never read, displayed, edited or exported by FLEx (inferred from grep; no UI layout exists for the class). `DateCreated`/`DateModified` are maintained by LCM.

## Q2 — Chart creation, multiplicity, deletion, and object identity under edits

| # | Claim | Evidence | Source | Conf. | S/I |
|---|---|---|---|---|---|
| 2.1 | Opening the Text Chart tab finds the chart for the text (last-used chart GUID from property key `LastChartForText_{textGuid}`, else the first chart whose `BasedOnRA` is the text) or creates one with the default template; then `CleanupInvalidChartCells()`. | | FW/Src/LexText/Discourse/ConstituentChart.cs:703-733, 1101-1133, 988-992 | High | Stated |
| 2.2 | Several charts can exist for one text — one per template ("Detect if there is already a chart created for the given text and template … If there is no such chart, then create one"). | | ConstituentChart.cs:875-893 | High | Stated |
| 2.3 | A chart is created automatically when a new text is created in the Texts tool. | | FW/Src/LexText/Interlinear/InterlinearTextsRecordClerk.cs:325-337 | High | Stated |
| 2.4 | Factory `Create(data, text, template)` adds to `ChartsOC`, sets `TemplateRA`, `BasedOnRA`; nothing sets Name/Description. | | LCM/DomainImpl/FactoryAdditions.cs:936-957 | High | Stated |
| 2.5 | No FLEx UI deletes a chart. Charts are deleted only with their text (`StText.OnBeforeObjectDeleted`). "Clear from here on" deletes rows/cells only; cleanup can clear all rows but keeps the chart; if the template is deleted the chart is retargeted to the default template. | | LCM/DomainImpl/StText.cs:56-72; ConstituentChartLogic.cs:1446-1516, 2836-2843, 2958; ConstituentChart.cs:748-752 | High | Stated |
| 2.6 | `InsertRow`/`MakeNewRow` create new row objects; `RenumberRows` only rewrites `Label`. | | ConstituentChartLogic.cs:1399-1414, 1549-1587 | High | Stated |
| 2.7 | `ChangeColumn` keeps the same cell-part objects; `ChangeRow` moves parts between owners with `CellsOS.MoveTo`. | | ConstituentChartLogic.cs:3498-3538 | High / Medium | Stated / Inferred |
| 2.8 | `MoveCellBack/Forward` → `MergeCellContents`: into an empty destination the WordGroups are moved; into an occupied one the destination grows and the source WordGroup is removed; an emptied row is deleted and rows renumbered. | | ConstituentChartLogic.cs:3692-3757, 4589-4890 | High | Stated |
| 2.9 | `MoveWordBack/Forward` creates a new WordGroup in an empty destination and shrinks/deletes the source. | | ConstituentChartLogic.cs:3769-3890, 3915-3920 | High | Stated |
| 2.10 | `ToggleMergedCellFlag` only flips flags on the existing part; `DeleteCellParts` deletes parts. | | ConstituentChartLogic.cs:3414-3437, 3572-3576 | High | Stated |
| 2.11 | Rows auto-delete when their last cell part is removed unless Notes has text (`RemoveObjectSideEffectsInternal` → `DeleteMyselfIfEmpty`). `RemoveMissingMarker` recreates a row as a new object when removing the marker would empty it. | | LCM/DomainImpl/OverridesLing_Disc.cs:27-49; ConstituentChartLogic.cs:2414-2470 | High | Stated (spot-checked) |
| 2.12 | Cascading auto-deletes: `ConstChartTag` deletes itself when its `Tag` possibility is deleted; `ConstChartMovedTextMarker` when `WordGroupRA` becomes null; `ConstChartClauseMarker` when it references no rows. | | OverridesLing_Disc.cs:446-457, 406-421, 321-341 | High | Stated |
| 2.13 | Editing the baseline deletes WordGroups whose text disappears (`AnalysisAdjuster`); `CleanupInvalidChartCells` (every open) removes invalid parts, may delete rows, and clears all rows if no WordGroups remain (saving Notes to `SavedNotes.txt`). | | LCM/DomainImpl/AnalysisAdjuster.cs:302-307, 730-742; ConstituentChartLogic.cs:2813-2962 | High | Stated |
| 2.14 | Past data migrations have rewritten cell-part objects wholesale (7000010, 7000013). | | LCM/DomainServices/DataMigration/DataMigration7000010.cs:140-166,249; DataMigration7000013.cs:19-30 | High | Stated (history) |

Net: `DsConstChart` GUID is stable for the life of the text (multiple charts per text possible, one per template). `ConstChartRow` GUIDs survive in-place edits but rows are deleted when emptied, recreated in the missing-marker path, and wiped by "Clear from here on"/cleanup. Cell-part GUIDs are the least stable.

## Q3 — Programmatic custom fields on DsConstChart / ConstChartRow

| # | Claim | Evidence | Source | Conf. | S/I |
|---|---|---|---|---|---|
| 3.1 | No LCM-level class whitelist: `AddCustomField(className, …)` only does `CheckClid(className)`, rejects a name clashing with a non-custom field, allocates flid `clid*1000+500+n`. | `CheckClid(className); var clid = m_nameToClid[className]; … if (m_nameToFlid.TryGetValue(…) && !IsCustom(flid)) throw …` | LCM/Infrastructure/Impl/LcmMetaDataCache.cs:920-965, 1380-1384; IFwMetaDataCacheManaged.cs:86,134 | High | Stated (spot-checked) |
| 3.2 | Definitions persist in the fwdata `<AdditionalFields><CustomField name class type …/>` and reload generically; values are stored generically on any `CmObject`. | | LCM/Infrastructure/Impl/XMLBackendProvider.cs:226-250, 551-568; BackendProvider.cs:813-838; CmObject.cs:1229-1230, 1339-1340, 2539-2545 | High | Stated |
| 3.3 | `FieldDescription.UpdateCustomField()` (the dialog's path) just calls `mdc.AddCustomField(...)`; no class check. | | LCM/FieldDescription.cs:336-407 | High | Stated |
| 3.4 (a) | FLEx's Custom Fields dialog offers only LexEntry/LexSense/LexExampleSentence/MoForm, Segment, RnGenericRec, and filters out existing custom fields on any other class (`where fd.IsCustomField && GetItem(m_locationComboBox, fd.Class) != null`): FDAT fields would be invisible there (not editable/deletable via UI) but do not crash the dialog. | | FW/Src/xWorks/AddCustomFieldDlg.cs:110-133 | High | Stated |
| 3.5 (a) | Chart tab: `ConstChartVc` renders fixed fragments only; no generic field enumeration, so custom fields on chart/row are neither shown nor touched. DataTree custom slices are built only for the class chain being edited, and no DataTree exists for charts. | | ConstChartVc.cs:277-302, 570; FW/Src/Common/Controls/DetailControls/DataTree.cs:2487-2499; FW/Src/xWorks/Avalonia/Composer/DetailComposer.cs:783 | High | Inferred |
| 3.6 (a) | Risk: `DeleteCustomList` deletes all custom fields whose `ListRootId` equals a list being deleted, regardless of class. Lexicon import restricts to class ids 5000-5999; LIFT export iterates per class. | | FW/Src/xWorks/DeleteCustomList.cs:110-118; FW/Src/LexText/LexTextControls/LexImportWizard.cs:767-769 | Medium | Stated/Inferred |
| 3.7 (b) | FLExBridge writes custom properties generically for any class: definitions → `FLExProject.CustomProperties`; values → `<Custom name="…">` children handled generically in nesting, validation and merge. Merge keys `Custom_<class>_<name>`, where under `DsChart`/`ownseq` parents the class comes from the `class` attribute — the shape of charts and rows. Per-class strategies are generated for every property of every concrete class; the discourse handler passes `addCustomPropertyInformation: true`. | | FB/Handling/CustomProperties/CustomPropertiesTypeHandlerStrategy.cs:38-80; FB/DomainServices/CmObjectNestingService.cs:114-115; FB/DomainServices/CmObjectValidator.cs:88-93; FB/Handling/FieldWorksElementToMergeStrategyKeyMapper.cs:13-22, 47-55; FB/DomainServices/FieldWorksMergeServices.cs:208-323; FB/Handling/Linguistics/Discourse/DiscourseAnalysisFileTypeHandlerStrategy.cs:78-81; FB/Handling/FieldWorksCommonFileHandler.cs:57-62; FB/Infrastructure/MetadataCache.cs:447-506 | High | Stated (spot-checked) |
| 3.8 (b) | `MetadataCache.AddCustomPropInfo` attaches the prop to the named class and silently skips unknown classes; strategies come from concrete classes. Declare on concrete `DsConstChart`/`ConstChartRow`, not abstract `DsChart`. | | MetadataCache.cs:447-452, 493-504; FieldWorksMergeServices.cs:101-105 | Medium | Inferred |
| 3.9 (c) | `BasicCustomPropertyFixer` handles only Integer/GenDate custom fields, matching `rt` class names exactly (MoForm subclass kludge only). Works for concrete DsConstChart/ConstChartRow; a field on abstract DsChart would never get defaults. | | FIX/BasicCustomPropertyFixer.cs:22-66, 68-104 | High | Stated (spot-checked) |
| 3.10 (c) | `CustomPropertyFixer` removes any `<Custom>` not declared in AdditionalFields; `OriginalFixer` removes dangling `objsur` links. FixFwData runs before Send/Receive. | | FIX/CustomPropertyFixer.cs:15-53, 61-68; FIX/FwDataFixer.cs:63-66, 272-293; FB/Infrastructure/FlexBridgeSynchronizerAdjunct.cs:89-100 | High | Stated |
| 3.11 (d) | Data migrations handle custom fields generically; no migration inspects/blocks custom fields on discourse classes. | | LCM/DomainServices/DataMigration/IDomainObjectDTORepository.cs:712-718; DataMigration7000017.cs:194-232; DataMigration7000069.cs:362-373 | High | Stated (grep) |

## Q4 — Possibility references: Tag, Column, Template

| # | Claim | Evidence | Source | Conf. | S/I |
|---|---|---|---|---|---|
| 4.1 | Tag display is list-agnostic: shows the possibility's Abbreviation (first analysis WS), falling back to Name, in "marker" style (`<marker color="Orange" brackets="()"/>`). No check that the possibility is in ChartMarkers. | | ConstChartVc.cs:277-297; ConstituentChartStyleInfo.xml:16 | High | Stated |
| 4.2 | No LCM validation of Tag's list; `ConstChartTag` only auto-deletes when its possibility is deleted. Factory requires non-null column and marker. | | LCM/DomainImpl/OverridesLing_Disc.cs:441-460; FactoryAdditions.cs:763-800 | High | Stated |
| 4.3 | The cell context menu is built from `DiscourseDataOA.ChartMarkersOA` recursively; only leaves clickable; add/remove via `MakeChartTag`/`RemoveListItemPart`. | | ConstituentChartLogic.cs:2370-2372, 3139-3181, 3202-3226, 2251-2263 | High | Stated |
| 4.4 | Default ChartMarkers structure is groups → items (any depth); user-editable in Lists. | | LCM/DomainImpl/OverridesLangProj.cs:466-530 | High | Stated |
| 4.5 | A tag with a non-null Tag is non-content for missing-marker logic, and `CleanupInvalidChartCells` never removes `IConstChartTag`s. | | ConstituentChartLogic.cs:2390-2402, 2858-2859 | High | Stated |
| 4.6 | Column must be a leaf of the chart's template: a part whose column is not in `AllColumns` triggers `ReportAndFixBadCellPart` (message box) and `ColumnRA` is reassigned in a non-undoable task. | | ConstituentChartLogic.cs:220, 898-922, 2184-2190; MakeCellsMethod.cs:156-185, 302-325 | High | Stated |
| 4.7 | Template must be a top-level item of `ConstChartTempl`; charts for different templates are different objects. | | MasterLCModel.xml:4890-4893; OverridesLangProj.cs:370-380; ConstituentChart.cs:851-866 | High | Stated |
| 4.8 | Custom possibility lists sync in `General/UserDefinedLists/*.list`; `ChartMarkers` and `ConstChartTempl` sync as `Linguistics/Discourse/ChartMarkers.list` / `ConstChartTempl.list`. | | FB/Contexts/General/UserDefinedLists/UserDefinedListsBoundedContextService.cs:22-30; FB/Contexts/Linguistics/Discourse/DiscourseAnalysisBoundedContextService.cs:43-58 | High | Stated |

## Q5 — Where charts live in the split files and how they merge

| # | Claim | Evidence | Source | Conf. | S/I |
|---|---|---|---|---|---|
| 5.1 | Path: `Linguistics/Discourse/Charting.discourse` (plus `ChartMarkers.list`, `ConstChartTempl.list`). | | FB/Infrastructure/FlexBridgeConstants.cs:148-156; FlexFolderSystem.cs:77 | High | Stated |
| 5.2 | Shape: `<Discourse><header><DsDiscourseData …/></header><DsChart class="DsConstChart" guid="…">…`; owned sequences nest as `<Rows><ownseq class="ConstChartRow" guid=…><Cells><ownseq class="ConstChartWordGroup" …>`. | | FB/Contexts/Linguistics/Discourse/DiscourseAnalysisBoundedContextService.cs:60-88; CmObjectNestingService.cs:150-165; DiscourseChartContextGenerator.cs:38-52 | High | Stated |
| 5.3 | 2-way diff is per `DsChart` element keyed by `guid`; each `DsChart` object is validated. | | DiscourseAnalysisFileTypeHandlerStrategy.cs:26-76 | High | Stated |
| 5.4 | 3-way merge is element-level per object, not atomic: every concrete class gets `MergePartnerFinder = GuidKeyFinder, IsAtomic = false`; owning sequences use significant order; `Str`/`AStr` atomic, `AUni` per writing system; only `Segment.Analyses` and `FsFeatStruc` are atomic. | | FB/DomainServices/FieldWorksMergeServices.cs:62-120, 198-202, 208-323, 356-390 | High | Stated |

## Implications for FDAT

1. Anchor hierarchy: `DsConstChart.Guid` is the durable anchor. `ConstChartRow.Guid` is a usable secondary key, but rows vanish when emptied, are recreated in the missing-marker path, and are wiped by "Clear from here on"/cleanup: keep a re-anchoring fallback (chart GUID + row Label + column GUID + first WordGroup's BeginSegment + index) and reconcile on load. Do not key anything on cell-part GUIDs.
2. Expect more than one chart per text (one per template); pick by `(BasedOn, Template)`. FLEx's "last chart" memory is local-only.
3. Free-text slots on the chart itself: `DsConstChart.Name` (MultiUnicode) and `Description` (MultiString) are unused by FLEx; `AStr` merges atomically per field, `AUni` per writing system.
4. Custom fields are viable on `DsConstChart` and `ConstChartRow` via `IFwMetaDataCacheManaged.AddCustomField`: persisted/loaded by LCM, synced and merged generically by FLExBridge (keyed `Custom_<Class>_<name>`), safe with FixFwData. Declare on the concrete classes. Consequences: invisible in FLEx's Custom Fields dialog (users cannot remove them there), ignored by the chart tab; a list-ref field targeting a custom list is deleted if the user deletes that list. Prefer several small typed fields to one big string so merges stay granular.
5. Cell-level data via `ConstChartTag` only works without complaint if `Column` is a real leaf column of the chart's template; tags from an FDAT-owned list render as orange "(abbr)" markers in the chart and exports. Visible, not hidden, metadata.
6. Sync layout: everything lands in `Linguistics/Discourse/Charting.discourse` (custom-field definitions in `FLExProject.CustomProperties`; an FDAT custom list in `General/UserDefinedLists/`), merged per object by GUID with row/cell order significant.

## Open questions

- Whether `LcmOwningSequence.MoveTo` preserves moved objects' GUIDs (assumed yes; not verified).
- Whether FLExBridge's `FdoClassInfo.AllProperties` includes custom properties inherited from an abstract superclass (only matters if declaring on `DsChart`; recommendation is not to).
- Whether Undo/Redo restores deleted rows/cell parts with their original GUIDs.
- What `MergeCellContentsMethod` does with `ConstChartTag`s in the source cell when WordGroups are moved.
- The FieldWorks checkout is sparse; folders outside `Src/{Common,FwCoreDlgs,LexText,Utilities/FixFwDataDll,xWorks}` were not searched for uses of chart `Name`/`Description`.
- The Avalonia UI (`Src/xWorks/Avalonia`) was only spot-checked.

## Appendix: statements from SIL documentation supplied by the owner

See `../refs/sil-docs-notes.md` for verbatim quotes. The points that bear on this report:

- Send/Receive syncs everything in the fwdata file, explicitly including "custom field definitions", "styles" and all interlinear data; it does not sync per-machine settings (`ConfigurationSettings/*.xml` except `.fwlayout`), or files outside the project's default LinkedFiles folder. ("Using Send/Receive", software.sil.org; Technical Notes on FieldWorks Send/Receive §3.6.)
- Linked files under the default `LinkedFiles` folder are included subject to a 10 MB limit for the listed image/audio extensions; per the Chorus source, other extensions such as `.json` are not excluded but get a 1 MiB limit and an opaque (whole-file, merging-machine-wins) merge with a conflict note.
- Merge is 3-way per object by GUID; when two users modify the same field one side is picked and a conflict report is written; a modification beats a concurrent deletion. (Technical Notes §1, §3.2.)
- SIL documents repo-level editing of split files (lists) as an advanced but supported path; new list items need only class, guid and Name/Abbreviation. (Technical Notes §4.8.)
- The FieldWorks 7 XML model document states the `CustomField` `type` may be any of Binary, Boolean, GenDate, Guid, Integer, String, MultiString, Time, Unicode, MultiUnicode, OA, OC, OS, RA, RC, RS, "not all … currently supported in the UI"; the Conceptual Model (2026) lists the UI's classes (LexEntry, LexSense, LexExampleSentence, MoForm, Segment, RnGenericRec) and types (String, MultiUnicode, OA, GenDate, RC, RA, Integer) and the `<Custom name=…>` storage shapes. Consistent with Q3: the format and LCM are class-agnostic; only the dialog is restricted.
- The XML model document confirms the `.lock` file: another FieldWorks program from a separate process "will be blocked" while the project is open. The "Python for FlexTools and FLEx 9.1" notes give the write pattern (`OpenProject(name, True)`, or `BeginNonUndoableTask`/`EndNonUndoableTask` + `IUndoStackManager.Save()`) and the custom-field API (`IFwMetaDataCacheManaged`: `GetFieldIds`, `IsCustom`, `GetOwnClsName`, `GetFieldType`, `GetFieldName`, `GetFieldWs`, `GetFieldListRoot`; flid = clid*1000 + 500 + n).
- The Conceptual Model's discourse section describes `ConstChartRow.Notes` as "String for compiler notes" and shows tags rendered as the possibility name "in parentheses in a different color", matching Q4.

## Addendum: project sharing mode (verified in source, 2026-09)

The owner pointed out that FLEx now supports a shared-project mode for FlexTools. Confirmed, and it
changes the concurrency story in `desktop/PLAN.md` §7: **FDAT can read and write while FLEx has the
project open, provided the project has sharing enabled.**

| # | Claim | Evidence | Source |
|---|---|---|---|
| S.1 | LCM promotes a plain XML open to the shared backend when the project's sharing setting is on. | `case BackendProviderType.kXML: return LcmSettings.IsProjectSharingEnabled(projectId.ProjectFolder) ? BackendProviderType.kSharedXML : BackendProviderType.kXML;` with the comment "If an xml backend was requested, but the project settings say it should be shared, kSharedXML is used". | `liblcm/src/SIL.LCModel/LcmCache.cs:205-227` (`GetProviderTypeFromProjectId`) |
| S.2 | The setting is per project, read from the project lexicon settings file. | `IsProjectSharingEnabled(string projectFolder)` builds a `FileSettingsStore` on `LexiconSettingsFileHelper.GetProjectLexiconSettingsPath(projectFolder)` and returns `settings.ProjectSharing`. | `liblcm/src/SIL.LCModel/LcmSettings.cs:66-74` |
| S.3 | The user toggles it in FLEx: Project Properties → Sharing tab. | `m_enableProjectSharingCheckBox.Checked = m_projectLexiconSettings.ProjectSharing;` … `m_projectLexiconSettings.ProjectSharing = m_enableProjectSharingCheckBox.Checked;` | `FieldWorks/Src/FwCoreDlgs/FwProjPropertiesDlg.cs:139-146, 692, 734` |
| S.4 | flexlibs documents exactly this as the remedy for a locked project. | "A call to `OpenProject()` may fail with a `FP_FileLockedError` exception if the project is open in Fieldworks (or another application). To avoid this, project sharing can be enabled within the Fieldworks Project Properties dialog. In the Sharing tab, turn on the option 'Share project contents with programs on this computer'." | `flexlibs/flexlibs/code/FLExProject.py:197-224` |
| S.5 | flexlibs asks for a plain XML project id and relies on the promotion in S.1. | `projId = ProjectId(projectFileName)`; `ProjectId.GetType` defaults to `kXML`. | `flexlibs/flexlibs/code/FLExLCM.py:81-109`; `FieldWorks/Src/Common/FieldWorks/ProjectId.cs:397-418` |
| S.6 | Mechanism: a global mutex plus a memory-mapped commit log; peers register by process id, one is "Master", and each peer pulls other peers' changes on commit. | `m_commitLogMutex = new GlobalMutex(MutexName)`; `MemoryMappedFile m_commitLog`; `metadata.Peers[m_peerID] = new CommitLogPeer { ProcessID = curProcess.Id, … }`; `GetUnseenForeignChanges(metadata, out foreignNewbies, out foreignDirtballs, out foreignGoners)` in `Commit`. | `liblcm/src/SIL.LCModel/Infrastructure/Impl/SharedXMLBackendProvider.cs:26-120, 377-430, 490-520` |
| S.7 | Caveat: a non-master peer cannot run a data migration. | `// non-master peers cannot migrate the XML file` … `throw new LcmDataMigrationForbiddenException();` (flexlibs surfaces this as `FP_MigrationRequired`). | `SharedXMLBackendProvider.cs:108-111`; `flexlibs/flexlibs/code/FLExProject.py` (`FP_MigrationRequired`) |
| S.8 | The sharing setting itself travels with Send/Receive, so a colleague's copy keeps it. | FLExBridge include pattern `CachedSettings/SharedSettings/*.plsx`; SIL's "Using Send/Receive" lists "The LexiconSettings file in SharedSettings" among things included. | `flexbridge/src/LibFLExBridge-ChorusPlugin/Infrastructure/FlexFolderSystem.cs:70`; `../refs/sil-docs-notes.md` |

Consequences for FDAT:
- Default posture becomes: open read-only; for a save, open with `writeEnabled=True`. If the project
  is not shared and FLEx holds it, flexlibs raises `FP_FileLockedError` — surface a clear message
  offering the Sharing-tab remedy rather than failing obscurely.
- Offer a first-run check: read the project's sharing setting and tell the user to enable it if they
  want to keep FLEx open alongside FDAT. Do not toggle it silently on the user's behalf.
- Changes written by FDAT reach an open FLEx through the commit log, but FLEx's chart view will not
  necessarily refresh on its own; tell the user to switch tools/texts to refresh.
- Keep the migration guard in mind: if the project needs a data migration, the peer that is not
  master fails with a migration-forbidden error. FDAT should report "open this project in FLEx once
  to migrate it", which is also what flexlibs intends.

## Addendum 2: refreshing FDAT when FLEx changes the chart (verified in source, 2026-09)

Clarified requirement: FDAT writes only **additive, FDAT-namespaced** data (custom fields on chart
classes, an FDAT-owned list, or a sidecar file) that the FLEx UI never renders, so FLEx has nothing
to repaint. The direction that matters is the opposite one: **edits made in FLEx (re-charting, moving
or merging cells, editing the baseline, adding markers, changing the template) must show up in FDAT.**

What the shared backend gives a reader:

| # | Claim | Evidence | Source |
|---|---|---|---|
| R.1 | A peer only learns of other peers' changes inside `Commit` (and at shutdown, for the master). There is no notification, callback or polling loop in the backend. | `GetUnseenForeignChanges` has exactly two call sites: `ShutdownInternal` (master only) and `Commit`. | `liblcm/src/SIL.LCModel/Infrastructure/Impl/SharedXMLBackendProvider.cs:146, 390` |
| R.2 | `Commit` pulls and applies foreign changes **before** it checks whether this peer has anything to write, so a no-op commit is a full refresh. | In `Commit`: `if (GetUnseenForeignChanges(...)) { … reconciler.ReconcileForeignChanges(); }` runs first; only later comes `if (!HaveAnythingToCommit(newbies, dirtballs, goners, out cfiList) …) { SaveMetadata(metadata); return true; }`. | `SharedXMLBackendProvider.cs:377-436` |
| R.3 | `UnitOfWorkService.Save()` calls the backend `Commit` unconditionally; the emptiness test only gates the `OnSave` *event*, not the call. | `GatherChanges(...)`; `if (newbies.Count != 0 || …) RaiseSave(undoable);` then unconditionally `if (!m_dataStorer.Commit(realNewbies, dirtballs, goners)) throw …`. | `liblcm/src/SIL.LCModel/Infrastructure/Impl/UnitOfWorkService.cs:287-345` |
| R.4 | With no local unsaved changes, reconciliation cannot be refused: every rejection test is an intersection with this peer's own newbies/dirtballs/goners, which are empty. | `OkToReconcileChanges()` gathers local changes and returns false only on intersections (`goners.Intersect(m_foreignGoners)`, `commonDirtballs`, …). | `liblcm/src/SIL.LCModel/Infrastructure/Impl/ChangeReconciler.cs:54-80` |
| R.5 | **Constraint:** `Save()` is illegal while a unit of work is open — it rolls back and throws. flexlibs' `OpenProject(name, writeEnabled=True)` opens a non-undoable task and holds it until `CloseProject()`, so a write-mode session cannot poll. | `CheckReadyForCommit` : `if (m_uowService.CurrentProcessingState != …ReadyForBeginTask) { Rollback(0); throw new InvalidOperationException(message); }`, called at the top of `SaveInternal`. flexlibs: `self.project.MainCacheAccessor.BeginNonUndoableTask()` on write-enabled open. | `UndoStack.cs:239-246`; `UnitOfWorkService.cs:294-301`; `flexlibs/flexlibs/code/FLExProject.py:255-266` |
| R.6 | FDAT's own writes fit the same session without holding a task open: begin a non-undoable task, change, end it, then `Save()` — the pattern SIL documents for flexlibs. | "Before making changes you want to save, start a NonUndoable task … `BeginNonUndoableTask()` … `EndNonUndoableTask()` … `IUndoStackManager).Save()`". | `../refs/sil-docs-notes.md` (Python for FlexTools and FLEx 9.1) |

**Recommended sidecar pattern** (shared mode; supersedes "read-only snapshot + Refresh button"):

1. Open the project **read-only** — `FLExProject.OpenProject(name)` with no `writeEnabled` — so no unit of work is held open.
2. **Refresh loop:** every N seconds (or on a renderer request) call `cache.ServiceLocator.GetService(IUndoStackManager).Save()`. With no local changes this writes nothing, pulls every unseen foreign change and reconciles it into the live cache (R.2–R.4). Then re-export the chart XML, compare with the last export, and push to the renderer only when it differs.
3. **FDAT writes:** `MainCacheAccessor.BeginNonUndoableTask()` → set FDAT custom fields → `EndNonUndoableTask()` → `Save()` (R.6). The task is short-lived, so polling resumes immediately.

Caveats to design for:
- FDAT sees FLEx's edits only once **FLEx itself saves** (LCM saves on its own cadence and at certain actions), so the lag is bounded by FLEx's save interval, not by the poll interval. Make the poll cheap and do not promise instant updates.
- Without project sharing there is no refresh path at all: the cache is a startup snapshot. FDAT must then close and reopen the project to see changes, which is slow on a large project — another reason to detect the sharing setting and recommend enabling it.
- Re-exporting after a refresh can find rows deleted or recreated by FLEx (CA §2), so run the row re-anchoring reconciliation on every refresh, not just at load.
- If FDAT ever polls while holding local unsaved changes and the same objects were edited in FLEx, reconciliation can be refused; the backend then hands a pending reconciliation to the UI layer (`ILcmUI.ConflictingSave`). Keep write windows short so this window is effectively closed.

## Addendum 3: JSON as cache and backup (design, 2026-09)

Agreed split: **custom fields on the chart classes are the store of record; the JSON file is a cache
and a backup.** That removes the objection to the linked-file idea (whole-file, last-merger-wins
merge) because nothing authoritative lives there, and it covers a real failure mode that the model
store has on its own.

### Why a backup earns its place

Two documented ways FDAT data can vanish through ordinary FLEx use:

- "When a user deletes a custom field, all the data will also be deleted." (`../refs/sil-docs-notes.md`, FLEx 9.1 Conceptual Model §2.9.)
- Deleting a custom list deletes every custom field that references it, on any class (CA 3.6, `FieldWorks/Src/xWorks/DeleteCustomList.cs:110-118`) — which is how a salience band list-reference field would be defined.

Neither is recoverable from within the model. A backup written on every successful save is the
insurance, and it is also what makes the store-of-record choice safe to commit to.

### Cache: local, not synced

The cache is derived per-machine data; syncing it would add churn and pointless conflicts. Keep it
in FDAT's own application-data folder, never in `LinkedFiles`.

Cheap invalidation token, verified: LCM bumps `DateModified` on the **nearest owner that has one**
when any owned object is dirtied — `CollectDateModifiedObjectInternal` walks `Owner` upward
(`liblcm/src/SIL.LCModel/DomainImpl/CmObject.cs:3654-3675`), driven by "A generic side effect of all
changes is to update DateModified" in `UndoStack` (`Infrastructure/Impl/UndoStack.cs:295-311`).
`ConstChartRow` and the cell parts have no `DateModified`, and they are owned by `DsConstChart`,
which has one through `CmMajorObject` — so **any row or cell edit bumps `DsConstChart.DateModified`.**

So the refresh loop becomes cheap: poll with a no-op `Save()` (addendum 2), compare
`chart.DateModified` with the token recorded at the last export, and re-export only when it moved.

Two tokens are needed, because possibility lists are not owned by the chart:

| Token | Covers |
|---|---|
| `DsConstChart.DateModified` | rows, cells, word groups, tags, clause and moved-text markers, FDAT's own custom-field values on rows and on the chart |
| `DsDiscourseData.ChartMarkersOA.DateModified` (and the template list's) | marker added/renamed/reordered/recoloured, template columns changed — these are `CmPossibilityList`s, also `CmMajorObject`s |

Caveat: FDAT's own writes bump the chart token too, so record the token value observed immediately
after each FDAT save and ignore that one, or the app will re-export itself in a loop. Note also that
`UndoStack` deliberately skips the bump for newly created objects.

### Backup: synced, per-peer filename, manual restore

```
<project>/LinkedFiles/Others/fdat/<chartGuid>.<peerId>.json
```

- **Per-peer filename removes the merge problem entirely.** Two colleagues never write the same path, so Chorus never has to merge these files and the "unmergable file type, merging machine wins" behaviour never fires. Each peer's backup travels to everyone.
- Stay well under the **1 MiB** cap that applies to extensions no Chorus handler claims (addendum in the linked-files findings); per-chart FDAT data is kilobytes.
- Only syncs if the project keeps the **default Linked Files location** — the same precondition as pictures and audio.
- Stamp provenance in the file: schema version, project GUID, chart GUID, peer/user id, UTC timestamp, and the model's data version. A restore flow reads these and refuses a mismatch.
- **Restore is always user-initiated and shows a diff first.** Never restore automatically: a colleague's backup arriving through Send/Receive may be older than the custom-field data already in the project, and an automatic restore would silently overwrite good data with stale data.
- Write **re-anchoring keys alongside row GUIDs** — row label, the first word group's begin-segment GUID and analysis index, and the column possibility GUID — so a restore can re-attach values even when FLEx deleted and recreated rows in the meantime (CA §2). A backup keyed on row GUID alone is worthless after a re-chart.

### Write-through order

On save: write the custom fields through LCM first, `Save()`, and only then write the JSON backup
with the token observed after that save. If the LCM write fails, no backup is written, so the backup
can never claim state the project never had.

## Addendum 4: FDAT must read the possibility lists, not just the chart (design, 2026-09)

Rendering markers needs more than the chart export gives. FLEx's exporter emits a marker as **text
only** — the possibility's `Abbreviation` in the first analysis writing system, falling back to
`Name`, wrapped in parenthesis literals — with no GUID and no indication of which group it came
from (CA 4.1, `FieldWorks/Src/LexText/Discourse/ConstChartVc.cs:277-297`). That is why today's web
app keys marker settings on the label string it scrapes out of the rendered DOM (`data-listref`),
invents its own grouping UI, and asks the user to retype abbreviation glosses.

Reading the two lists through LCM removes all three problems.

### What the lists provide

| Source | Gives FDAT |
|---|---|
| `DsDiscourseData.ChartMarkersOA` (a `CmPossibilityList`) | Every marker's **GUID** (stable identity across renames), `Name` and `Abbreviation` per writing system, `Description` (a ready-made gloss for FDAT's abbreviations block), the real **hierarchy** — top level is the right-click submenu, lower levels are the markers themselves — and the `ForeColor`/`BackColor`/`Hidden` slots this design uses to store styling and visibility. List order is the display order. |
| `DsDiscourseData.ConstChartTemplOA` | Column identity by possibility GUID, and the column grouping at **any depth** — the draft's correction table notes FLEx builds one header row per template depth, not always two. |

Both lists are `CmMajorObject`s, so each carries its own `DateModified` — the second cache token in
addendum 3. Both sync as their own files (`Linguistics/Discourse/ChartMarkers.list`,
`ConstChartTempl.list`), so a colleague's marker edits arrive through Send/Receive (CA 4.8).

### Keying markers by GUID instead of by label

The sidecar controls the export, so it should emit the **Tag possibility GUID** on each `listRef`
element. The renderer XSL already passes a `guid` attribute through to `data-guid` on the token, so
no XSL change is needed. Prefer the possibility GUID over the cell-part GUID: cell parts are
recreated routinely by ordinary charting (CA §2), while the marker possibility is stable.

Consequences for the renderer's marker panel:

- Style, visibility and order key on the marker GUID, so a rename in FLEx no longer silently orphans
  FDAT's settings.
- FDAT's invented "groups" mechanism can be replaced by, or seeded from, FLEx's own list hierarchy.
- The abbreviations block can prefill `Name`/`Description` from the list instead of asking the user
  to retype them; "Reset from chart" (rescanning labels) is no longer needed.
- Markers defined in the list but absent from a given chart can still be listed and styled, which
  scraping the rendered chart cannot do.

### Bridge API additions

Add to the methods in §2 of the plan:

| Method | Sidecar RPC | Returns |
|---|---|---|
| `getChartMarkers()` | `listChartMarkers` | The Chart Markers list as a tree: `{ guid, name, abbreviation, description, foreColor, backColor, hidden, children[] }`. |
| `getTemplate(chartGuid)` | `getTemplate` | The chart's template as a tree of column groups and leaf columns with GUIDs and names. |

Both are per-project rather than per-chart, change independently of the chart, and have their own
`DateModified` tokens, so cache them separately from the chart export and refresh them on the same
poll.

## Addendum 5: storing marker styling, grouping and visibility on the markers themselves (2026-09)

Question: can FDAT's marker formatting, grouping and filtering live in the data model, attached to
the chart markers? Mostly yes, using fields that already exist on `CmPossibility`.

### Styling — use the dormant overlay colour fields

`CmPossibility` carries four colour/underline slots and a visibility flag, all documented as serving
"overlay functionality" — a FieldWorks-6 era feature that no longer exists in FLEx 9
(`liblcm/src/SIL.LCModel/MasterLCModel.xml:354-378`):

| Field | Type | Model comment |
|---|---|---|
| `ForeColor` | Integer | "ForeColor for overlay functionality." |
| `BackColor` | Integer | "BackColor for overlay functionality." |
| `UnderColor` | Integer | "UnderColor for overlay functionality - the color of the 'underline' style when used in Overlays." |
| `UnderStyle` | Integer (0-127) | "UnderStyle - style of the underline used in overlays functionality." |
| `Hidden` | Boolean | "Indicates whether overlay bracketing should be hidden or not. True = Hidden." |

A grep across `FieldWorks/Src/LexText` and `FieldWorks/Src/xWorks` finds **no FLEx code reading or
writing these on possibilities** — consistent with the chart drawing every marker in a fixed orange
"marker" style from `ConstituentChartStyleInfo.xml` (CA 4.1). So they are native, typed, per-marker,
synced with `ChartMarkers.list`, keyed by the marker's GUID, and inert in current FLEx: a good home
for FDAT's marker colours.

Two honest caveats:

- **Dormant is not reserved.** Nothing guarantees SIL will not revive overlays or repurpose these
  fields. The risk is low, and the downside is cosmetic (a future FLEx feature might colour things
  unexpectedly), but it is not zero. Record FDAT's values in the JSON backup too, so they survive
  whatever happens.
- **These are project-wide.** A marker has one `ForeColor`, so per-chart colour variation cannot
  live here. If FDAT ever wants a marker styled differently in two charts, that belongs in the
  chart's own FDAT settings field keyed by marker GUID.

Bold/italic/size have no native per-possibility slot; keep those in FDAT's settings JSON keyed by
marker GUID.

### Grouping — use the parent items, read-only

The Chart Markers list is already hierarchical, and its top level *is* the grouping: "The top level
defines a right-click subitem … Lower levels provide actual markers" (`../refs/sil-docs-notes.md`,
Conceptual Model §6.7). FDAT should read that hierarchy and use the parent items as its groups. That
is free, native, synced, and editable by the linguist in FLEx's Lists area — one place instead of
FDAT's invented parallel grouping.

One boundary: FDAT should **read** the hierarchy, not restructure it. Adding or moving parent items
would change FLEx's right-click menu, which breaks the rule that FDAT only writes data FLEx does not
reflect. If a user wants a grouping that differs from the list's, that is an FDAT setting keyed by
marker GUID, not a change to the list.

### Visibility — `Hidden` works, with one judgement call

`Hidden` is the natural slot for "do not render this marker" and needs no new field. Two things to
weigh before using it:

- Its documented meaning is overlay bracketing, not general visibility, so this is a mild
  repurposing of a field rather than a pure use of it — the one place in this design that bends the
  "do not repurpose fields" safety rule. It is defensible because the field is dead in FLEx 9 and the
  meaning is close.
- It is **project-wide**, exactly like the colours. FDAT's current UI hides markers per view. If
  hide/show should vary per chart, `Hidden` cannot express it and the setting belongs in the chart's
  FDAT field.

Recommendation: use `Hidden` only if "this marker is not interesting in this project" is the real
intent; otherwise keep visibility in FDAT settings and leave `Hidden` alone.

### Filtering — derive it, do not store it

Filtering is a view operation over data FDAT already has: group membership (the parent item),
visibility, and marker identity. Store filter *presets* in the chart or project FDAT settings keyed
by marker GUID; do not add model fields for them.

### Why not custom fields on `CmPossibility`

Technically possible — LCM has no class whitelist — but **it would clutter every list in the
project**. FLEx's Lists editor builds slices for every custom field whose class is anywhere in the
edited object's class chain: `EnsureCustomFields` walks `GetBaseClsId` upward and matches
`interestingClasses.Contains(field.Class)`
(`FieldWorks/Src/Common/Controls/DetailControls/DataTree.cs:2487-2499`). A custom field declared on
`CmPossibility` therefore appears on semantic domains, parts of speech, genres — every possibility
in every list. Do not do it. The chart classes (`ConstChartRow`, `DsConstChart`) have no DataTree in
FLEx, which is exactly why custom fields are safe there and not here.

## Addendum 6: file formats and size limits in LinkedFiles (verified, 2026-09)

Three questions: can a `.txt` file holding JSON beat the size cap, could XML be used instead, and
what is actually allowed in `LinkedFiles`?

### Size caps by extension

Chorus builds an extension → max-size map from the installed handlers and falls back to a default
for anything unclaimed (`LargeFileFilter.cs`, `CacheMaxSizesOfExtension` / `GetMaxSizeForExtension`;
`maxForExtension = Megabyte;` where `Megabyte => 1048576`):

| Extension | Cap | Why |
|---|---|---|
| `.txt` | **effectively unlimited** | Chorus's `TextFileTypeHandler` claims `txt` from `GetExtensionsOfKnownTextFileTypes()` and returns `MaximumFileSize = UInt32.MaxValue`. |
| `.json` (and any unclaimed extension) | **1 MiB** | No handler claims it, so the default applies. Not 10 MiB — that figure is the image and audio handlers. |
| images / audio | 10 MiB | Their handlers' `MaximumFileSize`. |

So yes: **naming the backup `.txt` with JSON inside raises the ceiling from 1 MiB to unlimited.**

One difference that comes with it: `.txt` is *claimed*, so Chorus will try to **merge** it with
`diff3` rather than treat it as opaque, and on an overlapping conflict `Do3WayMerge` throws
(`"Could not merge text files without conflict"`). Under the per-peer filename design of addendum 3
no file is ever written by two peers, so no merge is ever attempted and this never fires. It would
matter only if peers shared a single file — in which case `.txt` fails loudly where `.json` fails
silently.

Do not read "unlimited" as license. Chorus's own header comment is blunt: *"if even one large file
is committed to the repo, that repo is completely dead for all users of that project"*, and
Mercurial history is permanent, so an oversized backup bloats every colleague's clone forever. Keep
per-chart backups in the kilobytes, cap FDAT's own writes (refuse well below 1 MiB, warn earlier),
and split per chart rather than growing one file.

### XML is excluded — do not use it

`**.xml` is in FLExBridge's exclude list, and *"Exclude has precedence"* over the include patterns
(`flexbridge/src/LibFLExBridge-ChorusPlugin/Infrastructure/FlexFolderSystem.cs:18-45`). An `.xml`
file under `LinkedFiles/Others` would **never sync**. Same for `.zip`, `.flextext`, `.bak`, `.tmp`,
`.log` and the video extensions.

### What is allowed in LinkedFiles

The include patterns are `LinkedFiles/AudioVisual/**.*`, `LinkedFiles/Others/**.*` and
`LinkedFiles/Pictures/**.*` — i.e. **every file, any extension**, minus the global excludes:

> `.fwdata` (and `-replaced`, `-x`, `.lock`), `.fwdb`, `.bad`, `.bak`, `.flextext`, `.fwbackup`,
> `.fwstub`, `.lint`, `.log`, `.orig`, `.oxekt`, `.oxes`, `.oxesa`, `.tmp`, `.xml`, `.zip`,
> `.dupid`, `.NewChorusNotes`, and the video extensions (mpa, mpe, mpg, mpeg, mpv2, mp2, mp4, mov,
> wmv, rm, avi, wvx, m1v).

`.json` and `.txt` are both fine. Subfolders are fine (`**.*` is recursive), so
`LinkedFiles/Others/fdat/…` works.

### No database reference is needed

The include patterns are **path-based**: Chorus hands Mercurial a working-directory pattern and
nothing consults the LCM model. A file sitting in `LinkedFiles/Others/fdat/` is committed and pushed
whether or not any `CmFile`, `CmMediaURI` or `CmPicture` points at it. A model reference is only
needed if **FLEx** should display or resolve the file — which is precisely what FDAT does not want,
since an unreferenced file is invisible in FLEx and cannot confuse a linguist.

Two conditions still apply: the project must keep the **default Linked Files location** (a relocated
folder syncs nothing), and the file must be under the size cap for its extension.

No FLEx feature that prunes unreferenced files from `LinkedFiles` was found in the sparse checkout —
but that is an absence of evidence, not a guarantee. **Phase 0 should confirm** that a file left in
`LinkedFiles/Others/fdat/` survives a Send/Receive round trip and a FLEx backup/restore cycle, since
a sweeper would silently delete backups.

### Recommendation

- Backups: `LinkedFiles/Others/fdat/<chartGuid>.<peerId>.json`, pretty-printed one key per line
  (readable in hg history, and diff-friendly if ever merged), unreferenced by the model.
- Switch an individual file to `.txt` only if it could realistically approach 1 MiB — and prefer
  splitting it instead.
- View/UI state (column widths, notes side, current filter) stays in FDAT's local app-data, never in
  the project: FLEx keeps its own equivalents per machine, and Send/Receive deliberately excludes
  them.

## Addendum 7: locating the LinkedFiles folder (verified, 2026-09)

Yes — and FDAT must **ask LCM rather than construct the path**, because the folder is relocatable and
the stored value is a *relative* path with its own resolution rules.

`ILangProject.LinkedFilesRootDir` is a resolved, absolute path
(`liblcm/src/SIL.LCModel/DomainImpl/OverridesLangProj.cs:92-115`):

> "Return LinkedFilesRootDir if explicitly set, otherwise DataDirectory."

```csharp
return String.IsNullOrEmpty(LinkedFilesRootDir_Generated)
    ? Path.Combine(m_cache.ProjectId.ProjectFolder, LcmFileHelper.ksLinkedFilesDir)
    : LinkedFilesRelativePathHelper.GetLinkedFilesFullPathFromRelativePath(
        Services.GetInstance<ILcmDirectories>().ProjectsDirectory,
        LinkedFilesRootDir_Generated, m_cache.ProjectId.ProjectFolder);
```

So the getter already handles both the default (`<ProjectFolder>/LinkedFiles`) and a user-relocated
folder stored as a relative token. Never reimplement that.

Helpers and constants (`liblcm/src/SIL.LCModel/LcmFileHelper.cs:39-197`):

| API | Returns |
|---|---|
| `LcmFileHelper.ksLinkedFilesDir` | `"LinkedFiles"` |
| `LcmFileHelper.ksOtherLinkedFilesDir` | `"Others"` |
| `LcmFileHelper.GetDefaultLinkedFilesDir(projectPath)` | `<projectPath>/LinkedFiles` — the *default*, for comparison |
| `LcmFileHelper.GetOtherExternalFilesDir(linkedFilesPath)` | `<linkedFilesPath>/Others` |
| `LcmFileHelper.GetMediaDir` / `GetPicturesDir` | the sibling subfolders |

flexlibs already imports `LcmFileHelper` (`flexlibs/flexlibs/code/FLExLCM.py:34`), so all of this is
available from the sidecar with no extra plumbing.

### The check that matters

Because a relocated LinkedFiles folder syncs **nothing** (addendum 6), FDAT should compare the
resolved root against the default and warn rather than silently write backups that never travel:

```python
lp   = project.project.LangProject
root = lp.LinkedFilesRootDir                                   # resolved, absolute
dflt = LcmFileHelper.GetDefaultLinkedFilesDir(cache.ProjectId.ProjectFolder)
synced = os.path.normcase(os.path.abspath(root)) == os.path.normcase(os.path.abspath(dflt))
backup_dir = os.path.join(LcmFileHelper.GetOtherExternalFilesDir(root), "fdat")
```

If `synced` is false, tell the user their Linked Files folder is outside the project so FDAT backups
will not reach colleagues, and offer to keep backups locally instead. Do not move the folder —
FLEx's help says plainly "Do not change the Linked Files folder location" (`../refs/sil-docs-notes.md`),
and relocating it has side effects on every picture path (`LinkedFilesRootDirSideEffects`).

## Addendum 8: the `fdat` folder under `Others` (settled)

Location: `<LinkedFiles>/Others/fdat/`, resolved via LCM (addendum 7), holding
`<chartGuid>.<peerId>.json` per addendum 3. The include pattern `LinkedFiles/Others/**.*` is
recursive, so a subfolder needs no registration anywhere.

Two practical points for the implementation:

- **Mercurial does not track empty directories.** The folder does not appear on a colleague's
  machine until a file inside it has been committed, so every FDAT install must create it on demand
  rather than assume Send/Receive delivered it.
- **A `README.txt` in the folder is worth writing, but only once.** It tells a linguist browsing
  `Others` what these files are, that FLEx does not use them, and that deleting them costs only the
  backups. Write it only when absent and never rewrite it: Chorus claims `.txt` and merges it with
  diff3, which throws on an overlapping conflict, whereas a file created once and never modified can
  never produce one.

Use a consistent lowercase `fdat` — Windows is case-insensitive but FieldWorks also runs on Linux,
and Mercurial would treat `FDAT/` and `fdat/` as different paths there.

Implemented in the sidecar as `ensureBackupDir` alongside `linkedFiles`.

## Addendum 9: where merging actually works (verified, 2026-09)

Requirement: edits from different machines or users on the same project should merge, not clobber.
That requirement is already met — but by the **model store, not by the files**.

### The model merges properly; that is the whole argument for it

FLExBridge splits the chart into `Linguistics/Discourse/Charting.discourse` and merges it
**per object, keyed by GUID, per field**: every concrete class gets
`MergePartnerFinder = GuidKeyFinder` with `IsAtomic = false`, and custom properties merge under the
key `Custom_<Class>_<name>` (CA 3.7, 5.4 — spot-checked). So:

- Two users annotating **different rows** of the same chart merge cleanly and automatically.
- Two users editing **different FDAT fields on the same row** also merge cleanly, because merge is
  per field, not per object.
- Only the same field on the same row collides, and then Chorus picks one side and writes a conflict
  note — which is exactly how FLEx behaves for its own data ("if two changes are made to the same
  object, one is picked", `../refs/sil-docs-notes.md`).

That is the merge/diff behaviour we want, and no file format in `LinkedFiles` can match it.

### Files cannot do better — and `.txt` fails harder than `.json`

| Format | Merge behaviour on a file two peers changed |
|---|---|
| `.json` (unclaimed) | No merge. `DefaultFileTypeHandler` records an `UnmergableFileTypeConflict` and keeps the merging machine's copy. **Soft failure:** the sync completes; one side's file content is lost. |
| `.txt` (claimed) | `TextFileTypeHandler` runs `diff3 -m`. Disjoint line edits merge cleanly; an overlapping conflict **throws**, `ChorusMerge` catches it and `return 1` (`ChorusMerge/Program.cs`), Mercurial treats a non-zero merge-tool exit as a failed merge and leaves the file unresolved. **Hard failure:** it takes the whole Send/Receive into a recovery path (`HgRepository.RecoverFromFailedMerge` runs `hg resolve --all`). |

Note also that Chorus explicitly disables Mercurial's own line-level premerge —
`mergeToolsSection.Set("chorusmerge.premerge", "False")` — because *"If the premerge is allowed to
happen Mercurial will occasionally think it did a good job and not call our mergetool. This has data
corrupting results for us."* So there is no free line-merge underneath; whatever the handler does is
all that happens.

This **reverses** the earlier framing in addendum 6. For a file two peers might both write, `.json`'s
soft failure is safer than `.txt`'s hard one: a conflicting FDAT backup must never be able to break a
colleague's Send/Receive.

### Conclusion

1. **Keep per-peer filenames for the backups.** One writer per file means no merge is ever attempted,
   so neither failure mode can occur. This stays the design.
2. **Mergeable data belongs in custom fields**, where merging is per row and per field and needs no
   file format at all.
3. **If some future data genuinely must be a shared file and must merge**, structure it so merges are
   line-disjoint — JSON Lines: one compact JSON object per line, one line per row, sorted by row
   GUID, with a stable key order — so two users editing different rows touch different lines and
   diff3 succeeds. Accept that same-row edits will hard-fail, and weigh that against simply putting
   the data in the model instead.

## Addendum 10: settled division of storage

Three tiers, each chosen for how it merges:

| Tier | Holds | Why there |
|---|---|---|
| **FLEx model** — custom fields on `ConstChartRow` and `DsConstChart`, marker colours/`Hidden` on the marker possibilities, grouping read from the list hierarchy | Everything that is *analysis*: row→band assignments, custom-column values, per-chart settings, marker styling | Merges per object and per field by GUID, so two people annotating different rows (or different fields of one row) merge automatically. This is the only tier with real merging. |
| **Per-peer JSON in `LinkedFiles/Others/fdat/`** | Things with no home in the model — **view settings above all** — plus a backup of the model-stored data | Syncs to the team, readable by any FDAT install on the project, and per-peer filenames mean no file is ever written by two peers, so the no-merge limitation never bites |
| **FDAT local app-data** | The working copy of view settings; anything transient | Always available, even when the project's LinkedFiles folder has been relocated and syncs nothing |

### Why per-peer filenames fit view settings particularly well

View settings are inherently per-person: one linguist's column widths and collapsed panels are not
another's. A per-peer file gives each user their own without any merge, while still letting every
other FDAT install *read* them — so "adopt the settings Bob is using" or "use this project's house
layout" becomes possible, as an explicit action rather than an automatic overwrite.

Suggested layout inside the folder:

```
LinkedFiles/Others/fdat/
  README.txt                            written once, never rewritten
  <peerId>.settings.json                view/UI settings for this contributor, keyed by chart GUID where per-chart
  <chartGuid>.<peerId>.backup.json      backup of the model-stored FDAT data for one chart
```

Settings and backups are kept in separate files because their lifecycles differ: a backup is written
when the model is saved, while settings change on ordinary UI interaction.

### Practical rules

- **Throttle settings writes.** Every write lands in Mercurial history permanently, and history is
  shared by the whole team. Debounce (write on close or after an idle interval, not on every column
  drag), persist only settings worth keeping, and never write an unchanged file.
- **Local is the working store; the project file is a published copy.** Write settings to local
  app-data first and mirror them into the project file. That keeps FDAT working when LinkedFiles has
  been relocated and syncs nothing (addendum 7), and avoids a half-written project file becoming the
  only copy.
- **Never auto-apply another peer's file** — settings or backup. Both are readable and both are
  offered explicitly; neither overrides what is already here.
- **Keep files small.** `.json` is capped at 1 MiB and, more importantly, anything committed bloats
  every colleague's clone forever.
- The model stays the store of record. If a piece of data could live in a custom field, it should —
  that is the only tier where two people's edits genuinely combine.
