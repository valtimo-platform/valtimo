const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
}

function processFiles(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);

    if (file === 'node_modules' || file.startsWith('.') || fullPath.includes('node_modules')) {
      return;
    }

    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      processFiles(fullPath);
    } else if (/\.(js|ts|html|tsx|jsx)$/.test(file)) {
      let contents = fs.readFileSync(fullPath, 'utf8');

      const replaced = contents.replace(/@valtimo\/config/g, '@valtimo/shared');
      if (replaced !== contents) {
        fs.writeFileSync(fullPath, replaced, 'utf8');
        console.log('Updated:', fullPath);
      }
    }
  });
}

function updatePackageJson(rootDir) {
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = readJson(pkgPath);

  let changed = false;
  ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].forEach(
    depType => {
      if (pkg[depType] && pkg[depType]['@valtimo/config']) {
        pkg[depType]['@valtimo/shared'] = pkg[depType]['@valtimo/config'];
        delete pkg[depType]['@valtimo/config'];
        changed = true;
      }
    }
  );

  if (changed) {
    writeJson(pkgPath, pkg);
    console.log('Updated package.json');
  } else {
    console.log('No @valtimo/config dependency found in package.json');
  }
}

function updateAngularJson(rootDir) {
  const angularPath = path.join(rootDir, 'angular.json');
  if (!fs.existsSync(angularPath)) {
    console.warn('angular.json not found, skipping...');
    return;
  }
  let angularJson = fs.readFileSync(angularPath, 'utf8');
  if (angularJson.includes('@valtimo/config')) {
    angularJson = angularJson.replace(/@valtimo\/config/g, '@valtimo/shared');
    fs.writeFileSync(angularPath, angularJson, 'utf8');
    console.log('Updated angular.json');
  } else {
    console.log('No @valtimo/config references found in angular.json');
  }
}

const rootDir = process.cwd();

console.log('--- Updating all imports from @valtimo/config to @valtimo/shared ---');
processFiles(rootDir);

console.log('--- Updating package.json ---');
updatePackageJson(rootDir);

console.log('--- Updating angular.json ---');
updateAngularJson(rootDir);

console.log('All done!');
