const {execSync} = require('child_process');
const {tryGitCommit} = require('../git-utils.cjs');

try {
  console.log('Updating Angular to version 19...');
  execSync('./node_modules/.bin/ng update @angular/core@19 @angular/cli@19 --force', {
    stdio: 'inherit',
  });

  console.log('Committing Angular upgrade...');
  tryGitCommit('Upgrade Angular from 18 to 19');

  console.log('Angular upgrade completed successfully.');
  process.exit(0);
} catch (err) {
  console.error('Angular upgrade failed.');
  process.exit(1);
}
