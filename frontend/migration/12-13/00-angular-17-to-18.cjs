const {execSync} = require('child_process');
const {tryGitCommit} = require('../git-utils.cjs');
const fs = require('fs');
const path = require('path');

try {
  console.log('Updating gitignore file..');

  const gitignorePath = path.join(__dirname, '../..', '.gitignore');
  const gitignoreExists = fs.existsSync(gitignorePath);
  if (gitignoreExists) {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    if (!content.includes('migration')) {
      fs.appendFileSync(gitignorePath, '\nmigration\n');
      console.log('Added "migration" to .gitignore');
    } else {
      console.log('"migration" already exists in .gitignore');
    }
  } else {
    console.warn('.gitignore not found, skipping update.');
  }

  console.log('Updating Angular to version 18...');

  execSync('npm install', {stdio: 'inherit'});
  console.log('Committing npm install...');
  tryGitCommit('Run npm install');

  execSync('./node_modules/.bin/ng update @angular/core@18 @angular/cli@18 --force', {
    stdio: 'inherit',
  });

  console.log('Committing Angular upgrade...');
  tryGitCommit('Upgrade Angular from 17 to 18');

  console.log('Angular upgrade completed successfully.');
  process.exit(0);
} catch (err) {
  console.error('Angular upgrade failed.');
  process.exit(1);
}
