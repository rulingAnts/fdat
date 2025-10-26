# NPM scripts quick reference

A concise guide to the available `npm run` scripts, what they do, and when to use them.

Tip: On macOS with zsh, you can run any of these with `npm run <script>` (or `npm start`).

## Day-to-day development

- dev:web
  - What: Starts the local PWA/static web server for `docs/` with dev-friendly headers.
  - Use when: You want to view `docs/index.html` in a browser at localhost.
  - Notes: Accepts extra flags after `--`, e.g. `npm run dev:web -- --no-open`.

- start
  - What: Launches the Electron shell (desktop app) pointing at the default target (auto-detected by the app).
  - Use when: You just want to run the desktop app with current defaults.

- shell:web
  - What: Launches the Electron shell in “web/prod” mode.
  - Use when: You want the app to load the in-repo web assets (not a dev server).

- shell:web:reset
  - What: Same as `shell:web` but clears app storage/service worker/cache first.
  - Use when: You need a clean slate without uninstalling/reinstalling.

- shell:reset-all
  - What: Launches Electron shell and clears all persisted app storage (broader reset).
  - Use when: You want to aggressively reset storage (service workers, caches, local storage).

## Electron shell + dev server

- shell:dev
  - What: Runs `.local/shell-dev-auto.js` to bring up the Electron shell against a local dev server (auto-handles server availability).
  - Use when: You want a one-command flow to run the shell against the dev web server.

- shell:dev:reset
  - What: Same as `shell:dev` but clears app storage first.
  - Use when: You also need to reset storage before starting.

- shell:dev:no-server
  - What: Launches Electron with `FDAT_SHELL_URL=http://localhost:5173` (expects an already running dev server).
  - Use when: You started the dev web server separately and just want to attach the shell.

- shell:dev:no-server:reset
  - What: Same as above, but clears app storage first.
  - Use when: You want a clean slate and you’re managing the server yourself.

- shell:dev:unreachable
  - What: Launches the shell pointed at `http://localhost:5999` to exercise the unreachable/error path.
  - Use when: Testing error handling and fallback UI when the server isn’t available.

## Packaging / distribution

- pack
  - What: Build unpacked app (folder output) via `electron-builder --dir` for the current OS.
  - Use when: You want a quick, unpacked build to inspect contents.

- dist
  - What: Build installer(s) for the current OS via `electron-builder`.
  - Use when: You want an installable build for your platform.

- dist:win
  - What: Windows NSIS installer via `electron-builder --win nsis`.
  - Use when: Building a Windows installer.

- dist:win:portable
  - What: Windows portable build via `electron-builder --win portable`.
  - Use when: Building a Windows portable binary without an installer.

- dist:win:all
  - What: Windows NSIS + portable via `electron-builder --win nsis portable`.
  - Use when: You want both Windows formats at once.

- dist:mac
  - What: macOS DMG via `electron-builder --mac dmg`.
  - Use when: Building a macOS installer.

- dist:all
  - What: All platforms (macOS, Windows, Linux) via `electron-builder -mwl`.
  - Use when: CI or cross-platform builds (requires host toolchains/signing where applicable).

- shell:pack / shell:dist
  - What: Aliases to `electron-builder --dir` and `electron-builder -mwl` respectively (legacy naming).
  - Use when: Prefer `pack` / `dist` for primary usage; these remain available for continuity.

## Utilities

- pwa:icons
  - What: Generates PWA icons (`scripts/gen-pwa-icons.mjs`).
  - Use when: You update the app icon and need fresh sizes for the PWA/manifest.

- dev:android_pwa
  - What: Helper for Android PWA dev flows (emulator/device), via `.local/dev-android-pwa.js`.
  - Use when: Testing the PWA on Android.

## Common scenarios

- “Just run the desktop app (prod assets)”: `npm run shell:web`
- “Start the web server locally (browser)”: `npm run dev:web`
- “Run shell + auto dev server”: `npm run shell:dev`
- “Run shell against my already-running dev server”: `npm run shell:dev:no-server`
- “Reset then run shell (prod)”: `npm run shell:web:reset`
- “Build an installer for my OS”: `npm run dist`
- “Build all platforms (CI)”: `npm run dist:all`

## Reset behaviors (reference)

- :reset variants clear local storage, indexedDB, service worker, and cache for the app origin before launching.
- `shell:reset-all` performs a broader reset suitable when caches or SW states look stuck.
