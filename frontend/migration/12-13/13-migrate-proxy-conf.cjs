/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
}

function shouldSkip(filePath) {
  return filePath.includes('node_modules') || filePath.includes('dist');
}

function transformProxyConfig(config) {
  const result = {};

  for (const [key, value] of Object.entries(config)) {
    let newKey = key;

    if (newKey.endsWith('/*') && !newKey.endsWith('/**')) {
      newKey = newKey.replace(/\/\*$/, '/**');
    }

    let newValue = {...value};

    if (key === '/api/*') {
      newValue.changeOrigin = false;
    } else if (key === '/management/*') {
      newKey = '/api/management/**';
    }

    result[newKey] = newValue;
  }

  return result;
}

function processProxyFiles(dir) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const fullPath = path.join(dir, file);
    if (shouldSkip(fullPath) || file.startsWith('.')) return;

    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      processProxyFiles(fullPath);
    } else if (file === 'proxy.conf.json') {
      try {
        const original = readJson(fullPath);
        const updated = transformProxyConfig(original);
        writeJson(fullPath, updated);
        console.log(`Updated proxy config at: ${fullPath}`);
      } catch (err) {
        console.warn(`Failed to process ${fullPath}:`, err.message);
      }
    }
  });
}

console.log('--- Migrating proxy.conf.json files ---');
const rootDir = process.cwd();
processProxyFiles(rootDir);
console.log('Migration complete.');
