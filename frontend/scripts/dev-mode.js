/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Dev mode coordinator — builds libraries in dependency order, watches for changes,
 * and rebuilds in the correct order with per-library locks and a centralized queue.
 *
 * Key improvements over the previous approach:
 * - Single process coordinates all rebuilds (no race conditions between separate rebuild-lib.js processes)
 * - Dependency graph parsed at runtime from package.json build scripts
 * - Per-library lock files (.rebuilding-<lib>.lock) prevent concurrent builds of the same library
 * - Dependency-aware queue: a library only builds after all its dependencies finish
 * - Debouncing: rapid file changes are coalesced into a single rebuild
 * - Cascade: when a library finishes rebuilding, dependents that need rebuilding are queued
 */

const {spawn} = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const {getLibDependencyGraph} = require('./lib-dependency-graph');

// ── Configuration ──────────────────────────────────────────────────────────────

const FRONTEND_ROOT = path.resolve(__dirname, '..');
const LOCK_DIR = FRONTEND_ROOT;
const NG_BIN = path.join(FRONTEND_ROOT, 'node_modules', '.bin', 'ng');
const PORT_TO_CHECK = 4200;
const DEBOUNCE_MS = 600;
const MAX_PARALLEL_BUILDS = 3;

const skipInitialBuild = process.env.SKIP_BUILD === 'true';

// ── Dependency graph ───────────────────────────────────────────────────────────

const graph = getLibDependencyGraph();
const {libLevels, levels, sortedLevelNumbers, levelBuildModes, dependsOn, dependents, allLibs} =
  graph;

console.log(
  `\n📦 Loaded dependency graph: ${allLibs.length} libraries across ${sortedLevelNumbers.length} levels\n`
);
for (const levelNum of sortedLevelNumbers) {
  const libs = levels.get(levelNum);
  const mode = levelBuildModes.get(levelNum);
  console.log(`  Level ${levelNum} (${mode}): ${libs.join(', ')}`);
}
console.log('');

// ── State ──────────────────────────────────────────────────────────────────────

const activeProcesses = [];
let hasStartedApp = false;
let isCleaningUp = false;

// Build queue state
const building = new Set(); // libs currently building
const queued = new Map(); // lib -> {resolve, reject} or just a boolean; libs waiting to build
const debounceTimers = new Map(); // lib -> timer
const pendingRebuilds = new Set(); // libs that need a rebuild (debounced, waiting to enter queue)
const swappedLibs = new Set(); // libs whose dist was swapped since the last webpack notification

// ── Lock file helpers ──────────────────────────────────────────────────────────

function lockFilePath(libName) {
  return path.join(LOCK_DIR, `.rebuilding-${libName}.lock`);
}

function createLock(libName) {
  try {
    fs.writeFileSync(lockFilePath(libName), `building:${Date.now()}`);
  } catch (err) {
    console.error(`  ⚠ Failed to create lock for ${libName}: ${err.message}`);
  }
}

function removeLock(libName) {
  try {
    if (fs.existsSync(lockFilePath(libName))) {
      fs.rmSync(lockFilePath(libName));
    }
  } catch (err) {
    // Ignore — may already be removed
  }
}

function removeAllLocks() {
  for (const lib of allLibs) {
    removeLock(lib);
  }
}

// ── Port check ─────────────────────────────────────────────────────────────────

function checkPortInUse(port) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

// ── Build a single library ─────────────────────────────────────────────────────

/**
 * Build a library. When `safeSwap` is true (used during watcher rebuilds), the build
 * writes to a temporary directory and then atomically swaps it into the real dist folder.
 * This prevents the dev server from seeing a deleted dist directory mid-build and
 * triggers only a single recompilation instead of multiple.
 */
