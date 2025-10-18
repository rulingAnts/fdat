#!/usr/bin/env node
/*
  dev-android-pwa.js

  One-command PWA test on Android Emulator:
  - Checks Android SDK tools (emulator, adb) availability
  - Lists AVDs; lets you select (remembers last choice)
  - Starts local dev server (docs/) without opening host browser
  - Boots the selected emulator, waits for boot completion
  - Runs `adb reverse tcp:<PORT> tcp:<PORT>` so emulator can use http://localhost:<PORT>
  - Opens Chrome in emulator to http://localhost:<PORT>/

  Usage:
    node .local/dev-android-pwa.js [--port=5173] [--avd=NAME] [--no-remember]

  Environment:
    PORT         Override port (default 5173)
    NO_REMEMBER  Do not save last AVD choice when set (any value)

  Notes:
  - Requires Android SDK with emulator and platform-tools installed
  - Requires at least one AVD created (via Android Studio or avdmanager)
  - Works on macOS/Linux/Windows (paths auto-resolved or from PATH)
*/

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const readline = require('readline');

const DEFAULT_PORT = Number(process.env.PORT || 5173);
const ARGS = parseArgs(process.argv.slice(2));
const PORT = Number(ARGS.port || DEFAULT_PORT);
const REMEMBER = !('NO_REMEMBER' in process.env) && !ARGS['no-remember'];
const AVD_PREF_PATH = path.resolve(__dirname, '.android-avd.json');

main().catch(err => {
  console.error('\nError:', err.message || err);
  process.exit(1);
});

async function main() {
  banner();
  const tools = resolveAndroidTools();
  if (!tools) {
    console.error('\nAndroid SDK tools not found.\nInstall Android Studio (or SDK command-line tools) and ensure the emulator and platform-tools are installed.');
    printSdkHelp();
    process.exit(2);
  }

  const { emulatorBin, adbBin } = tools;

  // Ensure AVDs exist
  const avds = listAvds(emulatorBin);
  if (!avds.length) {
    console.error('\nNo Android Virtual Devices found. Create one in Android Studio (AVD Manager) and try again.');
    process.exit(3);
  }

  const defaultAvd = getLastAvd();
  const chosenAvd = await chooseAvd(avds, { defaultAvd, cliAvd: ARGS.avd });
  if (REMEMBER) setLastAvd(chosenAvd);

  // Ask if this is a first run (install flow) before launching the AVD
  const isFirstRun = await shouldFirstRunPrompt();

  // Start dev server
  const devServer = startDevServer(PORT);

  // Track devices before starting emulator
  const preDevices = listAdbDevices(adbBin);

  // Start emulator
  const emu = startEmulator(emulatorBin, chosenAvd);

  // Find new emulator serial
  const serial = await waitForNewEmulator(adbBin, preDevices, 180000);
  console.log(`Emulator device detected: ${serial}`);

  // Wait for boot completion
  await waitForBoot(adbBin, serial, 180000);
  console.log('Emulator boot completed.');

  // Setup adb reverse
  await adbReverse(adbBin, serial, PORT);
  console.log(`adb reverse tcp:${PORT} -> tcp:${PORT} set on ${serial}`);

  const baseUrl = `http://localhost:${PORT}/`;
  // Single-decision behavior: if first run, open Chrome for install; otherwise do nothing
  if (isFirstRun) {
    await openChrome(adbBin, serial, baseUrl);
    console.log('Opened Chrome for first-run install (use the Install prompt to add to Home screen).');
  } else {
    console.log('First run = No. Not opening Chrome. Find and open the installed app on the emulator.');
  }

  // Handle cleanup
  setupCleanup({ devServer, adbBin, serial, port: PORT, emulatorProc: emu });

  // Keep running until user stops (Ctrl+C)
}

function banner() {
  console.log('Android Emulator PWA Test');
  console.log('---------------------------');
}

function parseArgs(argv) {
  const args = {};
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.replace(/^--/, '').split('=');
      args[k] = v === undefined ? true : v;
    }
  }
  return args;
}

