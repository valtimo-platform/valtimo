#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const routingModulePath = path.resolve(__dirname, '../../src/app/app-routing.module.ts');

function updateRouterErrorHandler() {
  if (!fs.existsSync(routingModulePath)) {
    console.error('Could not find app-routing.module.ts');
    process.exit(1);
  }

  let content = fs.readFileSync(routingModulePath, 'utf8');

  if (content.includes('this.router.errorHandler')) {
    console.log('🔧 Found old router.errorHandler assignment. Updating...');

    content = content.replace(
      /this\.router\.errorHandler\s*=\s*\(\)\s*=>\s*{\s*this\.router\.navigate\(\['']\);\s*};?/gm,
      ''
    );

    content = content.replace(/,\s*Router/g, '');

    content = content.replace(/constructor\((\s*private router: Router,?\s*)\)\s*{[^}]*}/gm, '');

    content = content.replace(
      /RouterModule\.forRoot\(\s*routes\s*\)/,
      `RouterModule.forRoot(routes, {
  errorHandler: error => {
    window.location.href = '/';
  }
})`
    );

    fs.writeFileSync(routingModulePath, content);
    console.log('Updated AppRoutingModule to use new errorHandler format.');
  } else {
    console.log('ℹAppRoutingModule does not use legacy errorHandler. No changes made.');
  }

  console.log('Migration step completed.');
}

try {
  console.log('Starting migration step: Update Router errorHandler usage');
  updateRouterErrorHandler();
  process.exit(0);
} catch (err) {
  console.error('Migration step failed');
  console.error(err);
  process.exit(1);
}
