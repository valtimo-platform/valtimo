const {spawnSync} = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// ANSI escape code for green text
const green = text => `\x1b[32m${text}\x1b[0m`;

function startPrompt(callback) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promptMessage = `
You're about to upgrade your Valtimo front-end project from version 12 to 13.

Before continuing:
• Make sure your working directory is clean (no uncommitted changes).
• Create a temporary branch manually — this script does not create one for you.

This script performs automated migration steps and commits them along the way.
While it aims to be accurate, every project is different — some adjustments may be needed afterward.

You can:
• Manually fix any small issues that arise, or
• Follow the manual migration steps instead.

When prompted, do *not* enable the new application builder.

We recommend enabling all other optional Angular migration suggestions.

Press Y to continue, or N to cancel:
`;

  rl.question(promptMessage, answer => {
    const response = answer.trim().toLowerCase();

    if (response !== 'y') {
      console.log('Migration aborted.');
      rl.close();
      process.exit(0);
    }

    rl.close();
    callback();
  });
}

function runMigrationSteps() {
  const stepsDir = __dirname;
  const stepFiles = fs
    .readdirSync(stepsDir)
    .filter(f => /^\d{2}.*\.cjs$/.test(f))
    .sort();

  for (const step of stepFiles) {
    const stepPath = path.join(stepsDir, step);
    console.log(`Running step: ${green(step)}`);

    const result = spawnSync('node', [stepPath], {stdio: 'inherit'});

    if (result.status !== 0) {
      console.error(`Migration stopped at ${step}`);
      process.exit(1);
    }
  }

  console.log(green('All migration steps completed successfully.'));
}

startPrompt(runMigrationSteps);
