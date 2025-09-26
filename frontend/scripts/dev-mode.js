const {spawn, spawnSync} = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
const orderedScriptNames = Object.keys(pkg.scripts);
const watchScripts = orderedScriptNames.filter(name => name.startsWith('libs:watch:'));

let current = 0;
let activeProcesses = [];
let hasStartedApp = false;

const rebuildLockFilePath = path.resolve(__dirname, '../.rebuilding.lock');

const skipInitialBuild = process.env.SKIP_BUILD === 'true';

const PORT_TO_CHECK = 4200;

function checkPortInUse(port = PORT_TO_CHECK) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

function getLibraryNameFromScript(scriptName) {
  return scriptName.replace('libs:watch:', '');
}

function createRebuildLock() {
  if (!fs.existsSync(rebuildLockFilePath)) {
    fs.writeFileSync(rebuildLockFilePath, 'rebuilding');
  }
}

function removeRebuildLock() {
  if (fs.existsSync(rebuildLockFilePath)) {
    fs.rmSync(rebuildLockFilePath);
  }
}

function getChokidarCommand(libName) {
  const pathGlob = `projects/valtimo/${libName}/**/*`;
  const rebuildScriptPath = path.resolve(__dirname, 'rebuild-lib.js');

  return `chokidar "${pathGlob}" --polling --await-write-finish --delay 300 -c "node ${rebuildScriptPath} ${libName}"`;
}

async function runNext() {
  if (current >= watchScripts.length) {
    if (!hasStartedApp) {
      console.log('\nAll libs are watching. Checking if app should start...\n');
      const inUse = await checkPortInUse(PORT_TO_CHECK);

      if (!inUse) {
        console.log('Launching app with: npm run start\n');
        const startProc = spawn('npm run start', {
          stdio: 'inherit',
          shell: true,
        });
        activeProcesses.push(startProc);
        hasStartedApp = true;
      } else {
        console.log(`Port ${PORT_TO_CHECK} in use. Skipping npm start.`);
        hasStartedApp = true;
      }
    }
    return;
  }

  const script = watchScripts[current];
  const libName = getLibraryNameFromScript(script);
  const chokidarCmd = getChokidarCommand(libName);
  const initialBuildCmd = `ng build @valtimo/${libName}`;

  if (!skipInitialBuild) {
    console.log(`\nBuilding library initially: @valtimo/${libName}`);
    createRebuildLock();

    const buildProc = spawn(initialBuildCmd, {shell: true});

    buildProc.stdout.on('data', data => {
      const str = data.toString();
      process.stdout.write(str);

      if (str.includes('Built Angular Package')) {
        console.log(`Initial library build done for: @valtimo/${libName}\n`);
        buildProc.stdout.removeAllListeners();
        removeRebuildLock();
        buildProc.kill();

        const watcherProc = spawn(chokidarCmd, {
          stdio: 'inherit',
          shell: true,
        });

        activeProcesses.push(watcherProc);
        current++;
        runNext();
      }
    });

    buildProc.stderr.on('data', data => {
      process.stderr.write(data.toString());
    });
  } else {
    console.log(`\nSkipping initial library build for: @valtimo/${libName}, starting watcher...\n`);
    const watcherProc = spawn(chokidarCmd, {
      stdio: 'inherit',
      shell: true,
    });

    activeProcesses.push(watcherProc);
    current++;
    runNext();
  }
}

function cleanup() {
  console.log('\nCleaning up child processes and temp files...\n');
  activeProcesses.forEach(p => {
    try {
      p.kill();
    } catch (err) {
      console.error('Failed to kill process:', err);
    }
  });

  removeRebuildLock();
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

runNext();
