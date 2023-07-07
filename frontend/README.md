# valtimo-frontend-libraries

This project contains a collection of front end libraries that can be used in Angular
implementation. These can be found under /projects/valtimo. To test the libraries, there's a
reference implementation under /src/app.

## Prerequisites:

Install NVM, see https://github.com/nvm-sh/nvm

Edit your .zshrc or .bashrc file to load NVM in your shell.

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

## Getting started

- Install all packages with `npm install --legacy-peer-deps`
- Then build all libraries with `npm run libs-build-all`
- And at last start the development server with `npm start`
- Remember that it is required to run the back-end libraries as well to use Valtimo

## Development server

Run `npm start` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically
reload if you change any of the source files.

## Build

If you have already built the libraries before(dist/valtimo/libraryName exists for all libraries)
all you need to do is run `npm run libs-build-all` to build all of the libraries. Use the `--prod`
flag for a production build. To build a specific library, just run `npm run libs:build:libraryName`.

When building the libraries for the first time you need to run `npm install --only=production`

## Code change watching

To watch for changes of a specific module, run `ng build @valtimo/libraryName --watch`

## Running the linter

To run TSLint on a specific library, run `npm run libs:lint:libraryName`.

## Code formatting

This project uses Prettier to format its code. run `prettier:check` to check for formatting errors,
and `prettier:write` to automatically fix any errors.

Please make sure your code conforms to the project's Prettier code formatting rules before
committing your code.

We advise to configure your IDE to automatically format files on save. For IntelliJ IDEA please
refer to [this page](https://www.jetbrains.com/help/idea/prettier.html#ws_prettier_install). For VS
Code you can refer to
[this guide](https://scottsauber.com/2017/06/10/prettier-format-on-save-never-worry-about-formatting-javascript-again/).

## Running unit tests

Run `npm run libs:test:libraryName` to execute unit tests.

## Contributing

For contributing code, please refer to the [coding guidelines](CODING-GUIDELINES.md).
