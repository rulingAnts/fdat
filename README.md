# FLEx XML Tools

Client‑side tools for exploring FieldWorks (FLEx) XML exports in a clean, readable format. Runs entirely in the browser (no server) and also ships as a Windows desktop app via Electron.

This project provides two specialized tools:

1. **FLEx XML Viewer** (`index.html`) - General-purpose viewer for Lists, Phonology, Wordforms, and Generic XML
2. **Discourse Analysis Tool** (`discourse.html`) - Specialized tool for viewing, transforming, and exporting Discourse Charts (Text Charts)

### Privacy at a glance

- All conversions happen locally in your browser. Your XML and language data never leave your device.
- No uploads, no analytics, no telemetry.
- Preferences (like language order or view options) are stored only in your browser’s LocalStorage.
  
This project is part of the Field Linguistics Extension Tools (FLET) project: [https://github.com/rulingAnts/flet](https://github.com/rulingAnts/flet)

- Web app: [https://rulingants.github.io/flexml_display](https://rulingants.github.io/flexml_display)
- Latest Windows release: [https://github.com/rulingAnts/flexml_display/releases/latest](https://github.com/rulingAnts/flexml_display/releases/latest)

## What they do

### FLEx XML Viewer

The general-purpose XML viewer handles:

- Lists — hierarchical `<list>` structures as collapsible trees
- Translated Lists — multilingual AUni-based lists with language ordering/visibility controls
- Phonology — natural classes, phoneme inventories, cross-references, and codes
- Wordforms — lexical items and analyses, with Card and Table views and filtering
- Generic XML — fallback recursive tree for any well‑formed XML

### Discourse Analysis Tool (FDAT)

The Discourse Analysis Tool is dedicated to Text Charts and provides:

- Display FLEx Text Charts (Discourse Charts) as HTML tables with resizable columns
- Preserve formatting and interlinear structure from FLEx exports
- Add custom prologues, epilogues, and HTML content before/after charts
- Configure abbreviations, salience bands, free translations, and notes display
- Control marker display order and visibility
- Export charts with all formatting and customizations

Not in scope for either tool: LIFT, FLExText (open those in FLEx), XLingPaper (open in XLingPaper), Word XML (open in Word).

## Try it online (no install)

### FLEx XML Viewer
1. Open the web app: [https://rulingants.github.io/flexml_display](https://rulingants.github.io/flexml_display)
2. Paste XML into the textbox or choose a .xml file.
3. Click Preview.
4. Optional: Toggle "Show element names", Save as HTML

### Discourse Analysis Tool
1. Open the tool: [https://rulingants.github.io/flexml_display/discourse.html](https://rulingants.github.io/flexml_display/discourse.html)
2. Paste Discourse Chart XML or choose a .xml file.
3. Click Preview.
4. Configure chart options (prologue, abbreviations, salience bands, etc.)
5. Export using "Export Discourse Chart" button

All processing is local in your browser; your files are not uploaded.

## Download for Windows

1. Go to the latest release: [https://github.com/rulingAnts/flexml_display/releases/latest](https://github.com/rulingAnts/flexml_display/releases/latest)
2. Download the installer (Setup) (.exe). You may also see a “portable” .exe.
3. Run the installer. If Windows SmartScreen warns (unsigned binary), choose “More info” → “Run anyway.”

The desktop app bundles the same viewer for offline use.

## Usage tips

### FLEx XML Viewer
- Lists and Translated Lists: click triangles to expand/collapse; reorder and show/hide languages.
- Phonology: click a phoneme "pill" to highlight it; click a table row to highlight related natural classes.
- Wordforms: use the Filter box; switch Card/Table view; choose which gloss languages appear in Table view.
- "Save as HTML" saves a static snapshot.

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
- Windows 10/11 x64
- Node.js (use nvm-windows to match project version)

Install and run (VS Code PowerShell)
```powershell
# Use the project’s Node version
nvm use 22.20.0

# Install dependencies (use npm.cmd if PowerShell blocks npm.ps1)
npm.cmd ci

# Start Electron
npm.cmd start
```

Build Windows installer locally
```powershell
# Optional: avoid symlink errors by enabling Developer Mode or using an elevated shell
# Win+R → ms-settings:developers → Developer Mode ON
# or run VS Code/PowerShell "As Administrator"

# Build
npm.cmd run dist:win
# Artifacts appear in dist\ (NSIS installer .exe, blockmap, .yml)
```

Troubleshooting (Windows PowerShell)
- “npm.ps1 is not digitally signed” → use npm.cmd:
  ```powershell
  npm.cmd install
  npm.cmd run dist:win
  ```
  Or set once:
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
  ```
- Symlink privilege error during electron-builder cache extraction:
  - Turn on Windows Developer Mode, or
  - Run an elevated PowerShell for the build, then:
    ```powershell
    Remove-Item "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign" -Recurse -Force -EA SilentlyContinue
    npm.cmd run dist:win
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
- Report bugs or request features: https://github.com/rulingAnts/flexml_display/issues
- Please avoid attaching real project data; share minimal sample XMLs that reproduce problems.

## Roadmap ideas

- Code signing for Windows builds
- Keyboard shortcuts and accessibility improvements
- Sample datasets and screenshots in docs/
- Export to CSV/Excel for selected views
- Additional FLEx export types if feasible
- Filtering, Sorting, Searching features
- Export to other formats (Word, Excel, LaTeX, PDF)
