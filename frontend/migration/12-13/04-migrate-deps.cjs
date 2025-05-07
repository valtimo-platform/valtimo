#!/usr/bin/env node

const path = require('path');
const {spawnSync} = require('child_process');

const scriptPath = path.resolve(__dirname, '../migrate-deps.cjs');

console.log(`Starting migration step 04: syncing Valtimo deps`);
const result = spawnSync('node', [scriptPath], {stdio: 'inherit'});

if (result.status !== 0) {
  console.error('Step 04 failed: migrate-deps.cjs exited with error');
  process.exit(result.status);
}

console.log('Step 04 completed successfully.');
