export const meta = {
  name: 'flex-anchor-research',
  description: 'Research where FDAT data can be anchored/linked in the FLEx (LCM) data model: sweep, ~20 verifications, critique, gap sweep, synthesis',
  phases: [
    { title: 'Sweep', detail: 'eight investigators over liblcm, FieldWorks, flexbridge, flexlibs/FLExTools and GitHub docs' },
    { title: 'Verify', detail: '20 skeptics: critical claims first, spread across investigations (+ up to 4 the critic asks for)' },
    { title: 'Critique', detail: 'completeness critic: extra verifications and at most 4 gaps' },
    { title: 'Gap sweep', detail: 'one investigator per gap' },
    { title: 'Synthesize', detail: 'cited anchor-points report' },
  ],
}

const SRC = '/tmp/claude-0/-home-user-fdat/fb1d7f18-f46f-5695-b961-37c4221bc0d5/scratchpad/src'
const CONTEXT = `
CONTEXT FOR THIS INVESTIGATION
FDAT (Flex DiscourseChart Analysis Tool, repo /home/user/fdat) renders FieldWorks (FLEx) discourse/text charts and lets a linguist add
analysis data on top: salience-band colour coding per chart row, custom text columns per row, styling/order/visibility of chart
markers (listRef tags), abbreviation glosses, notes display, prologue/epilogue text, and display preferences. Today all of that lives
in browser localStorage keyed by row labels. The plan (read /home/user/fdat/desktop/PLAN.md, sections 4-7) is a Windows desktop app
that reads charts straight from the FLEx project through flexlibs/LCM and STORES ALL FDAT DATA INSIDE THE FLEX PROJECT so that
Send/Receive (FLExBridge/Chorus) syncs it to colleagues, keyed by FLEx object GUIDs (ConstChartRow, cell parts, analyses, tags).
The owner's own idea to evaluate: store an "FDAT JSON" as a linked file of the text (if a Text can have more than one media/linked
file) inside the project's LinkedFiles folder, which Send/Receive syncs. We must NOT break the FLEx data model: only FLEx's own
extension points (custom fields, possibility lists, tags, linked files, styles, notes), all writes through LCM.

LOCAL SOURCES (already cloned; read with Grep/Read/Bash, do not modify them):
- ${SRC}/liblcm            the LCM library. Model definition: src/SIL.LCModel/MasterLCModel.xml (every class and property; a
                            <class id="X"> element with <props>). Also src/SIL.LCModel/Infrastructure (metadata cache, custom
                            fields: IFwMetaDataCacheManaged.cs, Impl/LcmMetaDataCache.cs, Impl/SharedXMLBackendProvider.cs),
                            src/SIL.LCModel/FieldDescription.cs, DomainServices, Utils (LcmFileHelper etc.).
- ${SRC}/flexbridge        FLExBridge (Send/Receive). Sync folder config: src/LibFLExBridge-ChorusPlugin/Infrastructure/FlexFolderSystem.cs;
                            file-type handlers under src/LibFLExBridge-ChorusPlugin; docs: ReadMe.md, FileTypeHandlers.md.
- ${SRC}/FieldWorks        FLEx app, SPARSE checkout of: Src/LexText/Discourse, Src/LexText/Interlinear, Src/Common/FieldWorks,
                            Src/Common/FwUtils, Src/Common/Controls/DetailControls, Src/xWorks, Src/LexText/LexTextControls,
                            Src/Common/RootSite, "DistFiles/Language Explorer/Configuration", Docs/. If you need another folder,
                            run: git -C ${SRC}/FieldWorks sparse-checkout add <path>   (blobless clone; it fetches on demand).
                            To list paths not checked out: git -C ${SRC}/FieldWorks ls-tree -r --name-only HEAD | grep <term>
- ${SRC}/flexlibs          Python library over LCM (flexlibs/code/FLExProject.py, docs/sphinx).
- ${SRC}/flextools         FLExTools app (docs/, flextoolslib/).

WEB: only github.com and raw.githubusercontent.com are reachable (WebFetch/WebSearch; load them with ToolSearch "select:WebFetch,WebSearch").
software.sil.org, downloads.languagetechnology.org, lingtransoft.info and web.archive.org are BLOCKED here - do not waste calls on them;
say so if a needed document only exists there. Useful GitHub docs: https://github.com/cdfarrow/FLExTools/wiki (and its pages),
https://github.com/sillsdev/chorus (LargeFileFilter, binary merge), https://github.com/sillsdev/FwDocumentation/wiki,
raw READMEs/AGENTS.md/CLAUDE.md/CONTEXT.md in the cloned repos.

RULES: every finding must cite a source as "path:line-line" (repo-relative under ${SRC}) or a URL, and quote or precisely
paraphrase the evidence. Distinguish what the model/code SAYS from what you INFER. Mark critical=true only for findings the FDAT
storage design would depend on. Do not edit any file. Return structured output only.
`

