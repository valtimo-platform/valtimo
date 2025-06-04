const fs = require('fs');
const path = require('path');
const rootDir = path.resolve(__dirname, '../../');
const appModulePath = path.join(rootDir, 'src/app/app.module.ts');

let source = fs.readFileSync(appModulePath, 'utf-8');

// Modules to remove from @valtimo/components
const modulesToRemove = [
  'CardModule',
  'ListModule',
  'ButtonModule',
  'PageModule',
  'TitleModule',
  'VCardModule',
];

// Remove import line if it includes any of the target modules from @valtimo/components
const importRegex = new RegExp(
  `import\\s*{[^}]*\\b(${modulesToRemove.join('|')})\\b[^}]*}\\s*from\\s*['"]@valtimo/components['"];?\\s*`,
  'g'
);
source = source.replace(importRegex, '');

// Remove each module from NgModule arrays like imports, declarations, etc.
modulesToRemove.forEach(module => {
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

fs.writeFileSync(appModulePath, source, 'utf-8');

console.log('AppModule updated successfully.');
