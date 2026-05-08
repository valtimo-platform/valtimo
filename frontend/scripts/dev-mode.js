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
 * Rebuild strategy:
 * Libraries are built directly into their real dist/ directory. After the initial
 * build, deleteDestPath is set to false globally for all libraries so ng-packagr
 * overwrites files in place instead of deleting the entire output directory first.
 * This produces a single burst of file-system events instead of two waves (delete +
 * write) which would cause webpack to compile twice.
 *
 * Webpack is prevented from compiling mid-build by two mechanisms:
 * 1. Per-library lock files (.rebuilding-<lib>.lock) signal individual builds
 * 2. A batch lock file (.rebuilding-batch.lock) stays alive for the entire duration
 *    of a batch of sequential/parallel rebuilds, preventing webpack from starting
 *    compilation in the gap between individual lib builds.
 *
 * The WaitForRebuildLockPlugin (webpack.config.js) pauses webpack compilation
 * while any .rebuilding-*.lock file exists.
 *
 * Key features:
 * - Single process coordinates all rebuilds (no race conditions)
 * - Dependency graph parsed at runtime from package.json build scripts
 * - Per-library + batch lock files pause webpack during builds
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
const queued = new Map(); // lib -> true; libs waiting to build
const debounceTimers = new Map(); // lib -> timer
const pendingRebuilds = new Set(); // libs that need a rebuild (debounced, waiting to enter queue)

// ── Lock file helpers ──────────────────────────────────────────────────────────

function lockFilePath(libName) {
  return path.join(LOCK_DIR, `.rebuilding-${libName}.lock`);
}

const BATCH_LOCK_PATH = path.join(LOCK_DIR, '.rebuilding-batch.lock');

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

/**
 * Create the batch lock — stays alive for the entire duration of a batch of
 * sequential rebuilds so webpack never sees a gap between individual builds.
 */
function createBatchLock() {
  try {
    if (!fs.existsSync(BATCH_LOCK_PATH)) {
      fs.writeFileSync(BATCH_LOCK_PATH, `batch:${Date.now()}`);
    }
  } catch (err) {
    console.error(`  ⚠ Failed to create batch lock: ${err.message}`);
  }
}

/**
 * Remove the batch lock only when no builds are active or queued.
 */
function removeBatchLockIfIdle() {
  if (building.size === 0 && queued.size === 0) {
    try {
      if (fs.existsSync(BATCH_LOCK_PATH)) {
        fs.rmSync(BATCH_LOCK_PATH);
      }
    } catch {
      // Ignore
    }
  }
}

function removeAllLocks() {
  for (const lib of allLibs) {
    removeLock(lib);
  }
  try {
    if (fs.existsSync(BATCH_LOCK_PATH)) {
      fs.rmSync(BATCH_LOCK_PATH);
    }
  } catch {
    // Ignore
  }
}

// ── ng-package.json helpers ────────────────────────────────────────────────────

function ngPackagePath(libName) {
  return path.join(FRONTEND_ROOT, 'projects', 'valtimo', libName, 'ng-package.json');
}

/**
 * Set deleteDestPath in ng-package.json. When false, ng-packagr overwrites files
 * in-place instead of deleting the entire output directory first. This is critical
 * for rebuilds: it produces a single burst of FS events rather than two waves
 * (delete all + write all), preventing webpack from compiling twice.
 */
function setDeleteDestPath(libName, value) {
  const filePath = ngPackagePath(libName);
  if (!fs.existsSync(filePath)) return;

  try {
    const content = fs.readFileSync(filePath, 'utf8');

    if (value === false) {
      // Add "deleteDestPath": false right after the opening brace using string manipulation.
      // This avoids JSON.parse which fails on files with trailing commas.
      if (content.includes('"deleteDestPath"')) return; // already set
      const replaced = content.replace(/^\{/, '{\n  "deleteDestPath": false,');
      fs.writeFileSync(filePath, replaced);
    } else {
      // Remove the deleteDestPath line to restore default behavior.
      // Handle both cases: line with trailing comma, and line without.
      const lines = content.split('\n');
      const filtered = lines.filter(line => !line.match(/^\s*"deleteDestPath"\s*:/));

      // Fix trailing comma on the line before the closing brace
      let result = filtered.join('\n');
      result = result.replace(/,(\s*\n\s*\})/, '$1');

      fs.writeFileSync(filePath, result);
    }
  } catch (err) {
    console.error(`  ⚠ Failed to update ng-package.json for ${libName}: ${err.message}`);
  }
}