const FINDINGS = {
  type: 'object',
  required: ['summary', 'findings', 'openQuestions'],
  properties: {
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['claim', 'evidence', 'source', 'confidence', 'critical'],
        properties: {
          claim: { type: 'string', description: 'one precise, checkable statement' },
          evidence: { type: 'string', description: 'verbatim quote or exact description of what the source shows' },
          source: { type: 'string', description: 'file path with line range, or URL' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          critical: { type: 'boolean' },
          implication: { type: 'string', description: 'what it means for storing FDAT data' },
        },
      },
    },
    openQuestions: { type: 'array', items: { type: 'string' } },
  },
}

const VERDICT = {
  type: 'object',
  required: ['verdict', 'reason', 'sourcesChecked'],
  properties: {
    verdict: { type: 'string', enum: ['confirmed', 'refuted', 'unverifiable'] },
    reason: { type: 'string' },
    correction: { type: 'string', description: 'the corrected claim, if refuted or imprecise' },
    sourcesChecked: { type: 'array', items: { type: 'string' } },
  },
}

const GAPS = {
  type: 'object',
  required: ['gaps'],
  properties: {
    gaps: {
      type: 'array',
      items: {
        type: 'object',
        required: ['question', 'why', 'whereToLook'],
        properties: { question: { type: 'string' }, why: { type: 'string' }, whereToLook: { type: 'string' } },
      },
    },
  },
}