function resolveAndroidTools() {
  const candidates = [];
  const home = os.homedir();
  const sdkRoot = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
  if (sdkRoot) candidates.push(sdkRoot);
  if (process.platform === 'darwin') {
    candidates.push(path.join(home, 'Library', 'Android', 'sdk'));
  } else {
    candidates.push(path.join(home, 'Android', 'Sdk'));
  }

  let emulatorBin, adbBin;

  for (const root of candidates) {
    const emu = path.join(root, 'emulator', process.platform === 'win32' ? 'emulator.exe' : 'emulator');
    const adb = path.join(root, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
    if (fs.existsSync(emu) && fs.existsSync(adb)) {
      emulatorBin = emu; adbBin = adb; break;
    }
  }

  // Fallback to PATH
  if (!emulatorBin) emulatorBin = which(process.platform === 'win32' ? 'emulator.exe' : 'emulator');
  if (!adbBin) adbBin = which(process.platform === 'win32' ? 'adb.exe' : 'adb');

  if (!emulatorBin || !adbBin) return null;
  return { emulatorBin, adbBin };
}

function which(cmd) {
  const res = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' });
  if (res.status === 0 && res.stdout) {
    const line = res.stdout.split(/\r?\n/).find(Boolean);
    return line && line.trim();
  }
  return null;
}

function listAvds(emulatorBin) {
  const res = spawnSync(emulatorBin, ['-list-avds'], { encoding: 'utf8' });
  if (res.status !== 0) return [];
  return res.stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

function getLastAvd() {
  try {
    const raw = fs.readFileSync(AVD_PREF_PATH, 'utf8');
    const j = JSON.parse(raw);
    return j.lastAvd || null;
  } catch {
    return null;
  }
}

function setLastAvd(name) {
  try {
    fs.writeFileSync(AVD_PREF_PATH, JSON.stringify({ lastAvd: name }, null, 2));
  } catch {}
}

async function chooseAvd(avds, { defaultAvd, cliAvd }) {
  if (cliAvd && avds.includes(cliAvd)) return cliAvd;

  const list = [...avds];
  // If defaultAvd exists, reorder to front
  if (defaultAvd && list.includes(defaultAvd)) {
    const idx = list.indexOf(defaultAvd);
    list.splice(idx, 1);
    list.unshift(defaultAvd);
  }

  console.log('\nAvailable Android Virtual Devices:');
  list.forEach((n, i) => console.log(`  [${i + 1}] ${n}${n === defaultAvd ? ' (default)' : ''}`));
  const defIdx = 0;
  const answer = await prompt(`Select AVD [1-${list.length}] (default ${defIdx + 1}): `);
  let sel = parseInt(answer, 10);
  if (!sel || sel < 1 || sel > list.length) sel = defIdx + 1;
  const chosen = list[sel - 1];
  console.log('Chosen AVD:', chosen);
  return chosen;
}

function prompt(q) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, ans => { rl.close(); resolve(ans); });
  });
}

function startDevServer(port) {
  console.log(`\nStarting local dev server on http://localhost:${port} ...`);
  const env = { ...process.env, PORT: String(port), NO_OPEN: '1' };
  const child = spawn(process.execPath, [path.resolve(__dirname, 'dev-server.js')], {
    env,
    stdio: ['ignore', 'inherit', 'inherit']
  });
  child.on('exit', code => console.log(`Dev server exited with code ${code}`));
  return child;
}

function startEmulator(emulatorBin, avd) {
  console.log(`\nStarting emulator: ${avd} (this may take a while)...`);
  const args = ['-avd', avd, '-netdelay', 'none', '-netspeed', 'full', '-no-boot-anim'];
  const child = spawn(emulatorBin, args, { stdio: 'inherit' });
  child.on('exit', code => console.log(`Emulator process exited with code ${code}`));
  return child;
}

function listAdbDevices(adbBin) {
  const res = spawnSync(adbBin, ['devices'], { encoding: 'utf8' });
  if (res.status !== 0) return [];
  const lines = res.stdout.split(/\r?\n/).slice(1); // skip header
  const serials = [];
  for (const l of lines) {
    const [serial, state] = l.trim().split(/\s+/);
    if (!serial) continue;
    serials.push({ serial, state });
  }
  return serials;
}

async function waitForNewEmulator(adbBin, beforeList, timeoutMs) {
  const beforeSerials = new Set(beforeList.map(d => d.serial));
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const list = listAdbDevices(adbBin);
    const emulators = list.filter(d => d.serial.startsWith('emulator-'));
    // Prefer devices that are new
    const newOnes = emulators.filter(d => !beforeSerials.has(d.serial));
    const candidate = (newOnes.find(d => d.state === 'device') || newOnes[0] || emulators.find(d => d.state === 'device') || emulators[0]);
    if (candidate) {
      // Ensure it's connected
      spawnSync(adbBin, ['-s', candidate.serial, 'wait-for-device']);
      return candidate.serial;
    }
    await delay(2000);
  }
  throw new Error('Timed out waiting for emulator device to appear.');
}

async function waitForBoot(adbBin, serial, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r1 = spawnSync(adbBin, ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'], { encoding: 'utf8' });
    const r2 = spawnSync(adbBin, ['-s', serial, 'shell', 'getprop', 'dev.bootcomplete'], { encoding: 'utf8' });
    const b1 = (r1.stdout || '').trim() === '1';
    const b2 = (r2.stdout || '').trim() === '1';
    if (b1 || b2) return;
    await delay(2000);
  }
  throw new Error('Timed out waiting for emulator to complete boot.');
}

