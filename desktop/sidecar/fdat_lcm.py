#!/usr/bin/env python3
"""
FDAT LCM sidecar (Phase 0 spike).

Reads FieldWorks discourse charts through flexlibs (https://github.com/cdfarrow/flexlibs)
and emits the XML shape the FDAT renderer already consumes (see
test/fixtures/sample-chart.xml), with a `guid` attribute on rows, cells and tokens.

    python fdat_lcm.py list-projects
    python fdat_lcm.py list-charts <ProjectName>
    python fdat_lcm.py export <ProjectName> <chartGuid> [out.xml]
    python fdat_lcm.py serve <ProjectName>        # JSON-RPC 2.0, one object per line on stdin/stdout

Requirements: Windows, FieldWorks installed, Python 3.x with `flexlibs` (2.x) and
`pythonnet` (the same environment FLExTools uses).

STATUS: written without access to a FieldWorks installation, so it has NOT been run.
The LCM property names follow the FieldWorks LCM model (SIL.LCModel); expect to
adjust details (see PLAN.md §4) on first contact with a real project.
"""
import json
import sys
from xml.sax.saxutils import escape, quoteattr

import os

try:
    from flexlibs import FLExInitialize, FLExCleanup, FLExProject, AllProjectNames
except ImportError:  # keep `--help` style usage working without flexlibs
    FLExInitialize = FLExCleanup = FLExProject = AllProjectNames = None

try:
    from SIL.LCModel import LcmFileHelper
except ImportError:
    LcmFileHelper = None


# ----------------------------------------------------------------------------
# LCM access
# ----------------------------------------------------------------------------