const INVESTIGATIONS = [
  { key: 'model-anchors', prompt: `Read ${SRC}/liblcm/src/SIL.LCModel/MasterLCModel.xml thoroughly for these classes and report EVERY property (name, cardinality/type such as MultiString, String, Integer, Boolean, RA/RC/RS/OA/OC/OS with target class) with line numbers: Text (line ~3880), StText (~478), StTxtPara (~505), Segment (~259), Note (~227), TextTag (~655), CmPossibility (~306), CmPossibilityList (~386), CmCustomItem (~713), CmMediaContainer (~1647), CmMediaURI (~1632), CmFile (~1244), CmFolder (~219), CmMedia (~1576), CmPicture (~1257), RnGenericRec (~2323), DsDiscourseData (~4914), DsChart and DsConstChart (~4897), ConstChartRow (~2679), ConstituentChartCellPart and its subclasses ConstChartWordGroup (~2824), ConstChartTag (~2859), ConstChartClauseMarker, ConstChartMovedTextMarker, LangProject (~5233: especially MediaOC, PicturesOC, TextMarkupTagsOA, DiscourseDataOA, StylesOC, LinkedFilesRootDir, and anything holding custom/user lists), StStyle (~551). Also find how the model marks which classes may carry custom fields (any attribute on <class> or a list elsewhere in liblcm such as CustomFields / 'IsCustomFieldsAllowed'). Then answer, each as a finding: (1) can a Text hold more than one media/linked file, and via which property chain; what exactly does CmMediaURI store; (2) which properties on a Text/StText/Segment/ConstChartRow/CmPossibility/RnGenericRec are free text or rich text (String/MultiString/StText) that FDAT could write; (3) which properties are references to possibilities that FDAT-created list items could satisfy; (4) whether ConstChartRow, Segment, StTxtPara, CmPossibility carry any 'open' fields (Notes, Comment, Description, Discussion, ExternalMaterials, Restrictions, Custom...) and their types. Cite MasterLCModel.xml lines for everything.` },
  { key: 'custom-fields', prompt: `Determine precisely which classes can carry user-defined custom fields in FLEx/LCM and how they sync. Sources: ${SRC}/FieldWorks/Src/xWorks/AddCustomFieldDlg.cs (the 'Location' choices offered to users and the class ids behind them), ${SRC}/liblcm/src/SIL.LCModel/FieldDescription.cs, Infrastructure/IFwMetaDataCacheManaged.cs and Infrastructure/Impl/LcmMetaDataCache.cs (AddCustomField, allowed types CellarPropertyType, any restriction on classes), ${SRC}/flexbridge (how FLExProject.CustomProperties and custom field values are serialised/merged: grep CustomProperties, 'Custom' in src/LibFLExBridge-ChorusPlugin), ${SRC}/flexlibs/flexlibs/code/FLExProject.py (GetFieldID, GetCustomFieldValue, any setter such as LexiconSetFieldText / LexiconAddTagToField and whether they work for non-lexicon classes), and the FLExTools wiki on GitHub (https://github.com/cdfarrow/FLExTools/wiki - find pages about custom fields). Report: the exact list of classes selectable in the dialog (Entry, Sense, Example, Allomorph, Notebook Record, Text? Wordform? Segment? ConstChartRow? CmPossibility?), which value types exist (single-line string, multiparagraph text (StText), list reference single/multi, date, number, ...), whether custom fields can be added programmatically to classes the dialog does not offer (and what would break: UI, FLExBridge, data migration), and how definitions and values are synced by FLExBridge.` },
  { key: 'linked-files', prompt: `Establish everything about linked files as a place to keep an FDAT JSON file that Send/Receive syncs. Sources: ${SRC}/flexbridge/src/LibFLExBridge-ChorusPlugin/Infrastructure/FlexFolderSystem.cs (include/exclude patterns: note LinkedFiles/AudioVisual, Others, Pictures are included and **.xml, **.zip are excluded - is .json excluded anywhere? what does ProjectFolderConfiguration.AddExcludedVideoExtensions add? find its definition: it is in Chorus - fetch https://raw.githubusercontent.com/sillsdev/chorus/master/src/LibChorus/sync/ProjectFolderConfiguration.cs and the LargeFileFilter (https://raw.githubusercontent.com/sillsdev/chorus/master/src/LibChorus/sync/LargeFileFilter.cs or search the chorus repo tree via https://github.com/sillsdev/chorus) for the size limit and how oversized/binary files are treated, and how non-XML files are merged on conflict), ${SRC}/flexbridge/FileTypeHandlers.md and ReadMe.md, ${SRC}/liblcm (LcmFileHelper / DirectoryFinder: the LinkedFiles subfolder names and how CmFile.InternalPath and CmMediaURI.MediaURI resolve relative to LangProject.LinkedFilesRootDir; grep 'Others', 'AudioVisual', 'LinkedFiles'), and ${SRC}/FieldWorks (how the UI treats Text.MediaFilesOA / CmMediaURI: Src/Common/Controls/DetailControls/MediaInfoSlice.cs, Src/LexText/Interlinear/InterlinearExporter.cs and BIRDInterlinearImporter.cs, plus grep MediaFilesOA/MediaURIsOC/MediaURIRA across the checkout; what happens if a URI points to a .json rather than audio - any player/validation? Also how 'Insert link to file' style external links work: grep kodtExternalPathName, ExternalLink, 'LinkedFiles' in Src/Common and Src/xWorks; and MoveOrCopyFilesDlg / whether FLEx copies files into LinkedFiles/Others). Report, as findings: exact include/exclude patterns; size limit; merge behaviour for a .json; where a file must live to sync; every model property that can reference a file in LinkedFiles (CmFile.InternalPath, CmMediaURI.MediaURI, external-link runs in TsStrings, CmPicture) and what FLEx does with each; whether a Text can carry several CmMediaURIs and what FLEx shows for them.` },
  { key: 'discourse-code', prompt: `Read ${SRC}/FieldWorks/Src/LexText/Discourse in depth. (A) DiscourseExporter.cs: produce the exact XML format FLEx's 'Export Text Chart' writes - every element and attribute in order (document, chart, languages/language attrs, row attrs incl. the id attribute = row label and type/endPara/endSent, title rows, cell attrs cols/reversed, main, word/lang, gloss/lang, lit with noSpaceBefore/After, listRef, clauseMkr, rownum, note, moved text markers, dependent-clause markers, how ConstChartTag text is chosen (abbreviation vs name), how empty cells and merged (MergesAfter/MergesBefore) cells are emitted). Cite line ranges. Compare with the sample at /home/user/fdat/test/fixtures/sample-chart.xml and the mapping table in /home/user/fdat/desktop/PLAN.md section 4 and list every discrepancy. (B) ConstituentChartLogic.cs / ConstChartBody.cs / ConstChartVc.cs / ConstChartRowDecorator.cs: how rows relate to segments and analyses; whether editing operations (move cell, merge, insert row, 'clear chart', re-chart) keep ConstChartRow and cell-part GUIDs or delete and recreate them (GUID stability matters for FDAT keys); how the Notes column is stored/edited (ConstChartRow.Notes type and editing code); whether ConstChartTag.TagRA is validated against DsDiscourseData.ChartMarkersOA (what the UI does with a tag outside that list); ClauseType enum values; how the template (ConstChartTemplOA possibilities) defines column groups; where colours/styles come from (ConstituentChartStyleInfo.xml under DistFiles/Language Explorer/Configuration and any code reading it) and whether any per-row/per-cell style or user data hook exists.` },
  { key: 'tags-and-lists', prompt: `Investigate text tags and possibility lists as FDAT anchors. Sources: ${SRC}/FieldWorks/Src/LexText/Interlinear (tagging: grep TextTag, TagsOC, TextMarkupTags, 'InterlinTaggingChild', 'TaggingView'; how a tag is created - span rules (BeginSegment/EndSegment/BeginAnalysisIndex/EndAnalysisIndex), whether overlapping tags or tags spanning several segments are allowed, how tags are displayed (abbreviation? colour?), how the user adds tag lists/tags and where they are stored (LangProject.TextMarkupTagsOA structure: list -> tag-set possibilities -> tag possibilities?)), ${SRC}/liblcm (TextTag class in MasterLCModel.xml and any TextTag services/validation; CmPossibility colour fields ForeColor/BackColor/UnderColor/UnderStyle - grep their use across liblcm and FieldWorks: does ANY FLEx UI render them? also Hidden, IsProtected, Discussion (StText), Description), custom lists (${SRC}/FieldWorks/Src/xWorks: AddCustomListDlg / DeleteCustomListTests: how a user-created list is stored (LangProject.ListsOC?) and which item class (CmCustomItem?), what fields custom list items expose, and whether FLExBridge syncs custom lists - flexbridge **.list include), flexlibs list helpers (UnpackNestedPossibilityList). Report findings usable for: a 'Salience' tag set + TextTag per chart row; a custom list per enumerated custom column; storing colours on possibilities; whether FLEx would display FDAT-created tags/lists sensibly or complain.` },
  { key: 'notes-rich-text-styles', prompt: `Investigate rich text, notes and styles as anchors. Sources: ${SRC}/liblcm MasterLCModel.xml (ConstChartRow.Notes type; Segment.NotesOS -> Note.Content; Text.Description/Source/Comment/Abbreviation; StText/StTxtPara; StStyle properties; CmPossibility.Discussion), liblcm TsString utilities (grep TsStringUtils, MakeHyperlink, ktptObjData, kodtExternalPathName, kodtOwnNameGuidHot, kodtNameGuidHot in src/SIL.LCModel and its Core folders - what kinds of embedded object data/links a TsString run can carry, including links to CmObjects by GUID and external file paths), ${SRC}/FieldWorks (how chart Notes are shown/edited: Src/LexText/Discourse; how external links are inserted and resolved: grep 'kodtExternalPathName', 'ExternalLink', 'LinkedFilesRootDir' in Src/Common, Src/xWorks, Src/LexText/LexTextControls; whether 'Insert link to file' copies the file into LinkedFiles/Others), styles: how character styles are defined (LangProject.StylesOC, StStyle.Rules) and whether flexbridge syncs them (**.style include in FlexFolderSystem.cs). Answer: (1) could FDAT store a link to LinkedFiles/Others/fdat/<chart>.json as an external-link run inside a text field (Text.Description, a Note, Row.Notes) so FLEx shows a clickable link and S/R syncs both string and file - cite the code that resolves such links; (2) could FDAT create character styles and apply them to Row.Notes or Segment notes so formatting is visible in FLEx; (3) which of Segment.NotesOS / ConstChartRow.Notes are per-clause vs per-sentence and how FLEx edits them; (4) can TsString runs carry a GUID link to another object (e.g. to a possibility) that FLEx renders as a hyperlink.` },
  { key: 'concurrency-write', prompt: `Investigate writing to a FLEx project from an external program safely. Sources: ${SRC}/liblcm/src/SIL.LCModel/Infrastructure/Impl/SharedXMLBackendProvider.cs (+ XMLBackendProvider, BackendProviderType, LcmCache creation: grep CreateCacheFromExistingData, kSharedXML, kXML; how sharing between processes on one machine works: memory-mapped file? mutex? lock file .fwdata.lock? what happens if another process has the project open in non-shared mode), ${SRC}/flexlibs/flexlibs/code/FLExProject.py OpenProject (which backend type it uses, writeEnabled, how it wraps writes in units of work - grep NonUndoableUnitOfWorkHelper / UndoableUnitOfWork), FLExTools wiki on GitHub (https://github.com/cdfarrow/FLExTools/wiki - pages about running while FLEx is open, project locks, 'Modify' modules), ${SRC}/flextools docs, liblcm data-version checks on open (grep ModelVersion, 'DataMigration', 'IsDataMigrationNeeded' - what happens when the project's version is newer than the library), FixFwData / FwDataFixer location (grep FixData in liblcm and FieldWorks), and deep links: flexlibs BuildGotoURL and FieldWorks Src/Common/FwUtils/FwLinkArgs.cs (silfw:// URL format, tool names incl. any discourse/chart tool, so FDAT could open FLEx at a given object). Report exact facts with citations: can flexlibs open a project while FLEx has it open (read? write?), which lock/sharing mechanism applies, how writes must be wrapped, how to validate afterwards, and the deep-link URL format.` },
  { key: 'docs-and-community', prompt: `Sweep GitHub-hosted documentation (the SIL sites are blocked). Read and quote from: ${SRC}/flexbridge/ReadMe.md and FileTypeHandlers.md; ${SRC}/liblcm/README.md and AGENTS.md; ${SRC}/FieldWorks/ReadMe.md, CLAUDE.md, AGENTS.md, CONTEXT.md, Docs/ (list files; read any about data model, projects, custom fields, S/R); ${SRC}/flexlibs/README.rst, docs/sphinx (all .rst), history.md; ${SRC}/flextools/README.md, docs/, history.txt; the FLExTools wiki via WebFetch (https://github.com/cdfarrow/FLExTools/wiki and every page linked from it that concerns custom fields, projects, FLEx running, writing/'Modify' modules, 'Linked files'); https://github.com/sillsdev/chorus README; https://github.com/MattGyverLee/FlexToolsMCP README (it indexes LibLCM/flexlibs docs - see what it documents about custom fields, linked files, media). Extract every statement relevant to: what Send/Receive syncs (linked files, size limits, settings), custom fields, custom lists, text tags, media/linked files on texts, opening projects concurrently with FLEx, writing from scripts. Quote verbatim with URLs/paths. Also note where the 'Technical Notes on FieldWorks Send-Receive' document is referenced so the owner can read it on the SIL site.` },
]

