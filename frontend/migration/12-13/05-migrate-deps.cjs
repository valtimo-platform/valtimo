const path = require('path');
const {spawnSync} = require('child_process');

const scriptPath = path.resolve(__dirname, '../migrate-deps.cjs');

console.log(`Syncing Valtimo deps`);
const result = spawnSync('node', [scriptPath], {stdio: 'inherit'});

if (result.status !== 0) {
  console.error('migrate-deps.cjs exited with error');
  process.exit(result.status);
}

console.log('Step completed successfully.');
