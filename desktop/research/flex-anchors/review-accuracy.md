Checked the draft against the FINDINGS, the chart-anchors report (CA), the current `desktop/PLAN.md`, and re-read the doubtful sources under the scratchpad clones. Corrections, most serious first:

**1. §1.3, second bullet — the PLAN citation is stale and the claim it "corrects" no longer exists.**
Draft: *"**A custom field on `Text` is not visible in the Info tab, and the dialog never offered `Text` at all.** PLAN.md:130 asserts both."*
`PLAN.md:130` is now `` `ConstChartRow` and `DsConstChart`**, and they sync and merge per object.`` — the "shows up in the text's Info tab as an opaque JSON block" text was removed in commit `aae55d2` ("replace the remainder-JSON design with the researched storage model"). The gap-report quote the bullet rests on is from the pre-`aae55d2` PLAN. Change to: state the finding as background (a custom field on `Text` would be invisible and FDAT-managed), drop "PLAN.md:130 asserts both" and the "parenthetical is also inverted" sentence, or re-target them at the PLAN as it now stands (which no longer mentions `Text` custom fields except in the Phase-0 checklist, `PLAN.md:200` — that line *is* still worth flagging, since it tells the spike to verify a `Text` custom field).

**2. §3.6 heading and closing claim — also aimed at a superseded PLAN.**
Draft: *"### 3.6 The `OwningAtomic → StText` custom field (corrects PLAN §5/§7)"* and *"**So PLAN §5 item 1 and §7's "the JSON remainder … merges as one string" is wrong for this field type**"*.
`PLAN.md:152` already says "add a custom owning-atomic `StText` field if prologue/epilogue need rich text (**it merges per paragraph**)", and `PLAN.md:230`'s "the JSON remainder in a custom field merges as one string" is about the `String` field on `DsConstChart` — which the draft itself agrees is correct for that type. Change the heading to "### 3.6 The `OwningAtomic → StText` custom field" and replace the closing sentence with: "This confirms PLAN.md:152; the 'merges as one string' warning at PLAN.md:230 remains correct for the `String` remainder field and should not be generalised to the StText variant." Same edit in the §1.1 table cell ("that is a correction to PLAN §5/§7").

**3. §1.3, first bullet — it overrides CA addendum 5 without saying so, contrary to the draft's own provenance rule.**
Draft: *"**Put all three in FDAT's own store keyed by marker GUID**; mirror colour to `ForeColor`/`BackColor` only if you want other tools to see it."*
CA addendum 5 ("storing marker styling, grouping and visibility on the markers themselves") recommends the opposite for colour — `ForeColor`/`BackColor` as "a good home for FDAT's marker colours", with two named caveats (dormant ≠ reserved; project-wide, so no per-chart variation) — and already states the grouping boundary the draft re-derives ("FDAT should **read** the hierarchy, not restructure it") and a conditional use of `Hidden`. Since §"Provenance" says CA takes precedence where you overlap, either (a) adopt CA's split — colour and project-wide visibility on the possibility, per-chart overrides and bold/italic/size in FDAT's settings keyed by marker GUID — or (b) keep your recommendation but add an explicit sentence saying it supersedes CA addendum 5 and why (e.g. per-chart variation is required). Propagate to the §1.1 and §2 table cells.

**4. §1.3 and §5.4 — "the overlay feature was removed" mis-paraphrases the model comment.**
Draft §1.3: *"the model calls them 'overlay functionality', the overlay feature was removed"*; §5.4: *"documented as 'for overlay functionality', a feature the model itself says was removed (`MasterLCModel.xml:352-372,636-645`)"*.
`MasterLCModel.xml:636-640` says the opposite about the fields: "An overlay is a collection of CmPossibilities used to mark up text in a StText. **The formatting for each item is defined by properties on the CmPossibility.** In the original model, we had model CmOverlayTag that could carry their own formatting apart from the formatting defined in the CmPossibility. In the current model, we have removed this capability." Only per-tag formatting was removed; `CmOverlay` (class 21) and `LangProject.Overlays` still exist. Replace with: "the model documents them as the formatting for overlay possibilities; what is gone is `CmOverlayTag`'s own formatting, and the evidence that nothing renders them today is the grep over the (sparse) FieldWorks checkout, not the model comment."