function verifyPrompt(f, lens) {
  const lensText = lens === 'source'
    ? 'LENS = SOURCE: re-open the cited source at the cited lines/URL and check the claim is literally supported by it. If the citation is wrong or the text says something different, say so.'
    : 'LENS = BEHAVIOUR: look for code or documentation elsewhere in the same repositories that contradicts the claim or its implication in practice (UI validation, migrations, sync handlers, exporters). Search with Grep across the cloned repos.'
  return `${CONTEXT}
You are a skeptical verifier. Try to REFUTE this finding. ${lensText}
CLAIM: ${f.claim}
EVIDENCE GIVEN: ${f.evidence}
SOURCE GIVEN: ${f.source}
IMPLICATION GIVEN: ${f.implication || '(none)'}
Rules: 'confirmed' only if you actually read the source and it supports the claim as stated; 'refuted' if the source or other evidence contradicts it (give the correction); 'unverifiable' if the source is unreachable. Default to 'refuted' when the claim overstates what the source shows. List every path/URL you checked.`
}

// ---------------------------------------------------------------------------
// Cross-session resume: args.state.results maps an agent label to its completed result
// (see rebuild.py). run() returns that result instead of spawning an agent.
// ---------------------------------------------------------------------------
const STATE = (args && args.state && args.state.results) || {}
let reused = 0
function run(label, prompt, opts) {
  if (STATE[label] !== undefined && STATE[label] !== null) { reused++; return Promise.resolve(STATE[label]) }
  return agent(prompt, { ...opts, label })
}

