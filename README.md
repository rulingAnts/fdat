# Flex DiscourseChart Analysis Tool (FDAT)

FDAT is a specialized, client‑side tool for viewing, transforming, styling, and exporting FLEx Text Charts (Discourse Charts). It runs entirely in your browser (no server) and also ships as a desktop app via Electron.

### Privacy at a glance

- All conversions happen locally in your browser. Your XML and language data never leave your device.
- No uploads, no analytics, no telemetry.
- Preferences (like language order or view options) are stored only in your browser’s LocalStorage.
  
This project is part of the Field Linguistics Extension Tools (FLET) project: [https://github.com/rulingAnts/flet](https://github.com/rulingAnts/flet)

- Web app: [https://rulingants.github.io/fdat](https://rulingants.github.io/fdat)
- Latest Windows release: [https://github.com/rulingAnts/fdat/releases/latest](https://github.com/rulingAnts/fdat/releases/latest)

## What it does

FDAT is dedicated to Discourse/Text Charts and provides:

- Display FLEx Text Charts (Discourse Charts) as HTML tables with resizable columns
- Preserve formatting and interlinear structure from FLEx exports
- Add custom prologues, epilogues, and HTML content before/after charts
- Configure abbreviations, salience bands, free translations, and notes display
- Control marker display order and visibility
- Export charts with all formatting and customizations

For Lists, Phonology, Wordforms, or generic FLEx XML, use the companion viewer: https://rulingants.github.io/flexml_display (repo: https://github.com/rulingAnts/flexml_display).

## Try it online (no install)

1. Open the web app: [https://rulingants.github.io/fdat](https://rulingants.github.io/fdat)
2. Paste a Discourse Chart XML or choose a .xml file.
3. Click Preview.
4. Configure chart options (prologue, abbreviations, salience bands, notes, etc.)
5. Export using "Export Discourse Chart" (opens a printable/exportable window)

All processing is local in your browser; your files are not uploaded.

### Offline and Installable (PWA)

FDAT is a Progressive Web App (PWA):

- Works offline after first load (caches core files on your device).
- Auto-updates: when a new version is published, you’ll be prompted to reload.
- Install on tablets:
  - Android tablets (Chrome/Edge): tap the “Install App” button when shown, or use the browser menu → Install.
  - iPad (Safari): use Share → Add to Home Screen (Apple doesn’t show a native install prompt).

When launched from the home screen, FDAT opens in standalone mode (minimal browser UI, no address bar), similar to a native app.

## Download for Windows, Mac, or Linux

1. Go to the latest release: [https://github.com/rulingAnts/fdat/releases/latest](https://github.com/rulingAnts/fdat/releases/latest)
2. Download the installer (Setup) (.exe). You may also see a “portable” .exe.
3. Run the installer. If Windows SmartScreen warns (unsigned binary), choose “More info” → “Run anyway.”

The desktop app bundles the same viewer for offline use.

## Usage tips

### Discourse Analysis Tool
- Resize columns: click and drag column borders in the second header row
- Configure display: use the collapsible panels to customize prologue, abbreviations, salience bands, free translations, and notes
- **Hierarchical Settings**: Organize your settings by Language → Genre → Document
  - **Language Projects**: Add multiple languages with names and ethnologue codes. Language-level settings include abbreviations and marker display preferences that apply across all texts in that language.
  - **Text Genres**: Within each language, create genres (e.g., "Narrative", "Procedural"). Genre-level settings include salience band definitions.
  - **Documents**: Within each genre, manage individual documents. Document-level settings include prologues, epilogues, free translations, and row-specific assignments.
  - Import/Export at each level: Export a language's settings to reuse across projects, or export a genre to apply to different languages.
- Export: use "Export Discourse Chart" to open in a new window with export toolbar
- "Save as HTML" embeds current styles and formatting for a complete snapshot

Note: "Save as HTML" embeds the current page's styles from the <head> (including any injected at runtime), so borders, interlinear alignment, and other formatting match what you see. The exported HTML is a static snapshot — interactive features like column resizing are not included.

## Privacy

- 100% client‑side. Files never leave your machine.
- Preferences (e.g., language ordering, wordform view mode) are stored locally in your browser’s LocalStorage.

## Developer setup

Requirements
- Node.js 18–24
- macOS/Windows/Linux

Install and run
```bash
npm install
npm start
```

Local web dev server (PWA)

```bash
# Serve the web app from docs/ at http://localhost:5173 and auto-open your browser
npm run dev:web

# Disable auto-open for this run
npm run dev:web -- --no-open

# Change the port
PORT=8080 npm run dev:web
```

Notes
- The dev server serves the PWA from `docs/` and sets headers to avoid caching XML/XSL while developing.
- It will try to open your default browser automatically; set `NO_OPEN=1` or pass `--no-open` to skip.
- Service Worker/PWA features work on localhost, but not from file:// URLs.

Build installers
```bash
# Windows (NSIS + Portable)
npm run dist:win

# macOS (DMG)
npm run dist:mac

# All platforms (where supported)
npm run dist:all
```

## Continuous delivery (optional)

- GitHub Pages (docs/): updates on push to main (via .github/workflows/pages.yml).
- GitHub Releases: tag vX.Y.Z to build and upload Windows installers as Release assets (via .github/workflows/release.yml).

## License and attribution

- License: AGPL-3.0 — see https://www.gnu.org/licenses/agpl-3.0.html
- Copyright © 2025 Seth Johnston
- Portions of this code were generated collaboratively with ChatGPT (GPT-5) by OpenAI, under the author’s direction and guidance.

## Contributing

Issues and pull requests are welcome:
- Report bugs or request features: https://github.com/rulingAnts/fdat/issues
- Please avoid attaching real project data; share minimal sample XMLs that reproduce problems.

## Roadmap ideas

- Code signing for Windows builds
- Keyboard shortcuts and accessibility improvements
- Sample datasets and screenshots in docs/
- Export to CSV/Excel for selected views
- Additional FLEx export types if feasible
- Filtering, Sorting, Searching features
- Export to other formats (Word, Excel, LaTeX, PDF)
