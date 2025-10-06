/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* Example usage:
 * npm run libs-publish-all -- ritense-nexus <npmtoken>
 * npm run libs-publish-all -- npmjs <npmtoken>
 * npm run libs-publish-all -- s3 <aws_access_key_id> <aws_secret_acces_key> 4.15.2
 */

const fs = require('fs');
const exec = require('child_process');
const path = require('path');

const destinationArg = process.argv.slice(2)[0];
if (!destinationArg) throw 'Invalid publish destination';

const accessKeyIdOrNpmToken = process.argv.slice(2)[1];
const secretAccessKey = process.argv.slice(2)[2];
const packageVersion = process.argv.slice(2)[3];

let destinationRegistry = 'localhost';
let accessModifier = '';
let bucketName = '';
switch (destinationArg) {
  case 'snapshot':
    destinationRegistry = 's3';
    if (!accessKeyIdOrNpmToken) throw 'Access key id must be set';
    if (!secretAccessKey) throw 'Secret access key must be set';
    if (!packageVersion) throw 'Package version must be set';
    bucketName = 'valtimo-snapshots/npm';
    break;
  case 'release':
    destinationRegistry = 'registry.npmjs.org/';
    if (!accessKeyIdOrNpmToken) throw 'Invalid npm token';
    accessModifier = ' --access public';
    break;
  case 'release-candidate':
    destinationRegistry = 's3';
    if (!accessKeyIdOrNpmToken) throw 'Access key id must be set';
    if (!secretAccessKey) throw 'Secret access key must be set';
    if (!packageVersion) throw 'Package version must be set';
    bucketName = 'valtimo-releases';
    break;
  default:
    console.error(`Invalid publishing option ${destinationArg}`);
    exit(1);
}

const distDir = path.resolve('./dist/valtimo');

if (!fs.existsSync(distDir)) {
  console.error(`Distribution directory not found: ${distDir}`);
  process.exit(1);
}

const packageDirs = fs
  .readdirSync(distDir)
  .filter(entry => fs.statSync(path.join(distDir, entry)).isDirectory());

if (!packageDirs.length) {
  console.error(`No libraries found to publish in ${distDir}.`);
  process.exit(1);
}

packageDirs.forEach(dir => {
  const packagePath = path.join(distDir, dir);
  if (destinationArg === 'npmjs') {
    fs.writeFileSync(
      path.join(packagePath, '.npmrc'),
      `@valtimo:registry=https://${destinationRegistry}\n` +
        `//${destinationRegistry}:_authToken=${accessKeyIdOrNpmToken}\n`
    );
    exec.execSync('npm publish' + accessModifier, {cwd: packagePath});
  }
  if (destinationArg.startsWith('s3')) {
    exec.execSync('npm pack', {cwd: packagePath});
    exec.execSync(
      `aws s3 cp --recursive --exclude \"*\" --include \"*.tgz\" . s3://${bucketName}/snapshots/${packageVersion}/`,
      {
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: accessKeyIdOrNpmToken,
          AWS_SECRET_ACCESS_KEY: secretAccessKey,
          AWS_DEFAULT_REGION: 'eu-central-1',
        },
        cwd: packagePath,
      }
    );
  }
});

console.log('Published all libraries');
