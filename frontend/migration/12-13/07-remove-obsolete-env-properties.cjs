#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');

const envDir = path.resolve(__dirname, '../../', 'src/environments');

const rootDir = path.resolve(__dirname, '../../');

function cleanEnvironmentFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // 1. Remove customDefinitionTables: {...}, safely including nested arrays
  content = content.replace(
    /customDefinitionTables\s*:\s*{[^{}]*?leningen\s*:\s*\[[\s\S]*?\][\s\S]*?},?\n?/g,
    ''
  );

  // 2. Replace definitions: { dossiers: [] } with definitions: { cases: [] }
  content = content.replace(
    /definitions\s*:\s*{\s*dossiers\s*:\s*\[\s*\]\s*}/g,
    'definitions: { cases: [] }'
  );

  // Optional: Clean up any trailing commas before closing braces
  content = content.replace(/,(\s*[}\]])/g, '$1');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`Cleaned up deprecated env config in: ${path.basename(filePath)}`);
  }
}

function runMigration() {
  const files = fs.readdirSync(envDir).filter(file => file.endsWith('.ts'));

  if (files.length === 0) {
    console.log('No environment files found in', envDir);
    return;
  }

  files.forEach(file => {
    const fullPath = path.join(envDir, file);
    cleanEnvironmentFile(fullPath);
  });

  console.log('Migration step 07 completed.');
}

function npmInstall() {
  console.log('Running npm install...');
  execSync('npm install', {cwd: rootDir, stdio: 'inherit'});
}

try {
  console.log('Starting migration step 07: Remove deprecated env properties');
  runMigration();
  npmInstall();
  process.exit(0);
} catch (err) {
  console.error('Migration step 07 failed');
  console.error(err);
  process.exit(1);
}