**5. §9.2 — the owning-sequence reasoning is not the operative mechanism.**
Draft: *"Since `DsConstChart.Rows` is an owning **sequence**, writing a custom field on `DsConstChart` while the user is inserting rows is a conflict."*
`ChangeReconciler.OkToReconcileDirtball` exempts only `DateModified` and `OwningCollection` *differences*; the FDAT custom-field difference is itself non-exempt, so the conflict fires whatever cardinality `Rows` has. Replace with: "Writing a custom field on `DsConstChart` while the user has unsaved edits on that chart is a conflict: the custom-field difference is not one of the two exempt kinds, so the fact that `Rows` is an owning sequence rather than a collection does not even come into it."

**6. §7.1 — `lang="en"` on the group header is test-specific, not the rule.**
Draft skeleton: `<cell cols="K"><main><lit lang="en">Group</lit></main></cell>`.
Only `rownum` and `clauseMkr` are hard-coded English (`WsLineNumber` = `GetWsFromStr("en")`); header labels carry the possibility name's writing system, and the "en" in `DiscourseExportTests.cs:505-560` is just the test project's analysis WS (the same tests show `<lit lang="en">Notes</lit>` for the header the draft renders as `analWs`). Change the group-header `lang="en"` to `lang="analWs"` for consistency with the Notes-header and title2 lines.

**7. §7.3 — the empty-notes row cites the wrong line and the wrong current output.**
Draft row: *"| 264-265 | `<main/>` for empty notes | `<main><note lang="…"/></main>` |"*.
In `desktop/sidecar/fdat_lcm.py`, line 264 is the **empty data column** (`out.append('      <cell><main/></cell>')`); the notes cell is line 266, and when `notes` is falsy it emits `<cell><main></main></cell>`, not `<main/>`. Change the row to "| 266 | `<main></main>` (no `<note>`) for empty notes | `<main><note lang="…"/></main>` |". (Also: "236-241 | parts bucketed by leaf" — the bucketing block starts at line 230; cite 230-241.) The other sidecar line numbers I checked (189, 196-206, 208-219, 223-226, 244-249, 250-253, 254-257, 258, `template_columns`:129, `analyses_of`:140, `analysis_form_and_gloss` using `wf.Form`) are accurate.

**8. §1.1 — "inert in every FLEx UI" is stronger than your own §5.4.**
Draft: *"their colour fields are inert in every FLEx UI."*
§5.4 rates the same claim "Confidence **medium** (sparse checkout: overlay-era and Scripture UI not inspected)" and §10 keeps it as open question 9. Change to "inert in every FLEx UI searched (sparse checkout — §5.4, medium confidence)".

**9. §2 — `DsConstChart.Name`/`.Description` "Never read…" is an inference from a grep, presented as settled.**
Draft: *"**Never read, displayed, edited or exported by FLEx**"* citing CA 1.3, 1.7, 1.8, 1.9.
CA 1.7 is explicitly marked "Inferred from grep of the sparse checkout"; discourse-code #17's own open question asks whether `DsChart.Name`/`Description` is shown anywhere in FLEx (Lists, bulk edit). Change to "Not read, displayed or exported by any FLEx code in the sparse checkout (CA 1.7, inferred from grep)" and add it to §10's "needs a real project" list.

**10. §1.1 — the per-paragraph StText merge is stated as settled but is open question 4.**
Draft: *"The StText variant merges **per paragraph**, not as one string (§3.6)"*.
The gap report says "No FLExBridge test performs a full 3-way merge or split/flatten round trip of a custom OwningAtomic StText"; §10 item 4 says the same. Mark the table cell **[unchecked]** (derived from strategy code, spike item 4), as the draft's provenance rule requires.