phase('Sweep')
const sweepResults = await pipeline(
  INVESTIGATIONS,
  (inv) => run(`sweep:${inv.key}`, `${CONTEXT}\nINVESTIGATION "${inv.key}":\n${inv.prompt}`, { phase: 'Sweep', schema: FINDINGS, effort: 'high' }),
  (res, inv) => res ? { key: inv.key, summary: res.summary, openQuestions: res.openQuestions || [], findings: res.findings || [] } : null
)
const sweep = sweepResults.filter(Boolean)
log(`sweep: ${sweep.length} investigations, ${sweep.reduce((n, r) => n + r.findings.length, 0)} findings`)

// Verification budget: critical claims first, taken round-robin across investigations so every
// thread gets checked, capped at VERIFY_BUDGET. Everything else stays tagged [unchecked].
const VERIFY_BUDGET = 20
const queues = sweep.map(r => ({ r, items: r.findings.map((f, i) => ({ r, f, i: i + 1 })).sort((a, b) => (b.f.critical ? 1 : 0) - (a.f.critical ? 1 : 0)) }))
const selected = []
for (let progress = true; progress && selected.length < VERIFY_BUDGET;) {
  progress = false
  for (const q of queues) { if (q.items.length && selected.length < VERIFY_BUDGET) { selected.push(q.items.shift()); progress = true } }
}
const totalFindings = sweep.reduce((n, r) => n + r.findings.length, 0)
log(`verifying ${selected.length} of ${totalFindings} findings (${totalFindings - selected.length} left unchecked)`)

