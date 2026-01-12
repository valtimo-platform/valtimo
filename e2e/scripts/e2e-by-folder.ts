import { execSync } from 'child_process';

const [folder, testName]: (string | undefined)[] = process.argv.slice(2);

if (!folder) {
  console.error('❌ Please specify a folder.');
  process.exit(1);
}

const grepArg: string = testName ? `--grep ${testName}` : '';
const cmd: string = `npx playwright test ${folder} ${grepArg} --headed --reporter=html`;

console.log(`➡️ Running: ${cmd}`);
execSync(cmd, { stdio: 'inherit' });
