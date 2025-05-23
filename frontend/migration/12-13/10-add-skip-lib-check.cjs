#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const JSON5 = require('json5');

const tsconfigPath = path.resolve(__dirname, '../../tsconfig.json');

function stripJsonComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function parseJsonSafely(content) {
  try {
    return JSON.parse(content);
  } catch {
    return JSON5.parse(content);
  }
}

function addCompilerOptions() {
  if (!fs.existsSync(tsconfigPath)) {
    console.error('Could not find tsconfig.json in project root');
    process.exit(1);
  }

  const raw = fs.readFileSync(tsconfigPath, 'utf-8');
  const clean = stripJsonComments(raw);

  let json;
  try {
    json = parseJsonSafely(clean);
  } catch (err) {
    console.error('Failed to parse tsconfig.json. Please fix any JSON issues.');
    console.error(err.message);
    process.exit(1);
  }

  if (!json.compilerOptions) {
    json.compilerOptions = {};
  }

  let updated = false;

  if (json.compilerOptions.skipLibCheck !== true) {
    json.compilerOptions.skipLibCheck = true;
    console.log('Added "skipLibCheck": true');
    updated = true;
  } else {
    console.log('"skipLibCheck" already set to true');
  }

  if (json.compilerOptions.moduleResolution !== 'bundler') {
    json.compilerOptions.moduleResolution = 'bundler';
    console.log('Set "moduleResolution": "bundler"');
    updated = true;
  } else {
    console.log('ℹ"moduleResolution" already set to "bundler"');
  }

  if (updated) {
    fs.writeFileSync(tsconfigPath, JSON.stringify(json, null, 2) + '\n');
    console.log('tsconfig.json updated');
  } else {
    console.log('ℹNo changes needed to tsconfig.json');
  }

  console.log('Migration step 08 completed.');
}

try {
  console.log('Starting migration step 08: Ensure skipLibCheck and moduleResolution are set');
  addCompilerOptions();
  process.exit(0);
} catch (err) {
  console.error('Migration step 08 failed');
  console.error(err);
  process.exit(1);
}
