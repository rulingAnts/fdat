export const meta = {
  name: 'flex-anchor-research-continue',
  description: 'Resume the FLEx anchor-point research from a saved state (args.state from rebuild.py); runs only agents whose results are missing',
  phases: [
    { title: 'Sweep', detail: 'eight investigators (cached when present in state)' },
    { title: 'Verify', detail: 'each key claim re-checked by one or two skeptics' },
    { title: 'Critique', detail: 'completeness critic lists gaps' },
    { title: 'Gap sweep', detail: 'targeted investigations for each gap, then verified' },
    { title: 'Synthesize', detail: 'cited anchor-points report' },
  ],
}

// ---------------------------------------------------------------------------
// Resume support: args.state.results maps an agent label to its completed result
// (see rebuild.py). cachedAgent() returns that result instead of spawning an agent.
// Labels are deterministic, so the same script can be resumed any number of times.
// ---------------------------------------------------------------------------
const STATE = (args && args.state && args.state.results) || {}
let reused = 0
function cachedAgent(label, prompt, opts) {
  if (STATE[label] !== undefined && STATE[label] !== null) { reused++; return Promise.resolve(STATE[label]) }
  return agent(prompt, { ...opts, label })
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

async function verifyFindings(findings, labelPrefix, phaseName) {
  return (await parallel(findings.map((f, i) => async () => {
    const lenses = f.critical ? ['source', 'behaviour'] : ['source']
    const votes = (await parallel(lenses.map(lens => () =>
      cachedAgent(`${labelPrefix}#${i + 1}:${lens}`, verifyPrompt(f, lens), { phase: phaseName, schema: VERDICT })))).filter(Boolean)
    return { ...f, votes }
  }))).filter(Boolean)
}

phase('Sweep')
const results = await pipeline(
  INVESTIGATIONS,
  (inv) => cachedAgent(`sweep:${inv.key}`, `${CONTEXT}\nINVESTIGATION "${inv.key}":\n${inv.prompt}`, { phase: 'Sweep', schema: FINDINGS, effort: 'high' }),
  async (res, inv) => {
    if (!res) return null
    const claims = res.findings.slice(0, 14)
    log(`${inv.key}: ${res.findings.length} findings, verifying ${claims.length}`)
    const verified = await verifyFindings(claims, `verify:${inv.key}`, 'Verify')
    return { key: inv.key, summary: res.summary, openQuestions: res.openQuestions, findings: verified }
  }
)

const sweep = results.filter(Boolean)
const status = (f) => f.votes.some(v => v.verdict === 'refuted') ? 'refuted' : (f.votes.every(v => v.verdict === 'confirmed') && f.votes.length ? 'confirmed' : 'unverified')
const digest = (items) => items.map(r => `## ${r.key}\n${r.summary}\n` + r.findings.map(f => `- [${status(f)}] ${f.claim} (source: ${f.source})` + (status(f) === 'refuted' ? ` CORRECTION: ${f.votes.filter(v => v.verdict === 'refuted').map(v => v.correction || v.reason).join(' | ')}` : '')).join('\n') + (r.openQuestions.length ? `\nOpen questions: ${r.openQuestions.join(' / ')}` : '')).join('\n\n')

phase('Critique')
const critique = await cachedAgent('critic', `${CONTEXT}
You are the completeness critic. Below are the verified findings so far. List the GAPS: questions that the FDAT storage design still cannot answer, claims marked refuted/unverified that matter and need a better source, and modalities not yet checked (for example: FLExBridge merge handlers for the classes we want to use, data migration risk for custom fields on unusual classes, how FLEx reacts to unknown media URIs, GUID stability of chart rows across FLEx edits, Chorus size limits). At most 10 gaps, most important first, each with a concrete place to look.

${digest(sweep)}`, { phase: 'Critique', schema: GAPS, effort: 'high' })

const gaps = (critique && critique.gaps ? critique.gaps : []).slice(0, 10)
log(`critic listed ${gaps.length} gaps`)

phase('Gap sweep')
const gapResults = await pipeline(
  gaps,
  (g, _o, i) => cachedAgent(`gap:${i + 1}`, `${CONTEXT}\nGAP INVESTIGATION #${i + 1}\nQUESTION: ${g.question}\nWHY IT MATTERS: ${g.why}\nWHERE TO LOOK: ${g.whereToLook}\nAnswer the question with cited findings.`, { phase: 'Gap sweep', schema: FINDINGS, effort: 'high' }),
  async (res, g, i) => {
    if (!res) return null
    const claims = res.findings.slice(0, 8)
    const verified = await verifyFindings(claims, `verify:gap${i + 1}`, 'Gap sweep')
    return { key: `gap: ${g.question}`, summary: res.summary, openQuestions: res.openQuestions, findings: verified }
  }
)

const all = sweep.concat(gapResults.filter(Boolean))
const confirmedCount = all.reduce((n, r) => n + r.findings.filter(f => status(f) === 'confirmed').length, 0)
const refutedCount = all.reduce((n, r) => n + r.findings.filter(f => status(f) === 'refuted').length, 0)
log(`total findings: ${all.reduce((n, r) => n + r.findings.length, 0)}, confirmed ${confirmedCount}, refuted ${refutedCount}, reused from state ${reused}`)

phase('Synthesize')
const report = await cachedAgent('synthesize', `${CONTEXT}
Write the report "Where FDAT data can be anchored in a FLEx project" as GitHub-flavoured Markdown, for the FDAT owner (a linguist-developer). Use ONLY the findings below; treat [refuted] items as false (use their corrections) and [unverified] items as uncertain (say so). Cite sources inline as backticked path:line or URLs. Structure:
1. Summary and recommendation (what to use for what; the owner's linked-JSON idea: verdict and the concrete design if viable).
2. Anchor points table: object/property | what it can hold | who owns it / cardinality | synced by Send/Receive? merge granularity | visible/editable in FLEx? | FLEx behaviour and risks | citation.
3. Linked file design: where the file must live, how (and whether) to reference it from the model (CmMediaURI on Text.MediaFilesOA, external-link run in a text field, CmFile under LangProject.MediaOC, or unreferenced), size/merge limits, what FLEx does with it.
4. Custom fields: exact allowed classes and types, how definitions and values sync, programmatic creation risks.
5. Tags and lists: TextTag semantics, Text Markup Tags structure, custom lists, colour fields and whether FLEx renders them.
6. Rich text, notes and styles: Row.Notes vs Segment notes, TsString links (object GUID links, external file links), character styles.
7. Chart export format (exact spec from DiscourseExporter) and corrections to desktop/PLAN.md section 4 and desktop/sidecar/fdat_lcm.py.
8. GUID stability of chart objects across FLEx edits.
9. Concurrency, locking, write discipline, validation, deep links into FLEx.
10. Open questions that need a real project or the blocked SIL documents (name the documents).
Be exhaustive but concrete; no filler.

FINDINGS:
${all.map(r => `## ${r.key}\n${r.summary}\n` + r.findings.map(f => `- [${status(f)}] ${f.claim}\n  evidence: ${f.evidence}\n  source: ${f.source}\n  implication: ${f.implication || ''}` + (status(f) === 'refuted' ? `\n  CORRECTION: ${f.votes.filter(v => v.verdict === 'refuted').map(v => v.correction || v.reason).join(' | ')}` : '')).join('\n') + (r.openQuestions.length ? `\nOpen questions: ${r.openQuestions.join(' / ')}` : '')).join('\n\n')}`,
  { phase: 'Synthesize', effort: 'high' })

return { report, digest: digest(all), stats: { confirmed: confirmedCount, refuted: refutedCount, reused } }