const verifyOne = (s, extra) => run(`verify:${s.r.key}#${s.i}`, verifyPrompt(s.f, 'source') + `\nAlso search the repositories for code or documentation that contradicts the claim in practice (UI validation, sync handlers, migrations, exporters).${extra ? ' Why this claim was selected: ' + extra : ''}`, { phase: 'Verify', schema: VERDICT }).then(v => ({ ...s, verdict: v }))

phase('Verify')
const verified = (await parallel(selected.map(s => () => verifyOne(s, '')))).filter(Boolean)
const statusOf = (r, idx) => { const v = verified.find(x => x.r === r && x.i === idx + 1); return v && v.verdict ? v.verdict.verdict : 'unchecked' }
const correctionOf = (r, idx) => { const v = verified.find(x => x.r === r && x.i === idx + 1); return v && v.verdict && v.verdict.verdict === 'refuted' ? (v.verdict.correction || v.verdict.reason) : '' }
const renderSweep = () => sweep.map(r => `## ${r.key}\n${r.summary}\n` + r.findings.map((f, i) => `- [${r.key} #${i + 1}] [${statusOf(r, i)}] (${f.confidence}${f.critical ? ', critical' : ''}) ${f.claim}\n  evidence: ${f.evidence}\n  source: ${f.source}\n  implication: ${f.implication || ''}` + (correctionOf(r, i) ? `\n  CORRECTION: ${correctionOf(r, i)}` : '')).join('\n') + (r.openQuestions.length ? `\nOpen questions: ${r.openQuestions.join(' / ')}` : '')).join('\n\n')
log(`verified ${verified.length}: ${verified.filter(v => v.verdict && v.verdict.verdict === 'confirmed').length} confirmed, ${verified.filter(v => v.verdict && v.verdict.verdict === 'refuted').length} refuted`)

