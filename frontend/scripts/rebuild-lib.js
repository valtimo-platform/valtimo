const {spawn} = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const libName = process.argv[2];
const fullLibName = `@valtimo/${libName}`;
const rebuildLockFile = path.resolve(__dirname, '../.rebuilding.lock');
const libRebuildLockFile = path.resolve(__dirname, `../.rebuilding-lib.lock`);

async function createLockFile(lockFile) {
  try {
    await fs.writeFile(lockFile, 'rebuilding');
    console.log(`Created lock file: ${lockFile}`);
  } catch (err) {
    console.error(`Failed to create lock file: ${lockFile}`, err.message);
  }
}

async function removeLockFile(lockFile) {
  try {
    await fs.rm(lockFile);
    console.log(`Removed lock file: ${lockFile}`);
  } catch (err) {
    console.error(`Failed to remove lock file: ${lockFile}`, err.message);
  }
}

async function rebuild() {
  await createLockFile(rebuildLockFile);

  await createLockFile(libRebuildLockFile);

  console.log(`Rebuilding ${fullLibName}`);

  try {
    await new Promise((resolve, reject) => {
      const buildProc = spawn('ng', ['build', fullLibName], {stdio: 'inherit', shell: true});

      buildProc.on('exit', async code => {
        if (code === 0) {
          console.log(`Build completed for: ${libName}`);

          await removeLockFile(libRebuildLockFile);

          console.log(`Library built successfully. Removing general lock file.`);

          await removeLockFile(rebuildLockFile);

          resolve();
        } else {
          reject(new Error(`Build failed for ${fullLibName} with exit code ${code}`));
        }
      });
    });
  } catch (err) {
    console.error(`Error during rebuild of ${fullLibName}:`, err.message);

    // On error, remove only the library-specific lock file to allow retry
    await removeLockFile(libRebuildLockFile);
  }
}

rebuild().catch(err => {
  console.error('Error during rebuild:', err);
  process.exit(1);
});
