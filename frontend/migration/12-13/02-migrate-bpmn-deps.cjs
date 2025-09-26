const fs = require('fs');
const path = require('path');
const {tryGitCommit} = require('../git-utils.cjs');

const rootDir = path.resolve(__dirname, '../../');
const pkgPath = path.join(rootDir, 'package.json');
const angularJsonPath = path.join(rootDir, 'angular.json');

const updatedDeps = {
  '@webcomponents/custom-elements': '1.6.0',
  'core-js': '3.36.0',
  'dmn-js': '12.3.0',
  dropzone: '6.0.0-beta.2',
  rxjs: '7.8.1',
  'swagger-ui': '5.4.2',
  tslib: '2.6.2',
  'zone.js': '0.14.4',
  '@bpmn-io/dmn-migrate': '0.4.3',
  '@bpmn-io/properties-panel': '3.25.0',
  'bpmn-js': '18.0.0',
  'bpmn-js-properties-panel': '5.26.0',
  'camunda-bpmn-js-behaviors': '1.7.0',
  'camunda-bpmn-moddle': '7.0.1',
  'diagram-js': '15.2.1',
  '@ngx-translate/core': '16.0.4',
  '@ngx-translate/http-loader': '16.0.1',
};

try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.dependencies = pkg.dependencies || {};

  for (const dep of Object.keys(updatedDeps)) {
    if (pkg.devDependencies && pkg.devDependencies[dep]) {
      delete pkg.devDependencies[dep];
    }
    pkg.dependencies[dep] = updatedDeps[dep];
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  console.log('Updated package.json dependencies.');

  let angularJson = fs.readFileSync(angularJsonPath, 'utf8');
  const oldPath = 'node_modules/bpmn-js-properties-panel/dist/assets/bpmn-js-properties-panel.css';
  const newPath = 'node_modules/@bpmn-io/properties-panel/dist/assets/properties-panel.css';

  if (angularJson.includes(oldPath)) {
    angularJson = angularJson.replace(oldPath, newPath);
    fs.writeFileSync(angularJsonPath, angularJson);
    console.log('Updated angular.json BPMN CSS path.');
  } else {
    console.warn('Old BPMN CSS path not found in angular.json. Skipping update.');
  }

  tryGitCommit('Migrate BPMN dependencies');

  console.log('BPMN dependency migration completed successfully.');
  process.exit(0);
} catch (err) {
  console.error('BPMN dependency migration failed.');
  console.error(err);
  process.exit(1);
}