const CRITIQUE = {
  type: 'object',
  required: ['extraVerify', 'gaps'],
  properties: {
    extraVerify: { type: 'array', items: { type: 'object', required: ['key', 'index', 'why'], properties: { key: { type: 'string' }, index: { type: 'integer' }, why: { type: 'string' } } } },
    gaps: { type: 'array', items: { type: 'object', required: ['question', 'why', 'whereToLook'], properties: { question: { type: 'string' }, why: { type: 'string' }, whereToLook: { type: 'string' } } } },
  },
}

phase('Critique')
const critique = await run('critic', `${CONTEXT}
You are the completeness critic. Below are all findings from eight investigators, tagged [confirmed]/[refuted]/[unverifiable]/[unchecked] after a limited verification pass. The design question: where can FDAT anchor per-row data (colour bands, custom-column values that must link to specific rows), per-marker styling/visibility, and per-chart settings so that Send/Receive syncs them without breaking FLEx. The owner's framing: FDAT's starting data is the Text Chart tab (DsConstChart and its rows/cells), so data should be linked to the chart, not to the baseline/gloss/tagging/print tabs. A separate, already spot-checked report on chart-level anchors exists at /home/user/fdat/desktop/research/flex-anchors/chart-anchors-report.md: read it first; do not ask to re-verify what it settles.
(1) extraVerify: AT MOST 4 [unchecked] findings that the design would depend on or that contradict another finding, by key and 1-based index exactly as listed. (2) gaps: AT MOST 4 questions no finding answers that a targeted read of the sources could answer, most important first, each with a concrete place to look.

${renderSweep()}`, { phase: 'Critique', schema: CRITIQUE, effort: 'high' })

const extras = []
for (const s of ((critique && critique.extraVerify) || []).slice(0, 4)) {
  const r = sweep.find(x => x.key === s.key); const f = r && r.findings[s.index - 1]
  if (f && !verified.some(v => v.r === r && v.i === s.index) && !extras.some(x => x.f === f)) extras.push({ r, f, i: s.index, why: s.why })
}
const gaps = ((critique && critique.gaps) || []).slice(0, 4)
log(`critic asked for ${extras.length} extra verifications and ${gaps.length} gaps`)
verified.push(...(await parallel(extras.map(s => () => verifyOne(s, s.why)))).filter(Boolean))