function buildLib(libName, {safeSwap = false} = {}) {
  const fullName = `@valtimo/${libName}`;
  const realDest = path.join(FRONTEND_ROOT, 'dist', 'valtimo', libName);
  const tmpDest = path.join(FRONTEND_ROOT, 'dist', `.tmp-${libName}`);
  const ngPackagePath = path.join(FRONTEND_ROOT, 'projects', 'valtimo', libName, 'ng-package.json');

  return new Promise((resolve, reject) => {
    console.log(`  🔨 Building ${fullName}...`);
    createLock(libName);

    let originalNgPackage = null;

    // If safeSwap, redirect the build output to a temp directory by patching the
    // "dest" field in ng-package.json. Uses string replacement to preserve the
    // original file format (trailing commas, comments, etc.).
    if (safeSwap) {
      try {
        originalNgPackage = fs.readFileSync(ngPackagePath, 'utf8');
        const relativeTmpDest = path.relative(path.dirname(ngPackagePath), tmpDest);
        const patched = originalNgPackage.replace(
          /("dest"\s*:\s*)"[^"]*"/,
          `$1"${relativeTmpDest}"`
        );
        if (patched === originalNgPackage) {
          throw new Error('Could not find "dest" field in ng-package.json');
        }
        fs.writeFileSync(ngPackagePath, patched);
      } catch (err) {
        console.error(`  ⚠ Failed to set up temp dest for ${libName}: ${err.message}`);
        // Fall back to normal build
        safeSwap = false;
        originalNgPackage = null;
      }
    }

    const buildProc = spawn(NG_BIN, ['build', fullName], {
      shell: true,
      cwd: FRONTEND_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    buildProc.stdout.on('data', data => {
      stdout += data.toString();
    });

    buildProc.stderr.on('data', data => {
      stderr += data.toString();
    });

    function restoreNgPackage() {
      if (originalNgPackage !== null) {
        try {
          fs.writeFileSync(ngPackagePath, originalNgPackage);
        } catch (err) {
          console.error(`  ⚠ Failed to restore ng-package.json for ${libName}: ${err.message}`);
        }
      }
    }

    function swapDist() {
      if (!safeSwap) return;
      try {
        // Atomic swap: rename real dist out, rename temp dist in, remove old.
        // This avoids the window where dist is deleted (which crashes webpack).
        const backupDest = `${realDest}.old`;
        if (fs.existsSync(realDest)) {
          fs.renameSync(realDest, backupDest);
        }
        fs.renameSync(tmpDest, realDest);
        // Clean up old dist
        if (fs.existsSync(backupDest)) {
          fs.rmSync(backupDest, {recursive: true, force: true});
        }
        // Track this lib for a batched webpack notification later.
        // We don't touch files here — instead we wait until the entire queue drains
        // so webpack gets a single recompilation trigger rather than one per library.
        swappedLibs.add(libName);
      } catch (err) {
        console.error(`  ⚠ Failed to swap dist for ${libName}: ${err.message}`);
        // Fallback: try to restore the old dist if the swap failed halfway
        const backupDest = `${realDest}.old`;
        try {
          if (!fs.existsSync(realDest) && fs.existsSync(backupDest)) {
            fs.renameSync(backupDest, realDest);
          }
        } catch {
          /* best effort */
        }
      }
    }

    buildProc.on('error', err => {
      restoreNgPackage();
      removeLock(libName);
      reject(err);
    });

    buildProc.on('exit', code => {
      restoreNgPackage();
      if (code === 0 || stdout.includes('Built Angular Package')) {
        swapDist();
        removeLock(libName);
        console.log(`  ✅ Built ${fullName}`);
        resolve();
      } else {
        // Clean up temp on failure
        if (safeSwap) {
          try {
            fs.rmSync(tmpDest, {recursive: true, force: true});
          } catch {
            // ignore
          }
        }
        removeLock(libName);
        console.error(`  ❌ Build failed for ${fullName} (exit code ${code})`);
        if (stderr) {
          const lines = stderr.split('\n');
          const tail = lines.slice(-30).join('\n');
          console.error(tail);
        }
        reject(new Error(`Build failed for ${fullName}`));
      }
    });
  });
}

// ── Initial build: all libs in dependency order ────────────────────────────────

/**
 * Build a set of libraries in parallel, respecting any intra-set dependency edges.
 * Libraries with no intra-set dependencies start immediately; others wait until
 * their dependencies within the set have completed.
 */
function buildParallelWithDeps(libs) {
  return new Promise((resolveAll, rejectAll) => {
    const libSet = new Set(libs);
    const done = new Set();
    const inFlight = new Set();
    const failures = [];

    function tryStart() {
      if (done.size + failures.length === libs.length) {
        if (failures.length > 0) {
          rejectAll(failures);
        } else {
          resolveAll();
        }
        return;
      }

      for (const lib of libs) {
        if (done.has(lib) || inFlight.has(lib) || failures.some(f => f.lib === lib)) continue;

        // Check if all intra-set dependencies are done
        const deps = dependsOn.get(lib);
        let ready = true;
        if (deps) {
          for (const dep of deps) {
            if (libSet.has(dep) && !done.has(dep)) {
              ready = false;
              break;
            }
          }
        }

        if (!ready) continue;

        inFlight.add(lib);
        buildLib(lib)
          .then(() => {
            inFlight.delete(lib);
            done.add(lib);
            tryStart();
          })
          .catch(err => {
            inFlight.delete(lib);
            failures.push({lib, error: err});
            tryStart();
          });
      }
    }

    tryStart();
  });
}

async function initialBuildAll() {
  if (skipInitialBuild) {
    console.log('⏭  Skipping initial library builds (SKIP_BUILD=true)\n');
    return;
  }

  console.log('🏗  Building all libraries in dependency order...\n');

  for (const levelNum of sortedLevelNumbers) {
    const libs = levels.get(levelNum);
    const mode = levelBuildModes.get(levelNum);
    console.log(`\n── Level ${levelNum} (${mode}): ${libs.join(', ')} ──`);

    if (mode === 'parallel') {
      // Build in parallel, but respect any intra-level dependency edges
      try {
        await buildParallelWithDeps(libs);
      } catch (failures) {
        console.error(`\n❌ ${failures.length} build(s) failed at level ${levelNum}:`);
        for (const f of failures) {
          console.error(`   ${f.error.message}`);
        }
        process.exit(1);
      }
    } else {
      // Build libs sequentially in the order they appear in package.json
      for (const lib of libs) {
        try {
          await buildLib(lib);
        } catch (err) {
          console.error(`\n❌ Build failed at level ${levelNum}: ${err.message}`);
          process.exit(1);
        }
      }
    }
  }

  console.log('\n✅ All libraries built successfully.\n');
}

// ── Rebuild queue ──────────────────────────────────────────────────────────────

/**
 * Notify webpack that rebuilt libraries have new output. Touches the entry file of
 * every library that was swapped since the last notification. Called once when the
 * queue is fully drained (nothing building, nothing queued) so that webpack
 * recompiles exactly once rather than once per library.
 */
function notifyWebpack() {
  if (swappedLibs.size === 0) return;
  const now = new Date();
  // Libraries use either public_api.d.ts or public-api.d.ts (inconsistent naming).
  const candidates = ['public_api.d.ts', 'public-api.d.ts', 'index.d.ts'];
  for (const libName of swappedLibs) {
    const libDist = path.join(FRONTEND_ROOT, 'dist', 'valtimo', libName);
    for (const candidate of candidates) {
      const entryFile = path.join(libDist, candidate);
      try {
        if (fs.existsSync(entryFile)) {
          fs.utimesSync(entryFile, now, now);
          break;
        }
      } catch {
        // ignore — best effort
      }
    }
  }
  swappedLibs.clear();
}

/**
 * Check whether all dependencies of `libName` are done (not building and not queued).
 */
function depsReady(libName) {
  const deps = dependsOn.get(libName);
  if (!deps) return true;
  for (const dep of deps) {
    if (building.has(dep) || queued.has(dep)) return false;
  }
  return true;
}

/**
 * Process the rebuild queue: start builds for any queued libraries whose dependencies
 * are all finished. Respects MAX_PARALLEL_BUILDS.
 */
function processQueue() {
  if (queued.size === 0) {
    // Queue drained — if nothing is building either, notify webpack once for all swapped libs.
    if (building.size === 0) {
      notifyWebpack();
    }
    return;
  }

  for (const [libName] of queued) {
    if (building.size >= MAX_PARALLEL_BUILDS) break;
    if (building.has(libName)) continue;
    if (!depsReady(libName)) continue;

    // Remove from queue and start building
    queued.delete(libName);
    building.add(libName);

    buildLib(libName, {safeSwap: true})
      .then(() => {
        building.delete(libName);
        // Queue dependents that were also pending
        const deps = dependents.get(libName);
        if (deps) {
          for (const dep of deps) {
            if (pendingRebuilds.has(dep)) {
              pendingRebuilds.delete(dep);
              enqueue(dep);
            }
          }
        }
        processQueue();
      })
      .catch(() => {
        building.delete(libName);
        processQueue();
      });
  }
}

/**
 * Add a library to the rebuild queue.
 */
function enqueue(libName) {
  if (building.has(libName)) {
    // Already building — mark as needing another rebuild after this one finishes
    pendingRebuilds.add(libName);
    return;
  }

  if (queued.has(libName)) {
    // Already queued — no need to add again
    return;
  }

  queued.set(libName, true);
  processQueue();
}

/**
 * Called when a source file changes for a library. Debounces and enqueues.
 * Ignores events for libraries that are already building or queued to avoid
 * spurious re-triggers from intermediate build artifacts.
 */
function onLibSourceChange(libName) {
  if (building.has(libName) || queued.has(libName)) {
    return;
  }

  // Clear any existing debounce timer
  if (debounceTimers.has(libName)) {
    clearTimeout(debounceTimers.get(libName));
  }

  debounceTimers.set(
    libName,
    setTimeout(() => {
      debounceTimers.delete(libName);
      console.log(`\n📝 Change detected in @valtimo/${libName} — queuing rebuild`);
      enqueue(libName);
    }, DEBOUNCE_MS)
  );
}

// ── File watchers using chokidar ───────────────────────────────────────────────

function startWatchers() {
  console.log('👀 Starting file watchers for all libraries...\n');

  // We use Node's native fs.watch with recursive option (supported on macOS and Windows).
  // This avoids the overhead of chokidar subprocesses and gives us in-process change detection.
  for (const libName of allLibs) {
    const libSrcDir = path.join(FRONTEND_ROOT, 'projects', 'valtimo', libName);

    if (!fs.existsSync(libSrcDir)) {
      console.warn(`  ⚠ Source directory not found for ${libName}: ${libSrcDir}`);
      continue;
    }

    try {
      const watcher = fs.watch(libSrcDir, {recursive: true}, (eventType, filename) => {
        if (!filename) return;
        // Ignore non-source files
        if (
          !filename.endsWith('.ts') &&
          !filename.endsWith('.html') &&
          !filename.endsWith('.scss') &&
          !filename.endsWith('.css') &&
          !filename.endsWith('.json')
        ) {
          return;
        }
        // Ignore spec files, test files, and ng-package.json (modified during safeSwap builds)
        if (filename.endsWith('.spec.ts')) return;
        if (filename === 'ng-package.json') return;

        onLibSourceChange(libName);
      });

      watcher.on('error', err => {
        console.error(`  ⚠ Watcher error for ${libName}: ${err.message}`);
      });

      activeProcesses.push({kill: () => watcher.close(), killed: false});
    } catch (err) {
      console.error(`  ⚠ Failed to start watcher for ${libName}: ${err.message}`);
    }
  }

  console.log(`  Started watchers for ${allLibs.length} libraries.\n`);
}

// ── Start the dev server ───────────────────────────────────────────────────────

async function startDevServer() {
  const inUse = await checkPortInUse(PORT_TO_CHECK);

  if (inUse) {
    console.log(`Port ${PORT_TO_CHECK} already in use. Skipping app start.\n`);
    hasStartedApp = true;
    return;
  }

  console.log('🚀 Starting Angular dev server (npm run start)...\n');

  const startProc = spawn('npm', ['run', 'start'], {
    stdio: 'inherit',
    shell: true,
    cwd: FRONTEND_ROOT,
  });

  startProc.on('error', err => {
    console.error('Failed to start app:', err);
  });

  activeProcesses.push(startProc);
  hasStartedApp = true;
}

// ── Cleanup ────────────────────────────────────────────────────────────────────

function cleanup() {
  if (isCleaningUp) return;
  isCleaningUp = true;

  console.log('\n🧹 Cleaning up child processes and lock files...\n');

  for (const p of activeProcesses) {
    try {
      if (p && !p.killed) {
        p.kill();
      }
    } catch (err) {
      // Ignore cleanup errors
    }
  }

  removeAllLocks();
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  // Clean any stale lock files from previous runs
  removeAllLocks();

  await initialBuildAll();
  startWatchers();
  await startDevServer();

  console.log('✨ Dev mode is running. Edit any library source to trigger a rebuild.\n');
}

main().catch(err => {
  console.error('Dev mode failed:', err);
  cleanup();
});
