const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../');
const appModulePath = path.join(rootDir, 'src/app/app.module.ts');

let source = fs.readFileSync(appModulePath, 'utf-8');

// Modules to remove by source path
const modulesToRemoveMap = {
  '@valtimo/components': [
    'CardModule',
    'ListModule',
    'ButtonModule',
    'PageModule',
    'TitleModule',
    'VCardModule',
  ],
  '@valtimo/task-management': ['TaskManagementModule'],
};

// Reusable function to build regex for import removal
function buildImportRegex(moduleNames, fromPath) {
  return new RegExp(
    `import\\s*{[^}]*\\b(${moduleNames.join('|')})\\b[^}]*}\\s*from\\s*['"]${fromPath}['"];?\\s*`,
    'g'
  );
}

// Remove specified imports
Object.entries(modulesToRemoveMap).forEach(([importPath, moduleList]) => {
  const importRegex = buildImportRegex(moduleList, importPath);
  source = source.replace(importRegex, '');
});

// Flatten list of all modules to remove for usage cleanup
const allModulesToRemove = Object.values(modulesToRemoveMap).flat();

// Remove each module from NgModule arrays like imports, declarations, etc.
allModulesToRemove.forEach(module => {
  const regex = new RegExp(`\\s*${module}\\s*,?\\n?`, 'g');
  source = source.replace(regex, '');
});

// Remove CaseDetailTabContactMomentsComponent from arrays
source = source.replace(/,\s*CaseDetailTabContactMomentsComponent(?=[,\s}])/g, '');
source = source.replace(/CaseDetailTabContactMomentsComponent,\s*/g, '');
source = source.replace(/CaseDetailTabContactMomentsComponent(?=[,\s}])/g, '');

// Remove object property: contactmomenten: CaseDetailTabContactMomentsComponent
source = source.replace(
  /[ \t]*[,\n]?\s*contactmomenten\s*:\s*CaseDetailTabContactMomentsComponent\s*,?/g,
  ''
);

// Remove HttpClientModule import and usage
source = source.replace(/import\s*{\s*HttpClientModule\s*}\s*from\s*['"][^'"]+['"];\s*/g, '');
source = source.replace(/HttpClientModule,\s*\n/g, '');
source = source.replace(/\s*HttpClientModule\s*,?/g, '');

// === Add required modules ===
const requiredModules = ['BpmnJsDiagramModule', 'MenuModule', 'WidgetModule'];

// === Add required imports from components library ===
const requiredImports = [
  'enableCustomFormioComponents',
  'registerFormioCurrencyComponent',
  'registerFormioUploadComponent',
  'registerFormioFileSelectorComponent',
  'registerFormioValueResolverSelectorComponent',
];

// Step 1: Ensure they're in the import from @valtimo/components
const valtimoImportRegex = /import\s*{([^}]*)}\s*from\s*['"]@valtimo\/components['"];/;
if (valtimoImportRegex.test(source)) {
  source = source.replace(valtimoImportRegex, (match, imports) => {
    const importList = imports
      .split(',')
      .map(i => i.trim())
      .filter(Boolean);
    [...requiredModules, ...requiredImports].forEach(mod => {
      if (!importList.includes(mod)) {
        importList.push(mod);
      }
    });
    return `import { ${importList.join(', ')} } from '@valtimo/components';`;
  });
} else {
  // Add new import line near top
  source =
    `import { ${[...requiredModules, ...requiredImports].join(', ')} } from '@valtimo/components';\n` +
    source;
}

// Step 2: Add to @NgModule imports array (root-level only)
const ngModuleImportsStart = source.indexOf('imports: [');
if (ngModuleImportsStart !== -1) {
  const importsStart = source.indexOf('[', ngModuleImportsStart);
  let bracketCount = 1;
  let i = importsStart + 1;

  // Find where the imports array ends
  while (i < source.length && bracketCount > 0) {
    if (source[i] === '[') bracketCount++;
    if (source[i] === ']') bracketCount--;
    i++;
  }

  const importsArrayContent = source.slice(importsStart + 1, i - 1);
  const importEntries = importsArrayContent
    .split(',')
    .map(line => line.trim())
    .filter(Boolean);

  let changed = false;
  requiredModules.forEach(mod => {
    if (!importEntries.includes(mod)) {
      importEntries.push(mod);
      changed = true;
    }
  });

  if (changed) {
    const newImportsArray = '  imports: [\n    ' + importEntries.join(',\n    ') + '\n  ]';
    source = source.slice(0, ngModuleImportsStart) + newImportsArray + source.slice(i); // slice from end of original array
  }
}

fs.writeFileSync(appModulePath, source, 'utf-8');
console.log('AppModule updated successfully.');
