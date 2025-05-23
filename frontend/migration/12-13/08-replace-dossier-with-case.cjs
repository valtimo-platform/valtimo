const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../');
const srcDir = path.join(rootDir, 'src');
const packageJsonPath = path.join(rootDir, 'package.json');

function walkFiles(dir, callback) {
  const entries = fs.readdirSync(dir, {withFileTypes: true});

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, callback);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      callback(fullPath);
    }
  }
}

function collectSymbolsToReplace() {
  const symbolMap = {}; // symbolName -> {replacement: string, fromLib: string}

  walkFiles(srcDir, filePath => {
    const content = fs.readFileSync(filePath, 'utf8');
    const importRegex = /^import\s+{([^}]+)}\s+from\s+['"](@valtimo\/[^'"]+)['"]/gm;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const [, symbolBlock, fromPath] = match;

      const symbols = symbolBlock
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      for (const symbol of symbols) {
        if (symbol.startsWith('Dossier')) {
          const replacement = symbol.replace(/^Dossier/, 'Case');
          symbolMap[symbol] = {
            replacement,
            fromLib: fromPath,
            definedIn: filePath,
          };
        }
      }
    }
  });

  return symbolMap;
}

function rewriteImportsAndReferences(symbolMap) {
  const libPathReplacements = {
    '@valtimo/dossier': '@valtimo/case',
    '@valtimo/dossier-management': '@valtimo/case-management',
  };

  walkFiles(srcDir, filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    for (const [originalSymbol, {replacement}] of Object.entries(symbolMap)) {
      const symbolRegex = new RegExp(`\\b${originalSymbol}\\b`, 'g');
      content = content.replace(symbolRegex, replacement);
    }

    for (const [oldPath, newPath] of Object.entries(libPathReplacements)) {
      const pathRegex = new RegExp(`from ['"]${oldPath}['"]`, 'g');
      content = content.replace(pathRegex, `from '${newPath}'`);
    }

    if (content !== original) {
      fs.writeFileSync(filePath, content);
      console.log(`Updated: ${filePath}`);
    }
  });
}

function updatePackageJsonDeps() {
  if (!fs.existsSync(packageJsonPath)) {
    console.warn('package.json not found, skipping dep update.');
    return;
  }

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  let changed = false;

  const replacements = {
    '@valtimo/dossier': '@valtimo/case',
    '@valtimo/dossier-management': '@valtimo/case-management',
  };

  ['dependencies', 'devDependencies'].forEach(depType => {
    const deps = pkg[depType];
    if (!deps) return;

    Object.entries(replacements).forEach(([oldName, newName]) => {
      if (deps[oldName]) {
        let version = deps[oldName];

        if (typeof version === 'string' && version.includes('valtimo-dossier')) {
          version = version.replace(/valtimo-dossier/g, 'valtimo-case');
        }
        if (typeof version === 'string' && version.includes('valtimo-dossier-management')) {
          version = version.replace(/valtimo-dossier-management/g, 'valtimo-case-management');
        }

        deps[newName] = version;
        delete deps[oldName];
        changed = true;
        console.log(`🔄 Replaced ${oldName} → ${newName} with correct version`);
      }
    });
  });

  if (changed) {
    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
    console.log('package.json updated with @valtimo/case replacements');
  } else {
    console.log('No @valtimo/dossier dependencies found to replace');
  }
}

try {
  console.log('Starting migration: Replace Dossier* symbols and @valtimo/dossier imports');

  const symbolMap = collectSymbolsToReplace();

  if (Object.keys(symbolMap).length === 0) {
    console.log('No matching Dossier* symbols found in @valtimo/* imports.');
  } else {
    console.log(`Found ${Object.keys(symbolMap).length} symbols to replace.`);
  }

  rewriteImportsAndReferences(symbolMap);
  updatePackageJsonDeps();

  console.log('Migration completed.');
  process.exit(0);
} catch (err) {
  console.error('Migration failed.');
  console.error(err);
  process.exit(1);
}
