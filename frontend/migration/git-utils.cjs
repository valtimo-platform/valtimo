const {execSync} = require('child_process');

function tryGitCommit(message) {
  try {
    execSync('git add .', {stdio: 'inherit'});

    const status = execSync('git status --porcelain').toString().trim();

    if (status === '') {
      console.log('Nothing to commit, working tree clean.');
      return;
    }

    execSync(`git commit -m "${message}"`, {stdio: 'inherit'});
  } catch (err) {
    console.warn(`Git commit failed: ${err.message}`);
  }
}

module.exports = {
  tryGitCommit,
};