class LcmSession:
    """Owns the flexlibs initialisation and one open project."""

    def __init__(self):
        if FLExProject is None:
            raise RuntimeError('flexlibs is not installed (pip install flexlibs pythonnet)')
        FLExInitialize()
        self.project = None
        self.name = None

    def open(self, name, write=False):
        self.close()
        self.project = FLExProject()
        self.project.OpenProject(name, writeEnabled=write)
        self.name = name
        return {'project': name, 'writeEnabled': bool(write)}

    def close(self):
        if self.project is not None:
            try:
                self.project.CloseProject()
            finally:
                self.project = None
                self.name = None

    def shutdown(self):
        self.close()
        FLExCleanup()

    # -- helpers -------------------------------------------------------------

    @property
    def lp(self):
        if self.project is None:
            raise RuntimeError('no project open')
        return self.project.lp  # ILangProject

    @staticmethod
    def guid(obj):
        return str(obj.Guid)

    @staticmethod
    def tss_text(tss):
        """Text of an ITsString / IMultiString-ish value, or ''."""
        if tss is None:
            return ''
        try:
            return tss.Text or ''
        except AttributeError:
            return str(tss)

    @staticmethod
    def best_analysis(multi):
        try:
            return (multi.BestAnalysisAlternative.Text or '')
        except Exception:
            return ''

    @staticmethod
    def best_vernacular(multi):
        try:
            return (multi.BestVernacularAlternative.Text or '')
        except Exception:
            return ''

    # -- linked files ---------------------------------------------------------

    def linked_files(self):
        """Where FDAT may keep per-chart backup files, and whether they will sync.

        LinkedFilesRootDir is resolved by LCM: it returns <project>/LinkedFiles when
        unset, otherwise it resolves the stored relative path. Never build this by hand.
        Send/Receive only carries linked files when the folder is the default one, so
        report that so the caller can warn instead of writing backups that never travel.
        """
        lp = self.lp
        root = lp.LinkedFilesRootDir
        project_folder = self.project.project.ProjectId.ProjectFolder
        default_root = (LcmFileHelper.GetDefaultLinkedFilesDir(project_folder)
                        if LcmFileHelper is not None else os.path.join(project_folder, 'LinkedFiles'))
        others = (LcmFileHelper.GetOtherExternalFilesDir(root)
                  if LcmFileHelper is not None else os.path.join(root, 'Others'))

        def norm(p):
            return os.path.normcase(os.path.abspath(p)) if p else ''

        return {
            'linkedFilesRoot': root,
            'defaultRoot': default_root,
            # False means the user relocated the folder: FLExBridge syncs nothing from it.
            'syncedBySendReceive': norm(root) == norm(default_root),
            'othersDir': others,
            'fdatBackupDir': os.path.join(others, 'fdat'),
        }

    def ensure_backup_dir(self):
        """Create <LinkedFiles>/Others/fdat and return its path.

        Two practical points:
        * Mercurial does not track empty directories, so this folder does not arrive on a
          colleague's machine by itself -- every install must create it on demand.
        * The README is written only when absent and never rewritten. Chorus claims .txt and
          merges it with diff3, which throws on an overlapping conflict; a file that is created
          once and never modified can never produce one.
        """
        info = self.linked_files()
        path = info['fdatBackupDir']
        os.makedirs(path, exist_ok=True)
        readme = os.path.join(path, 'README.txt')
        if not os.path.exists(readme):
            with open(readme, 'w', encoding='utf-8') as f:
                f.write(
                    "This folder holds backup copies of FDAT (Flex DiscourseChart Analysis Tool)\n"
                    "annotation data, one file per chart per contributor:\n"
                    "\n"
                    "    <chart guid>.<contributor id>.json\n"
                    "\n"
                    "The data itself lives in the FieldWorks project, in custom fields on the\n"
                    "discourse chart and its rows. These files are only a safety net, kept here\n"
                    "so that Send/Receive carries them to the rest of the team.\n"
                    "\n"
                    "FLEx does not use these files, and nothing in FieldWorks refers to them.\n"
                    "Deleting them loses only the backups, not your chart or your FDAT data.\n"
                )
        return {'path': path, 'syncedBySendReceive': info['syncedBySendReceive']}

    # -- charts ---------------------------------------------------------------

    def charts(self):
        dd = self.lp.DiscourseDataOA
        if dd is None:
            return []
        out = []
        for chart in dd.ChartsOC:
            # Only constituent charts (IDsConstChart) are supported.
            if not hasattr(chart, 'RowsOS'):
                continue
            text = chart.BasedOnRA
            out.append({
                'guid': self.guid(chart),
                'title': self.best_analysis(chart.Name) if hasattr(chart, 'Name') else '',
                'textTitle': self.best_vernacular(text.Title) if text is not None and hasattr(text, 'Title') else '',
                'templateName': self.best_analysis(chart.TemplateRA.Name) if chart.TemplateRA is not None else '',
                'rowCount': chart.RowsOS.Count,
            })
        return out

    def find_chart(self, chart_guid):
        for chart in self.lp.DiscourseDataOA.ChartsOC:
            if self.guid(chart).lower() == chart_guid.lower():
                return chart
        raise KeyError('chart not found: ' + chart_guid)

    # -- export ---------------------------------------------------------------

    def template_columns(self, chart):
        """Return (groups, leaves): groups = [(possibility, [leaf, ...])], leaves flat in order."""
        groups = []
        leaves = []
        for top in chart.TemplateRA.SubPossibilitiesOS:
            subs = list(top.SubPossibilitiesOS)
            cols = subs if subs else [top]
            groups.append((top, cols))
            leaves.extend(cols)
        return groups, leaves

    def analyses_of(self, wg):
        """Yield the IAnalysis objects covered by a ConstChartWordGroup."""
        seg = wg.BeginSegmentRA
        end_seg = wg.EndSegmentRA
        while seg is not None:
            analyses = list(seg.AnalysesRS)
            start = wg.BeginAnalysisIndex if seg == wg.BeginSegmentRA else 0
            stop = wg.EndAnalysisIndex + 1 if seg == end_seg else len(analyses)
            for a in analyses[start:stop]:
                yield seg, a
            if seg == end_seg:
                break
            # Walk to the next segment in the paragraph.
            para = seg.Owner
            segs = list(para.SegmentsOS)
            idx = segs.index(seg)
            seg = segs[idx + 1] if idx + 1 < len(segs) else None

    def analysis_form_and_gloss(self, analysis):
        """(wordform text, gloss text) for an IAnalysis (wordform / analysis / gloss / punctuation)."""
        try:
            wf = analysis.Wordform
            form = self.best_vernacular(wf.Form) if wf is not None else self.tss_text(analysis.Form)
        except Exception:
            form = ''
        gloss = ''
        try:
            cls = analysis.ClassName
            if cls == 'WfiGloss':
                gloss = self.best_analysis(analysis.Form)
            elif cls == 'WfiAnalysis':
                meanings = list(analysis.MeaningsOC)
                if meanings:
                    gloss = self.best_analysis(meanings[0].Form)
        except Exception:
            pass
        return form, gloss

    def row_type(self, row):
        try:
            ct = str(row.ClauseType)
        except Exception:
            ct = ''
        ct = ct.lower()
        for t in ('dependent', 'speech', 'song'):
            if t in ct:
                return t
        return 'normal'

    def export_chart_xml(self, chart_guid):
        chart = self.find_chart(chart_guid)
        groups, leaves = self.template_columns(chart)
        leaf_index = {self.guid(c): i for i, c in enumerate(leaves)}
        n_cols = len(leaves)

        out = ['<?xml version="1.0" encoding="utf-8"?>', '<document>']
        out.append('  <languages>')
        try:
            for ws in self.lp.CurrentVernacularWritingSystems:
                out.append('    <language lang=%s vernacular="true"/>' % quoteattr(ws.Id))
            for ws in self.lp.CurrentAnalysisWritingSystems:
                out.append('    <language lang=%s/>' % quoteattr(ws.Id))
        except Exception:
            pass
        out.append('  </languages>')
        out.append('  <chart guid=%s>' % quoteattr(self.guid(chart)))

        # Header rows: a leading row-number column, then the template groups/leaves, then Notes.
        out.append('    <row type="title1">')
        out.append('      <cell cols="1">#</cell>')
        for top, cols in groups:
            out.append('      <cell cols="%d" guid=%s>%s</cell>' % (len(cols), quoteattr(self.guid(top)), escape(self.best_analysis(top.Name))))
        out.append('      <cell cols="1">Notes</cell>')
        out.append('    </row>')
        out.append('    <row type="title2">')
        out.append('      <cell>Row</cell>')
        for leaf in leaves:
            out.append('      <cell guid=%s>%s</cell>' % (quoteattr(self.guid(leaf)), escape(self.best_analysis(leaf.Name))))
        out.append('      <cell>Notes</cell>')
        out.append('    </row>')

        for row in chart.RowsOS:
            attrs = ' type="%s"' % self.row_type(row)
            if getattr(row, 'EndSentence', False):
                attrs += ' endSent="true"'
            if getattr(row, 'EndParagraph', False):
                attrs += ' endPara="true"'
            attrs += ' guid=%s' % quoteattr(self.guid(row))
            out.append('    <row%s>' % attrs)

            # Bucket cell parts by leaf column.
            cells = [[] for _ in range(n_cols)]
            for part in row.CellsOS:
                col = part.ColumnRA
                idx = leaf_index.get(self.guid(col)) if col is not None else None
                if idx is None:
                    continue
                cells[idx].append(part)

            out.append('      <cell><main><rownum>%s</rownum></main></cell>' % escape(self.tss_text(row.Label)))
            for idx in range(n_cols):
                main, glosses = [], []
                for part in cells[idx]:
                    cls = part.ClassName
                    if cls == 'ConstChartWordGroup':
                        for seg, a in self.analyses_of(part):
                            form, gloss = self.analysis_form_and_gloss(a)
                            main.append('<word guid=%s>%s</word>' % (quoteattr(self.guid(a)), escape(form)))
                            glosses.append('<gloss>%s</gloss>' % escape(gloss))
                    elif cls == 'ConstChartTag':
                        tag = part.TagRA
                        label = self.best_analysis(tag.Abbreviation) or self.best_analysis(tag.Name) if tag is not None else ''
                        main.append('<listRef guid=%s>%s</listRef>' % (quoteattr(self.guid(part)), escape(label)))
                    elif cls == 'ConstChartClauseMarker':
                        labels = [self.tss_text(r.Label) for r in part.DependentClausesRS]
                        text = labels[0] if len(labels) == 1 else ('%s-%s' % (labels[0], labels[-1]) if labels else '')
                        main.append('<clauseMkr guid=%s>%s</clauseMkr>' % (quoteattr(self.guid(part)), escape(text)))
                    elif cls == 'ConstChartMovedTextMarker':
                        main.append('<lit guid=%s>%s</lit>' % (quoteattr(self.guid(part)), '&lt;&lt;' if part.Preposed else '&gt;&gt;'))
                if main:
                    out.append('      <cell><main>%s</main>%s</cell>' % (
                        ''.join(main),
                        ('<glosses>%s</glosses>' % ''.join(glosses)) if glosses else ''))
                else:
                    out.append('      <cell><main/></cell>')
            notes = self.tss_text(row.Notes)
            out.append('      <cell><main>%s</main></cell>' % ('<note>%s</note>' % escape(notes) if notes else ''))
            out.append('    </row>')

        out.append('  </chart>')
        out.append('</document>')
        return '\n'.join(out) + '\n'


