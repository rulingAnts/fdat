# LCM sidecar (Phase 0 spike)

`fdat_lcm.py` reads FieldWorks discourse charts through [flexlibs](https://github.com/cdfarrow/flexlibs) and emits FDAT chart XML with FLEx GUIDs. See `../PLAN.md` for where this fits.

It has not been run yet: it was written without a FieldWorks installation. Expect to adjust LCM property names on first contact with a real project.

## Setup (Windows)

1. Install FieldWorks (the version your projects use).
2. Install Python 3 (64-bit, matching FieldWorks' bitness) and:
   ```
   pip install -r requirements.txt
   ```
   The same environment FLExTools uses works.

## Try it

```
python fdat_lcm.py list-projects
python fdat_lcm.py list-charts "My Project"
python fdat_lcm.py export "My Project" <chart-guid> chart.xml
```

Then open the web app (`npm run dev:web` in the repo root) and load `chart.xml`. Compare with FLEx's own **Export Text Chart** for the same chart; the two should render the same, and the sidecar's output additionally carries `guid` attributes on rows, cells and tokens.

JSON-RPC mode, as the desktop shell drives it:

```
echo {"jsonrpc":"2.0","id":1,"method":"listCharts"} | python fdat_lcm.py serve "My Project"
```