**11. §7.2 — the notes-side rule omits the RTL term.**
Draft: *"The Notes cell is **first** when the user's `notesOnRight` setting is false."*
The exporter's condition is `if (!(NotesColumnOnRight ^ fRtL)) MakeNoteCell();`. Change to "…when `notesOnRight` is false (or, in an RTL chart, when it is true) — the test is `NotesColumnOnRight XOR RightToLeft`", matching the §7.1 skeleton's comment.

**12. §1.3 / §3.1 — two `[confirmed]` labels are not supported by the provenance you declared.**
Draft: *"`Segment` **is** offered (`FieldWorks/Src/xWorks/AddCustomFieldDlg.cs:120`, **[confirmed]**)"* and *"(`AddCustomFieldDlg.cs:109-133`, **[confirmed]**; CA 3.4)"*.
CA's spot-checked set is 3.1/3.7/3.9/2.11; 3.4 is not in it, and the findings mark the dialog claims `[unchecked]`. I re-read `AddCustomFieldDlg.cs:105-133` in this review: line 120 is indeed `m_locationComboBox.Items.Add(new IdAndString<int>(SegmentTags.kClassId, "Segment"));` and the filter at 129-133 is as quoted, so the **content stands** — only relabel (e.g. "verified in review", not the CA spot-check set).

**13. §5.5 point 3 — the "does not leak into Print/exports" clause is inferred, and the sweep is bounded.**
Draft: *"It does *not* leak into the Print view or any interlinear export (`InterlinPrintVc` extends `InterlinVc`, whose `AddExtraBundleRows` is empty; …)"*.
The gap finding is `[unchecked]` and self-describes as "Inferred from the VC class hierarchy and grep", with the consumer sweep rated medium confidence because folders outside the sparse checkout were not searched. Add "(inferred from the VC hierarchy and a grep of the sparse checkout)".

**14. §4.3 and §2 — the Text Info-tab "Media" line depends on a very recent file.**
Draft: *"the Text **Info tab** shows every URI as read-only static text via `MediaInfoSlice`"*.
The linked-files open questions flag that `MediaInfoSlice.cs` carries a 2026 copyright and that older FLEx versions show nothing for `Text.MediaFiles`. Since the verdict ("do not use") does not depend on it, either add "(in current FLEx; older versions show nothing)" or drop the detail.

**15. Minor citation fixes.** (a) §1.3/§5.4 cite `MasterLCModel.xml:352-372` for the colour/visibility fields; the block is **354-378** (`ForeColor` 354, `Hidden` 374-378), and §3.4's `369-379` for `IsProtected` should be `379-383`. (b) §1.1 footer: "custom-field **definitions** in `FLExProject.CustomProperties` (an explicit include, written **first**)" — `FlexFolderSystem.cs:47-48` puts it immediately *after* `FLExProject.ModelVersion`, as §3.2 correctly says. (c) §9.1 cites "CA addendum 1"; that addendum is unnumbered ("Addendum: project sharing mode") — cite it by name.

Everything else I sampled checks out against the findings or the sources: §1.2's four linked-file facts and the `.txt` warning; §3.2/§3.3 (definition sync, `Custom_<Class>_<Prop>` keying, validator); §3.4's two `[refuted → corrected]` passages, which match both corrections including the `FindByKeyAttribute("name")` nuance and the `LexEntry`-only override; §3.5, §3.7, §4.1-4.2, §5.1-5.4, §6.1-6.3, §7.1's export rules, §8.1 (incl. "template deleted → retargeted to default", CA 2.5), §8.2 (`docs/app.js:261-290` is the token registry; XSL 246-258/300-330 as described), §8.3, §9.1, §9.3-9.6.