/**
 * Set deleteDestPath for all libraries at once. Called once after the initial build
 * to switch to in-place overwrites for all subsequent rebuilds.
 */
function setDeleteDestPathAll(value) {
  for (const libName of allLibs) {
    setDeleteDestPath(libName, value);
  }
}

/**
 * Reset all ng-package.json files to remove any deleteDestPath overrides
 * left behind by an interrupted run.
 */
function resetAllNgPackageJson() {
  for (const libName of allLibs) {
    setDeleteDestPath(libName, true);
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
 * Build a library directly into its dist/ directory. The lock file ensures
 * webpack's WaitForRebuildLockPlugin pauses compilation until the build finishes.
 *
 * For rebuilds (after initial build), deleteDestPath is already set to false
 * globally via setDeleteDestPathAll(false) — ng-packagr overwrites files in place
 * instead of deleting the output directory. This prevents two waves of FS events
 * (delete + write) that cause double webpack compilations.
 */
function buildLib(libName) {
  const fullName = `@valtimo/${libName}`;

  return new Promise((resolve, reject) => {
    console.log(`  🔨 Building ${fullName}...`);
    createLock(libName);

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

    buildProc.on('error', err => {
      removeLock(libName);
      reject(err);
    });

    buildProc.on('exit', code => {
      if (code === 0 || stdout.includes('Built Angular Package')) {
        removeLock(libName);
        console.log(`  ✅ Built ${fullName}`);
        resolve();
      } else {
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
    removeBatchLockIfIdle();
    return;
  }

  // Ensure the batch lock is present for the entire duration of queued builds.
  // This prevents webpack from seeing a gap between individual lib builds and
  // starting compilation prematurely.
  createBatchLock();

  for (const [libName] of queued) {
    if (building.size >= MAX_PARALLEL_BUILDS) break;
    if (building.has(libName)) continue;
    if (!depsReady(libName)) continue;

    // Remove from queue and start building
    queued.delete(libName);
    building.add(libName);

    buildLib(libName)
      .then(() => {
        building.delete(libName);

        // If this library had another source change while building, re-enqueue it
        if (pendingRebuilds.has(libName)) {
          pendingRebuilds.delete(libName);
          enqueue(libName);
        }

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

        // Even on failure, re-enqueue if another change came in during the build
        if (pendingRebuilds.has(libName)) {
          pendingRebuilds.delete(libName);
          enqueue(libName);
        }

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
 * If the library is already building or queued, marks it as needing another
 * rebuild after the current one finishes (so changes are never silently dropped).
 */
function onLibSourceChange(libName) {
  if (building.has(libName) || queued.has(libName)) {
    // Library is already building or queued — schedule a re-rebuild after it finishes
    // so that the new source change is not lost.
    pendingRebuilds.add(libName);
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

// ── File watchers ──────────────────────────────────────────────────────────────

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
        // Ignore spec files, test files, and ng-package.json (modified during builds)
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
  resetAllNgPackageJson();
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  // Clean any stale lock files and ng-package.json overrides from previous runs
  removeAllLocks();
  resetAllNgPackageJson();

  await initialBuildAll();

  // After the initial build, set deleteDestPath:false for all libs so subsequent
  // rebuilds overwrite files in-place instead of deleting the output directory.
  // This is done once globally to avoid per-build ng-package.json writes that
  // would trigger unwanted webpack recompilations.
  setDeleteDestPathAll(false);

  startWatchers();
  await startDevServer();

  console.log('✨ Dev mode is running. Edit any library source to trigger a rebuild.\n');
}

main().catch(err => {
  console.error('Dev mode failed:', err);
  cleanup();
});
