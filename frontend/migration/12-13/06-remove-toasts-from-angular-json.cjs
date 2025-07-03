const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../');
const angularJsonPath = path.join(rootDir, 'angular.json');

try {
  const angularJson = JSON.parse(fs.readFileSync(angularJsonPath, 'utf8'));

  function removeToastrCss(config) {
    if (config && Array.isArray(config.styles)) {
      config.styles = config.styles.filter(style => style !== 'node_modules/ngx-toastr/toastr.css');
    }
  }

  for (const projectName of Object.keys(angularJson.projects || {})) {
    const project = angularJson.projects[projectName];
    const buildOptions = project.architect?.build?.options;
    const testOptions = project.architect?.test?.options;

    removeToastrCss(buildOptions);
    removeToastrCss(testOptions);

    const configurations = project.architect?.build?.configurations;
    if (configurations) {
      for (const configName of Object.keys(configurations)) {
        removeToastrCss(configurations[configName]);
      }
    }
  }

  fs.writeFileSync(angularJsonPath, JSON.stringify(angularJson, null, 2));
  console.log('Removed "node_modules/ngx-toastr/toastr.css" from angular.json.');
  process.exit(0);
} catch (err) {
  console.error('Failed to update angular.json.');
  console.error(err);
  process.exit(1);
}
