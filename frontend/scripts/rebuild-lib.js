const {spawn} = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const libName = process.argv[2];
const fullLibName = `@valtimo/${libName}`;
const rebuildLockFile = path.resolve(__dirname, '../.rebuilding.lock');

async function rebuild() {
  const fileExists = await fs
    .access(rebuildLockFile)
    .then(() => true)
    .catch(() => false);
  if (fileExists) {
    console.log(`⏳ Rebuild in progress. Skipping rebuild for: ${fullLibName}`);
    process.exit(0);
  }

  await fs.writeFile(rebuildLockFile, 'rebuilding');
  console.log(`🔁 Rebuilding ${fullLibName}`);

  const result = await new Promise((resolve, reject) => {
    const buildProc = spawn('ng', ['build', fullLibName], {stdio: 'inherit', shell: true});

    buildProc.on('exit', code => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error('Build failed'));
      }
    });
  });

  await fs.rm(rebuildLockFile);

  console.log(`✅ Build completed for: ${libName}`);

  process.exit(result); // Exit with the result code from the build
}

rebuild().catch(err => {
  console.error('Error during rebuild:', err);
  process.exit(1);
});
