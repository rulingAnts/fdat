# FDAT Desktop (FLEx-integrated) — temporary home

This folder holds the plan and starter code for a Windows desktop version of FDAT that reads discourse charts directly from FieldWorks (LCM) instead of exported XML. It is meant to move to its own repository (`fdat-desktop`); nothing in the web app depends on it.

- [PLAN.md](./PLAN.md) — architecture, FLEx data mapping, storing all FDAT data inside the FLEx project so Send/Receive syncs it, phases, risks, repository plan, and notes on hosting the web app on Cloudflare Pages.
- [sidecar/](./sidecar/) — Python + flexlibs spike that lists charts and exports one as FDAT XML with FLEx GUIDs (`python fdat_lcm.py --help`). Not yet run against a real project.
- [shell/](./shell/) — Electron starter: serves the bundled renderer from `app://`, supervises the sidecar, exposes `window.fdatHost`, and injects an "Open from FLEx" bar. To try it once the sidecar works: `cd desktop/shell && npm install && npm start` (set `FDAT_SIDECAR_PYTHON` to the Python that has flexlibs).

The web app already exposes the two hooks the shell uses (`window.FDAT.loadXmlText` and `previewCurrentXml`) and its XSL passes `guid` attributes through to the DOM (`data-row-guid`, `data-cell-guid`, `data-guid`).
