const fs = require('fs');
const path = require("path");
const rootDir = path.resolve(__dirname, '../../');
const appModulePath = path.join(rootDir, 'src/app/app.module.ts');

let source = fs.readFileSync(appModulePath, 'utf-8');

source = source.replace(/,\s*CardModule(?=[,\s}])/g, '');
source = source.replace(/CardModule,\s*/g, ''); // start of import
source = source.replace(/CardModule(?=[,\s}])/g, '');

source = source.replace(/CardModule,\s*\n/g, '');
source = source.replace(/\s*CardModule\s*,?/g, '');

source = source.replace(/,\s*CaseDetailTabContactMomentsComponent(?=[,\s}])/g, '');
source = source.replace(/CaseDetailTabContactMomentsComponent,\s*/g, '');
source = source.replace(/CaseDetailTabContactMomentsComponent(?=[,\s}])/g, '');

source = source.replace(
  /[ \t]*[,\n]?\s*contactmomenten\s*:\s*CaseDetailTabContactMomentsComponent\s*,?/g,
  ''
);

source = source.replace(/import\s*{\s*HttpClientModule\s*}\s*from\s*['"][^'"]+['"];\s*/g, '');

source = source.replace(/HttpClientModule,\s*\n/g, '');
source = source.replace(/\s*HttpClientModule\s*,?/g, '');

fs.writeFileSync(appModulePath, source, 'utf-8');

console.log('AppModule updated successfully.');
