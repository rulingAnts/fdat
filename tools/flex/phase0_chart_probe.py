#!/usr/bin/env python3
"""
Phase 0 probe for FDAT's FLEx integration (see PLAN-flex-integration.md §6).

Lists the discourse charts of a FieldWorks project and dumps, for one chart, every
charted word with its baseline text (what was typed, in the text's own writing
system), its form in the project's default vernacular writing system, every other
alternate, and the occurrence key (segment GUID + index).

Run on Windows with FieldWorks installed, FLEx closed (or the project's Sharing
option on), in a Python whose architecture matches FieldWorks:

    python -m pip install --upgrade pyflexicon
    python tools/flex/phase0_chart_probe.py <ProjectName>                 # list charts
    python tools/flex/phase0_chart_probe.py <ProjectName> --chart <guid|title> [--out dump.txt]

Only the SUMMARY block is needed back; the dump contains language data.
"""
import argparse
import sys
import traceback


def tss_text(tss):
    try:
        return (tss.Text or "") if tss is not None else ""
    except Exception:
        return ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("--chart", help="chart GUID or (part of) the chart/text title")
    ap.add_argument("--out", help="write the word dump here instead of stdout")
    args = ap.parse_args()

    import flexicon  # pip install pyflexicon
    flexicon.FLExInitialize()
    project = flexicon.FLExProject()
    try:
        project.OpenProject(args.project)  # read-only
        lp = project.lp
        cache = project.project
        wsf = cache.ServiceLocator.WritingSystemFactory
        ws_code = lambda ws: wsf.GetStrFromWs(ws) if ws else ""
        default_vern = lp.DefaultVernacularWritingSystem.Handle

        charts = list(lp.DiscourseDataOA.ChartsOC)
        print("Charts in project %r:" % args.project)
        for ch in charts:
            text = getattr(ch, "BasedOnRA", None)
            title = tss_text(getattr(text, "Title", None).BestVernacularAlternative) if text is not None and getattr(text, "Title", None) is not None else ""
            print("  %s  rows=%d  text=%r" % (ch.Guid, ch.RowsOS.Count, title))
        if not args.chart:
            return 0

        want = args.chart.lower()
        chart = None
        for ch in charts:
            text = getattr(ch, "BasedOnRA", None)
            title = tss_text(text.Title.BestVernacularAlternative) if text is not None else ""
            if str(ch.Guid).lower() == want or (title and want in title.lower()):
                chart = ch
                break
        if chart is None:
            print("No chart matches %r" % args.chart, file=sys.stderr)
            return 2

        out = open(args.out, "w", encoding="utf-8") if args.out else sys.stdout
        words = empty_baseline = empty_default = no_seg = rows_err = 0
        ws_seen = {}
        for row in chart.RowsOS:
            try:
                label = tss_text(row.Label)
                for part in row.CellsOS:
                    if part.ClassName != "ConstChartWordGroup":
                        continue
                    col = tss_text(part.ColumnRA.Name.BestAnalysisVernacularAlternative) if part.ColumnRA is not None else ""
                    for occ in part.GetOccurrences():
                        words += 1
                        base = tss_text(occ.BaselineText)
                        base_ws = ws_code(occ.BaselineWs)
                        ws_seen[base_ws] = ws_seen.get(base_ws, 0) + 1
                        if not base.strip():
                            empty_baseline += 1
                        wf = occ.Analysis.Wordform if occ.Analysis is not None else None
                        default_form = tss_text(wf.Form.get_String(default_vern)) if wf is not None else ""
                        if not default_form.strip():
                            empty_default += 1
                        alts = []
                        if wf is not None:
                            for ws in wf.Form.AvailableWritingSystemIds:
                                alts.append("%s=%r" % (ws_code(ws), tss_text(wf.Form.get_String(ws))))
                        seg = occ.Segment
                        seg_guid = str(seg.Guid) if seg is not None else ""
                        if not seg_guid:
                            no_seg += 1
                        out.write("row=%s col=%r base=%r (%s) default=%r alts=[%s] seg=%s idx=%d\n"
                                  % (label, col, base, base_ws, default_form, ", ".join(alts), seg_guid, occ.Index))
            except Exception:
                rows_err += 1
                traceback.print_exc(file=sys.stderr)
        if out is not sys.stdout:
            out.close()

        print("\nSUMMARY")
        print("  chart            : %s" % chart.Guid)
        print("  words            : %d" % words)
        print("  empty baseline   : %d   (expected 0)" % empty_baseline)
        print("  empty default-WS : %d   (compare with empty <word>s in FLEx's own export)" % empty_default)
        print("  missing segment  : %d   (expected 0)" % no_seg)
        print("  baseline WS seen : %s" % ws_seen)
        print("  default vern WS  : %s" % ws_code(default_vern))
        print("  rows with errors : %d" % rows_err)
        return 0
    finally:
        try:
            project.CloseProject()
        finally:
            flexicon.FLExCleanup()


if __name__ == "__main__":
    sys.exit(main())
