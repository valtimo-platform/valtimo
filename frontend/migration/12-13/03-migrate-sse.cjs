const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');

const rootDir = path.resolve(__dirname, '../../');
const pkgPath = path.join(rootDir, 'package.json');
const appModulePath = path.join(rootDir, 'src/app/app.module.ts');
const envDir = path.join(rootDir, 'src/environments');

function getAccessControlVersionLikeSse() {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = pkg.dependencies?.['@valtimo/access-control'];

  if (!version) {
    throw new Error('@valtimo/access-control dependency not found.');
  }

  if (version.startsWith('http')) {
    const baseUrl = version.substring(0, version.lastIndexOf('/') + 1);
    const versionMatch = version.match(/-(\d+\.\d+\.\S+)\.tgz$/);

    if (!versionMatch) {
      throw new Error('Could not extract version from @valtimo/access-control URL.');
    }

    const versionNumber = versionMatch[1]; // e.g., "12.9.0-next-minor.356"
    const newFilename = `valtimo-sse-${versionNumber}.tgz`;
    return baseUrl + newFilename;
  }

  return version;
}

function addSseDependency() {
  const versionOrUrl = getAccessControlVersionLikeSse();
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  pkg.dependencies['@valtimo/sse'] = versionOrUrl;

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  console.log(`Added @valtimo/sse: ${versionOrUrl}`);
}

function npmInstall() {
  console.log('Running npm install...');
  execSync('npm install', {cwd: rootDir, stdio: 'inherit'});
}

function findMatchingBracket(str, startIndex, open = '{', close = '}') {
  let depth = 0;
  for (let i = startIndex; i < str.length; i++) {
    if (str[i] === open) depth++;
    else if (str[i] === close) depth--;

    if (depth === 0) return i;
  }
  throw new Error(`No matching closing ${close} for opening ${open} at index ${startIndex}`);
}

function updateAppModule() {
  let content = fs.readFileSync(appModulePath, 'utf8');
  let updated = content;

  if (!updated.includes("from '@valtimo/sse'")) {
    const allImportsMatch = updated.match(/^import[\s\S]+?from\s+['"][^'"]+['"];/gm);
    if (!allImportsMatch) throw new Error('No import statements found.');

    const lastImport = allImportsMatch[allImportsMatch.length - 1];
    const insertIndex = updated.indexOf(lastImport) + lastImport.length;
    updated =
      updated.slice(0, insertIndex) +
      `\nimport { SseModule } from '@valtimo/sse';` +
      updated.slice(insertIndex);
  }

  const ngModuleStart = updated.indexOf('@NgModule');
  if (ngModuleStart === -1) throw new Error('@NgModule decorator not found.');

  const openParen = updated.indexOf('(', ngModuleStart);
  const openBrace = updated.indexOf('{', openParen);
  const closeBrace = findMatchingBracket(updated, openBrace);

  const ngModuleBlock = updated.slice(openBrace + 1, closeBrace);
  const importsStart = ngModuleBlock.indexOf('imports: [');
  if (importsStart === -1) throw new Error('Could not find "imports: [" inside @NgModule.');

  const importsOpenBracket = ngModuleBlock.indexOf('[', importsStart);
  const importsCloseBracket = findMatchingBracket(ngModuleBlock, importsOpenBracket, '[', ']');

  const originalImports = ngModuleBlock.slice(importsOpenBracket + 1, importsCloseBracket);
  const hasSse = originalImports.includes('SseModule');

  if (!hasSse) {
    const newImports = `${originalImports.trim().replace(/,\s*$/, '')}, SseModule`;
    const updatedNgModuleBlock =
      ngModuleBlock.slice(0, importsOpenBracket + 1) +
      newImports +
      ngModuleBlock.slice(importsCloseBracket);
    updated = updated.slice(0, openBrace + 1) + updatedNgModuleBlock + updated.slice(closeBrace);
    console.log('Appended SseModule to NgModule imports.');
  }

  fs.writeFileSync(appModulePath, updated);
}

function removeEnableTaskPanelFromEnvs() {
  const envFiles = fs.readdirSync(envDir).filter(f => f.endsWith('.ts'));

  for (const file of envFiles) {
    const filePath = path.join(envDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const before = content;
    content = content.replace(/^\s*enableTaskPanel\s*:\s*(true|false),?\s*\n?/gm, '');
    if (content !== before) {
      fs.writeFileSync(filePath, content);
      console.log(`Removed 'enableTaskPanel' from ${file}`);
    }
  }
}

try {
  console.log('Starting SSE module migration...');
  addSseDependency();
  npmInstall();
  updateAppModule();
  removeEnableTaskPanelFromEnvs();
  console.log('SSE module migration completed successfully.');
  process.exit(0);
} catch (err) {
  console.error('SSE module migration failed.');
  console.error(err);
  process.exit(1);
}
