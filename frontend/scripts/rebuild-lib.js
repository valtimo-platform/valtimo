const {spawn} = require('child_process');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

const libName = process.argv[2];
const fullLibName = `@valtimo/${libName}`;
const rebuildLockFile = path.resolve(__dirname, '../.rebuilding.lock');
const libBuildingLockFile = path.resolve(__dirname, `../.rebuilding-lib-${libName}.lock`);
const libPendingFile = path.resolve(__dirname, `../.rebuilding-lib-${libName}.pending`);

async function createLockFile(lockFile) {
  try {
    await fsPromises.writeFile(lockFile, String(process.pid));
  } catch (err) {
    console.error(`Failed to create lock file: ${lockFile}`, err.message);
  }
}

async function removeLockFile(lockFile) {
  try {
    await fsPromises.rm(lockFile, {force: true});
  } catch (_) {
    // ignore
  }
}

function isLockFilePresent(lockFile) {
  return fs.existsSync(lockFile);
}

/**
 * Check whether any other library is currently mid-build.
 * If so, we should keep the general rebuild lock alive.
 */
function isAnyOtherLibBuilding() {
  const dir = path.resolve(__dirname, '..');
  try {
    const files = fs.readdirSync(dir);
    return files.some(
      f => f.startsWith('.rebuilding-lib-') && f.endsWith('.lock') && f !== `.rebuilding-lib-${libName}.lock`
    );
  } catch (_) {
    return false;
  }
}

async function rebuild() {
  // If another process is already building this library, signal that
  // a re-build is needed after it finishes, then exit.
  if (isLockFilePresent(libBuildingLockFile)) {
    await createLockFile(libPendingFile);
    console.log(`Build already in progress for ${fullLibName}. Marked as pending.`);
    return;
  }

  // Acquire per-library lock
  await createLockFile(libBuildingLockFile);
  // Ensure the general rebuild lock exists (tells webpack to wait)
  await createLockFile(rebuildLockFile);

  // Clear any pending flag — we're about to build
  await removeLockFile(libPendingFile);

  console.log(`Rebuilding ${fullLibName}`);

  try {
    await new Promise((resolve, reject) => {
      const buildProc = spawn('ng', ['build', fullLibName], {stdio: 'inherit', shell: true});

      buildProc.on('exit', code => {
        if (code === 0) {
          console.log(`Build completed for: ${libName}`);
          resolve();
        } else {
          reject(new Error(`Build failed for ${fullLibName} with exit code ${code}`));
        }
      });
    });
  } catch (err) {
    console.error(`Error during rebuild of ${fullLibName}:`, err.message);
  }

  // Release per-library lock
  await removeLockFile(libBuildingLockFile);

  // If another change came in while we were building, rebuild again
  if (isLockFilePresent(libPendingFile)) {
    console.log(`Pending changes detected for ${fullLibName}. Rebuilding again...`);
    await rebuild();
    return;
  }

  // Only remove the general lock if no other library is mid-build
  if (!isAnyOtherLibBuilding()) {
    console.log(`No other libraries building. Removing general lock file.`);
    await removeLockFile(rebuildLockFile);
  } else {
    console.log(`Other libraries still building. Keeping general lock file.`);
  }
}

rebuild().catch(err => {
  console.error('Error during rebuild:', err);
  // Clean up our per-library lock on crash
  removeLockFile(libBuildingLockFile);
  process.exit(1);
});
