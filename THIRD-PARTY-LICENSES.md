# Third‑Party Notices

This application is licensed under the GNU Affero General Public License v3.0 (AGPL‑3.0).

The desktop builds redistribute the following third‑party component at runtime. It is used under its respective license; see the upstream link for the full license text.

- Electron — MIT License — https://www.electronjs.org/ (source: https://github.com/electron/electron)

Build‑time tools (electron‑builder, sharp, Playwright) are development dependencies and are not shipped in the binaries.

Distribution notes
- Include this file with distributed binaries (installers, portable, AppImage, DMG/ZIP, NSIS).
- The upstream projects above provide complete license texts in their repositories. If required by your distribution policies, bundle those license files as well.

No vendor JS bundles
- The app does not currently bundle third‑party JavaScript libraries in `docs/`. 