async function adbReverse(adbBin, serial, port) {
  // reverse may fail if already set; try remove then set
  spawnSync(adbBin, ['-s', serial, 'reverse', `--remove`, `tcp:${port}`]);
  const res = spawnSync(adbBin, ['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`], { encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(`adb reverse failed: ${res.stderr || res.stdout || res.status}`);
  }
}

async function openChrome(adbBin, serial, url) {
  // Try Chrome, then default VIEW, then AOSP Browser
  const tryCmds = [
    ['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url, 'com.android.chrome'],
    ['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url],
    ['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url, 'com.android.browser']
  ];
  for (const args of tryCmds) {
    const r = spawnSync(adbBin, ['-s', serial, ...args], { encoding: 'utf8' });
    if (r.status === 0) return;
  }
  console.warn('Could not programmatically open Chrome. Open the URL manually in the emulator.');
}

function findInstalledWebApkForUrl(adbBin, serial, baseUrl) {
  try {
    const pkgs = listPackagesByPrefix(adbBin, serial, ['org.chromium.webapk', 'com.google.android.webapk']);
    for (const pkg of pkgs) {
      const meta = getWebApkMeta(adbBin, serial, pkg);
      if (!meta) continue;
      const { startUrl, manifestUrl } = meta;
      if ((startUrl && startUrl.startsWith(baseUrl)) || (manifestUrl && manifestUrl.startsWith(baseUrl))) {
        return pkg;
      }
    }
  } catch {}
  return null;
}

function listPackagesByPrefix(adbBin, serial, prefixes) {
  const res = spawnSync(adbBin, ['-s', serial, 'shell', 'pm', 'list', 'packages'], { encoding: 'utf8' });
  if (res.status !== 0) return [];
  const lines = (res.stdout || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const pkgs = [];
  for (const l of lines) {
    const m = l.match(/^package:([^\s]+)$/);
    if (!m) continue;
    const name = m[1];
    if (prefixes.some(p => name.startsWith(p))) pkgs.push(name);
  }
  return pkgs;
}

function getWebApkMeta(adbBin, serial, pkg) {
  const res = spawnSync(adbBin, ['-s', serial, 'shell', 'dumpsys', 'package', pkg], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  if (res.status !== 0) return null;
  const out = res.stdout || '';
  // Look for meta-data lines; keys are typically like:
  //   org.chromium.webapk.shell_apk.h2.startUrl
  //   org.chromium.webapk.shell_apk.h2.manifestUrl
  const startUrl = matchMeta(out, /org\.chromium\.webapk\.shell_apk\.h2\.startUrl.*?=\s*(\S+)/i);
  const manifestUrl = matchMeta(out, /org\.chromium\.webapk\.shell_apk\.h2\.manifestUrl.*?=\s*(\S+)/i);
  if (!startUrl && !manifestUrl) return null;
  return { startUrl, manifestUrl };
}

function matchMeta(text, regex) {
  const m = text.match(regex);
  if (!m) return null;
  // Values may be quoted or unquoted
  return m[1].replace(/^"|"$/g, '');
}

function launchPackage(adbBin, serial, pkg) {
  // Use monkey to launch the main LAUNCHER activity of the package
  const r = spawnSync(adbBin, ['-s', serial, 'shell', 'monkey', '-p', pkg, '-c', 'android.intent.category.LAUNCHER', '1'], { encoding: 'utf8' });
  return r.status === 0;
}

function setupCleanup({ devServer, adbBin, serial, port, emulatorProc }) {
  const cleanup = () => {
    console.log('\nCleaning up...');
    if (serial) {
      try { spawnSync(adbBin, ['-s', serial, 'reverse', '--remove', `tcp:${port}`]); } catch {}
    }
    if (devServer && devServer.pid) {
      try { process.kill(devServer.pid); } catch {}
    }
    // We intentionally do not kill the emulator; let the user close it.
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  // Auto-terminate this script when the Emulator process exits
  if (emulatorProc && typeof emulatorProc.once === 'function') {
    emulatorProc.once('exit', (code) => {
      console.log(`Emulator process exited with code ${code}`);
      cleanup();
    });
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function printSdkHelp() {
  console.log('\nPrerequisites:');
  console.log('  - Install Android Studio: https://developer.android.com/studio');
  console.log('  - Ensure SDK components installed: "Android SDK Platform-Tools" and "Android Emulator"');
  console.log('  - Create an AVD in Android Studio (Tools → Device Manager)');
  console.log('  - Command-line tools path (macOS default): ~/Library/Android/sdk');
}

async function shouldFirstRunPrompt(){
  // CLI override
  if (ARGS['first-run'] === 'true' || ARGS['first-run'] === true) return true;
  if (ARGS['first-run'] === 'false' || ARGS['no-first-run'] === '' || ARGS['no-first-run'] === true) return false;
  // Interactive prompt (default No = not first run). If Yes, Chrome will open to http://localhost:<PORT>/ so you can Install to Home screen.
  const ans = await prompt(`First run on this emulator? This will open Chrome to http://localhost:${PORT}/ so you can tap Install and add it to the Home screen. [y/N]: `);
  return /^y(es)?$/i.test((ans||'').trim());
}
