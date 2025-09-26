const fs = require('fs');
const path = require('path');

const LOCK_FILE_NAME = '.rebuilding.lock';
const rebuildLockFile = path.resolve(__dirname, LOCK_FILE_NAME);

function isRebuildInProgress() {
  return fs.existsSync(rebuildLockFile);
}

class WaitForRebuildLockPlugin {
  apply(compiler) {
    compiler.hooks.watchRun.tapAsync('PauseBeforeCompile', (params, callback) => {
      if (isRebuildInProgress()) {
        console.log('\nRebuild in progress. Pausing Webpack compilation...\n');

        waitForLockFileToBeRemoved(() => {
          console.log('\nRebuild finished. Resuming Webpack compilation...\n');
          callback();
        });
      } else {
        callback();
      }
    });
  }
}

function waitForLockFileToBeRemoved(callback) {
  const interval = setInterval(() => {
    if (!isRebuildInProgress()) {
      clearInterval(interval);
      callback();
    }
  }, 500);
}

module.exports = {
  plugins: [
    new WaitForRebuildLockPlugin(), // Custom plugin to pause/resume the watcher
  ],
};
