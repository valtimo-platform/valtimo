#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');

const implPackageJsonPath = path.resolve(__dirname, '../package.json');
const libsPackageJsonPath = path.resolve(__dirname, '../tmp/libs-package.json');
const nodeModulesPath = path.resolve(__dirname, '../node_modules');

const VALTIMO_DEPS_SOURCE = process.env.VALTIMO_DEPS_SOURCE;
const VALTIMO_VERSION = process.env.VALTIMO_VERSION;

console.log('Starting migration: syncing Valtimo dependenies');

if (!VALTIMO_DEPS_SOURCE || !VALTIMO_VERSION) {
  console.error('Both VALTIMO_DEPS_SOURCE and VALTIMO_VERSION must be set');
  process.exit(1);
}

const isSnapshot = VALTIMO_VERSION.startsWith('http');

const getSnapshotVersion = url => {
  const parts = url.split('/');
  return parts[parts.length - 1] || parts[parts.length - 2];
};

const getSnapshotUrl = pkgName => {
  const shortName = pkgName.replace(/^@valtimo\//, 'valtimo-');
  const version = getSnapshotVersion(VALTIMO_VERSION);
  return `${VALTIMO_VERSION}/${shortName}-${version}.tgz`;
};

const fetchRemotePackageJson = () => {
  const fixedUrl = VALTIMO_DEPS_SOURCE.replace('github.com', 'raw.githubusercontent.com').replace(
    '/blob/',
    '/'
  );

  fs.mkdirSync(path.dirname(libsPackageJsonPath), {recursive: true});

  const file = fs.createWriteStream(libsPackageJsonPath);

  https
    .get(fixedUrl, res => {
      if (res.statusCode !== 200) {
        console.error(`Failed to fetch: ${res.statusCode}`);
        process.exit(1);
      }

      res.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('Remote package.json downloaded');
        migrateDeps();
      });
    })
    .on('error', err => {
      console.error('Fetch failed:', err);
      process.exit(1);
    });
};

const migrateDeps = () => {
  const remote = JSON.parse(fs.readFileSync(libsPackageJsonPath, 'utf-8'));
  const local = JSON.parse(fs.readFileSync(implPackageJsonPath, 'utf-8'));

  local.dependencies = syncExistingDeps(local.dependencies, remote.dependencies);
  local.devDependencies = syncExistingDeps(local.devDependencies, remote.devDependencies);

  fs.writeFileSync(implPackageJsonPath, JSON.stringify(local, null, 2));
  console.log('package.json updated');

  fs.rmSync(path.dirname(libsPackageJsonPath), {recursive: true, force: true});
  console.log('Cleaned up tmp folder');

  console.log('Step completed successfully.');
};

const syncExistingDeps = (localDeps = {}, remoteDeps = {}) => {
  const result = {...localDeps};

  Object.keys(localDeps).forEach(pkg => {
    if (pkg.startsWith('@valtimo/')) {
      result[pkg] = isSnapshot ? getSnapshotUrl(pkg) : VALTIMO_VERSION;
      console.log(`@valtimo dep updated: ${pkg} → ${result[pkg]}`);
    } else if (remoteDeps && remoteDeps[pkg]) {
      result[pkg] = remoteDeps[pkg];
      console.log(`Synced existing dep: ${pkg} → ${result[pkg]}`);
    }
  });

  return result;
};

fetchRemotePackageJson();