# ----------------------------------------------------------------------------
# JSON-RPC server (one JSON object per line)
# ----------------------------------------------------------------------------

def serve(session, project_name=None):
    if project_name:
        session.open(project_name)

    def handle(method, params):
        params = params or {}
        if method == 'ping':
            return 'pong'
        if method == 'listProjects':
            return list(AllProjectNames())
        if method == 'openProject':
            return session.open(params['name'], bool(params.get('write', False)))
        if method == 'closeProject':
            session.close(); return True
        if method == 'listCharts':
            return session.charts()
        if method == 'linkedFiles':
            return session.linked_files()
        if method == 'ensureBackupDir':
            return session.ensure_backup_dir()
        if method == 'exportChart':
            return session.export_chart_xml(params['guid'])
        raise KeyError('unknown method: ' + method)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            result = handle(req.get('method'), req.get('params'))
            resp = {'jsonrpc': '2.0', 'id': req.get('id'), 'result': result}
        except Exception as e:  # noqa: BLE001 - report every failure to the caller
            resp = {'jsonrpc': '2.0', 'id': None, 'error': {'code': -32000, 'message': str(e)}}
            try:
                resp['id'] = json.loads(line).get('id')
            except Exception:
                pass
        sys.stdout.write(json.dumps(resp) + '\n')
        sys.stdout.flush()


def main(argv):
    if len(argv) < 2 or argv[1] in ('-h', '--help'):
        print(__doc__)
        return 0
    cmd = argv[1]
    if cmd == 'list-projects':
        if AllProjectNames is None:
            print('flexlibs is not installed', file=sys.stderr); return 2
        for name in AllProjectNames():
            print(name)
        return 0
    session = LcmSession()
    try:
        if cmd == 'list-charts':
            session.open(argv[2])
            for c in session.charts():
                print('%s  %s  (%s, %d rows)' % (c['guid'], c['textTitle'] or c['title'], c['templateName'], c['rowCount']))
        elif cmd == 'export':
            session.open(argv[2])
            xml = session.export_chart_xml(argv[3])
            if len(argv) > 4:
                with open(argv[4], 'w', encoding='utf-8') as f:
                    f.write(xml)
                print('wrote', argv[4])
            else:
                sys.stdout.write(xml)
        elif cmd == 'serve':
            serve(session, argv[2] if len(argv) > 2 else None)
        else:
            print('unknown command:', cmd, file=sys.stderr)
            return 2
    finally:
        session.shutdown()
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
