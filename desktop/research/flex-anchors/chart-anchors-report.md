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
