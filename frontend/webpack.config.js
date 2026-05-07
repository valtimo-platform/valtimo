const fs = require('fs');
const path = require('path');

const FRONTEND_ROOT = path.resolve(__dirname);

/**
 * Check whether any library rebuild is in progress by looking for per-library
 * lock files created by dev-mode.js (.rebuilding-<lib>.lock).
 */
function isRebuildInProgress() {
  try {
    const entries = fs.readdirSync(FRONTEND_ROOT);
    return entries.some(entry => entry.startsWith('.rebuilding-') && entry.endsWith('.lock'));
  } catch {
    return false;
  }
}

/**
 * Wait until lock files have been absent for a settle period. This ensures
 * webpack doesn't start compiling while ng-packagr's file writes are still
 * propagating through the OS file-event queue.
 */
function waitForLocksToSettle(callback) {
  const check = () => {
    if (isRebuildInProgress()) {
      setTimeout(check, 300);
    } else {
      // Lock gone — wait a bit more to let file events settle
      setTimeout(() => {
        if (isRebuildInProgress()) {
          check();
        } else {
          callback();
        }
      }, 1000);
    }
  };
  check();
}

/**
 * Plugin that coordinates webpack's file watcher with dev-mode library rebuilds.
 *
 * Problem: When multiple libraries rebuild in parallel, the first lib's dist
 * writes trigger webpack's watchRun with only partial changes. The second lib's
 * dist writes arrive during the first compilation, causing a redundant second
 * compilation.
 *
 * Solution: Use compiler.watching.suspend()/resume() to pause webpack's file
 * watcher entirely while rebuilds are in progress. When resumed, all accumulated
 * dist writes are collected into a single compilation.
 *
 * A polling interval checks for lock files. When locks appear, the watcher is
 * suspended. When locks disappear (after a settle period), the watcher is resumed.
 */
class WaitForRebuildLockPlugin {
  apply(compiler) {
    let isSuspended = false;
    let pollInterval = null;

    compiler.hooks.watchRun.tapAsync('WaitForRebuildLock', (_params, callback) => {
      // If a rebuild is in progress when webpack tries to compile (e.g. locks
      // appeared just as aggregateTimeout fired), pause here as a safety net.
      if (isRebuildInProgress()) {
        console.log('\nLib rebuild in progress — pausing webpack...');
        waitForLocksToSettle(() => {
          console.log('Lib rebuild finished — resuming webpack.\n');
          callback();
        });
      } else {
        callback();
      }
    });

    // Start polling for lock files once webpack enters watch mode.
    // When locks are detected, suspend the watcher so FS events accumulate
    // without triggering compilations. When locks clear, resume.
    compiler.hooks.afterCompile.tap('WaitForRebuildLock', () => {
      if (pollInterval) return; // already started

      pollInterval = setInterval(() => {
        const rebuilding = isRebuildInProgress();

        if (rebuilding && !isSuspended && compiler.watching) {
          console.log('\n[dev-mode] Lock detected — suspending webpack watcher...');
          compiler.watching.suspend();
          isSuspended = true;
        }

        if (!rebuilding && isSuspended && compiler.watching) {
          // Settle: wait 1 second after last lock disappears to ensure all dist
          // writes have flushed before resuming.
          setTimeout(() => {
            if (!isRebuildInProgress() && isSuspended) {
              console.log('[dev-mode] Locks cleared — resuming webpack watcher.\n');
              compiler.watching.resume();
              isSuspended = false;
            }
          }, 1000);
        }
      }, 500);
    });

    compiler.hooks.watchClose.tap('WaitForRebuildLock', () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    });
  }
}

module.exports = {
  watchOptions: {
    // Wait 2 seconds after detecting a file change before starting a new compilation.
    // During rebuilds, ng-packagr writes many files (fesm2022/*.mjs, *.d.ts, etc.)
    // one by one. This batches all those writes into a single compilation trigger.
    aggregateTimeout: 2000,
    // Ignore lock files used by dev-mode.js to coordinate rebuilds. Without this,
    // lock file creation/removal generates FS events that trigger extra compilations.
    ignored: ['**/.rebuilding-*.lock'],
  },
  snapshot: {
    // By default webpack treats everything under node_modules/ as "managed" (stable,
    // package-manager-controlled). Our @valtimo/* packages are symlinks from
    // node_modules/@valtimo/<lib> → dist/valtimo/<lib> and their content changes
    // on every library rebuild. Mark dist/valtimo/ as unmanaged so webpack
    // properly invalidates its cache and picks up new builds.
    unmanagedPaths: [path.resolve(FRONTEND_ROOT, 'dist', 'valtimo')],
  },
  plugins: [
    new WaitForRebuildLockPlugin(),
  ],
};
