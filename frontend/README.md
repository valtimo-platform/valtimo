# valtimo-frontend-libraries

##Prerequisites:

Install nvm see https://github.com/nvm-sh/nvm

Edit your .zshrc or .bashrc file.

```
export PATH="$HOME/.jenv/bin:$PATH"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion" # This loads nvm bash_completion
if [ -f ".nvmrc" ]; then
  nvm install
  nvm use
fi
```
If not present, add a .bash_profile file
```
source ~/.bashrc
```

This project contains a collection of front end libraries that can be used in Angular implementation. These can be found under /projects/valtimo.
To test the libraries, there's a reference implementation under /src/app.

## Development server

Run `npm start` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Build

If you have already built the libraries before(dist/valtimo/libraryName exists for all libraries) all you need to do is run `npm run libs-build-all` to build all of the libraries. Use the `--prod` flag for a production build. To build a specific library, just run `npm run libs:build:libraryName`.

When building the libraries for the first time you need to run `npm install --only=production`

## Code change watching

To watch for changes of a specific module, run `ng build @valtimo/libraryName --watch`

## Running the linter

To run TSLint on a specific library, run `npm run libs:lint:libraryName`.

## Running unit tests

Run `npm run libs:test:libraryName` to execute unit tests.

## Running the mock API

We use json-server to mock APIs. To use it run `npm run mock`.