phase('Gap sweep')
const gapResults = (await parallel(gaps.map((g, i) => () =>
  run(`gap:${i + 1}`, `${CONTEXT}\nGAP INVESTIGATION #${i + 1}\nQUESTION: ${g.question}\nWHY IT MATTERS: ${g.why}\nWHERE TO LOOK: ${g.whereToLook}\nAnswer the question with cited findings.`, { phase: 'Gap sweep', schema: FINDINGS, effort: 'high' })
    .then(res => res ? { key: `gap: ${g.question}`, summary: res.summary, openQuestions: res.openQuestions || [], findings: res.findings || [] } : null)))).filter(Boolean)

const renderAll = () => renderSweep() + '\n\n' + gapResults.map(r => `## ${r.key}\n${r.summary}\n` + r.findings.map(f => `- [unchecked] ${f.claim}\n  evidence: ${f.evidence}\n  source: ${f.source}\n  implication: ${f.implication || ''}`).join('\n')).join('\n\n')

phase('Synthesize')
const report = await run('synthesize', `${CONTEXT}
Write the report "Where FDAT data can be anchored in a FLEx project" as GitHub-flavoured Markdown for the FDAT owner (a linguist-developer). FIRST read /home/user/fdat/desktop/research/flex-anchors/chart-anchors-report.md (chart-level anchors, custom fields on chart classes, GUID stability, sync layout; its key claims were spot-checked in the source) and integrate it; it takes precedence where findings overlap. The owner's framing: FDAT's starting data is the Text Chart tab (DsConstChart and its rows/cells); data should be linked to the chart, not to the baseline/gloss/tagging/print tabs; features are per-row colour-coding and custom columns (values must link to specific rows), per-marker styling and show/hide, and per-chart settings. The owner is open to model fields, custom fields, linked files, or any other easy solution, as long as it syncs with Send/Receive and does not break the FLEx data model.
Findings below are tagged [confirmed]/[refuted]/[unverifiable]/[unchecked]: treat [refuted] as false (use the CORRECTION); say explicitly where a conclusion rests on [unchecked] material. Cite sources inline as backticked path:line or URLs. Structure:
1. Summary and recommendation: which anchor for which kind of data; the owner's linked-JSON idea: verdict and concrete design if viable; what to spike first on a real project.
2. Anchor points table: object/property | what it can hold | owner and cardinality | synced by Send/Receive and merge granularity | visible/editable in FLEx | FLEx behaviour and risks | citation.
3. Custom fields on chart classes (from the chart-anchors report) and on Segment/RnGenericRec: exact types, how definitions and values sync, programmatic-creation risks.
4. Linked file design: where the file must live, size/merge limits, how (and whether) to reference it from the model (CmMediaURI on Text.MediaFilesOA, external-link run in a text field, CmFile under LangProject.MediaOC, or unreferenced by convention), what FLEx does with each.
5. Tags and lists: TextTag semantics, Text Markup Tags structure, custom lists, colour fields and whether FLEx renders them; why tags are a poor fit given the chart-not-tagging framing.
6. Rich text, notes and styles: ConstChartRow.Notes vs Segment notes, TsString links (object GUID links, external file links), character styles.
7. Chart export format (exact spec from DiscourseExporter) and concrete corrections to /home/user/fdat/desktop/PLAN.md section 4 and /home/user/fdat/desktop/sidecar/fdat_lcm.py (read both).
8. GUID stability of chart objects across FLEx edits, and a concrete re-anchoring strategy for rows.
9. Concurrency, locking, write discipline, validation (FixFwData), deep links into FLEx.
10. Open questions needing a real project or the SIL documents that were unreachable here (name them).
Be exhaustive but concrete; no filler.

FINDINGS:
${renderAll()}`, { phase: 'Synthesize', effort: 'high' })

return { report, stats: { investigations: sweep.length, findings: totalFindings, verified: verified.length, confirmed: verified.filter(v => v.verdict && v.verdict.verdict === 'confirmed').length, refuted: verified.filter(v => v.verdict && v.verdict.verdict === 'refuted').length, gaps: gapResults.length, reused } }
