#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const envDir = path.resolve(__dirname, '../../', 'src/environments');

function migrateMenuRoutes(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Regex-safe replacements scoped to menu
  const replacements = [
    {from: `title: 'Dossiers'`, to: `title: 'Cases'`},
    {from: `link: ['/dossier-management']`, to: `link: ['/case-management']`},
  ];

  for (const {from, to} of replacements) {
    const regex = new RegExp(from.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
    content = content.replace(regex, to);
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated menu items in: ${path.basename(filePath)}`);
  }
}

function runMigration() {
  const files = fs.readdirSync(envDir).filter(f => f.endsWith('.ts'));

  if (files.length === 0) {
    console.log('ℹNo environment files found.');
    return;
  }

  for (const file of files) {
    const fullPath = path.join(envDir, file);
    migrateMenuRoutes(fullPath);
  }

  console.log('Migration step 06 completed.');
}

try {
  console.log('Starting migration step 06: Replace dossier menu routes');
  runMigration();
  process.exit(0);
} catch (err) {
  console.error('Migration step 06 failed');
  console.error(err);
  process.exit(1);
}
