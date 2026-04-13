/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
 * Standalone library rebuild script.
 *
 * Usage: node rebuild-lib.js <lib-name>
 *
 * Uses a per-library lock file (.rebuilding-<lib>.lock) to prevent concurrent builds
 * of the same library. If the lock file exists (another build is in progress), the
 * rebuild is skipped.
 *
 * NOTE: In dev mode, rebuilds are coordinated by dev-mode.js which handles dependency
 * ordering and queuing. This script is kept for standalone / manual use only.
 */

const {spawn} = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const libName = process.argv[2];

if (!libName) {
  console.error('Usage: node rebuild-lib.js <lib-name>');
  process.exit(1);
}

const fullLibName = `@valtimo/${libName}`;
const lockFile = path.resolve(__dirname, `../.rebuilding-${libName}.lock`);

async function createLockFile() {
  try {
    await fs.writeFile(lockFile, `building:${Date.now()}`);
  } catch (err) {
    console.error(`Failed to create lock file: ${lockFile}`, err.message);
  }
}

async function removeLockFile() {
  try {
    await fs.rm(lockFile);
  } catch (err) {
    // Ignore if already removed
  }
}

function isLocked() {
  return fsSync.existsSync(lockFile);
}

async function rebuild() {
  if (isLocked()) {
    console.log(`Build already in progress for ${fullLibName} — skipping.`);
    return;
  }

  await createLockFile();
  console.log(`Rebuilding ${fullLibName}`);

  try {
    await new Promise((resolve, reject) => {
      const buildProc = spawn('ng', ['build', fullLibName], {stdio: 'inherit', shell: true});

      buildProc.on('exit', async code => {
        if (code === 0) {
          console.log(`Build completed for: ${fullLibName}`);
          resolve();
        } else {
          reject(new Error(`Build failed for ${fullLibName} with exit code ${code}`));
        }
      });
    });
  } catch (err) {
    console.error(`Error during rebuild of ${fullLibName}:`, err.message);
  } finally {
    await removeLockFile();
  }
}

rebuild().catch(err => {
  console.error('Error during rebuild:', err);
  process.exit(1);
});
