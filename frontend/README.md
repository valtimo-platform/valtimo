## Welcome to the Valtimo frontend

This folder contains:

- A collection of Angular libraries that together form the Valtimo frontend.
- The `app` module, containing an Angular application, used for library development.

### Starting the Valtimo platform

Starting up the Valtimo platform requires two steps:

1. Starting the Valtimo backend. Instructions can be found
   [here](../backend/README.md#starting-the-valtimo-backend-from-source)
2. Starting the Valtimo frontend. Instructions can be found
   [here](#starting-the-valtimo-frontend-from-source)

### Starting the Valtimo frontend from source

#### Prerequisites: node

1. Install `nvm`. More information can be found [here](https://github.com/nvm-sh/nvm)
2. Install Node v20: `nvm install 20 && nvm use 20`

#### Install dependencies

Run the following command to install the dependencies: `npm install`.

#### Start application

- Run the following command to start the Angular application: `npm start`.
- When this command has been completed, navigate to `http://localhost:4200/`
- Library source changes are picked up automatically (no separate build step needed for development).

#### Build libraries (for publishing)

Run the following command to build all the Valtimo libraries: `npm run libs-build-all`.
This is only needed for CI/CD and publishing, not for local development.

### Code quality

#### Running the linter

To run TSLint on a specific library, run `npm run libs:lint:libraryName`.

#### Code formatting

Valtimo uses Prettier to format its code. Run the `prettier:check` command to check for formatting
errors, and `prettier:write` to automatically fix any errors.

We advise to configure your IDE to automatically format files on save.

- For IntelliJ IDEA please refer to
  [this page](https://www.jetbrains.com/help/idea/prettier.html#ws_prettier_install).
- For VS Code you can refer to
  [this guide](https://scottsauber.com/2017/06/10/prettier-format-on-save-never-worry-about-formatting-javascript-again/).

Please make sure your code conforms to the project's Prettier code formatting rules before raising a
Pull Request.

#### Running unit tests

Run the following command to run the unit tests: `npm run libs:test:libraryName`.

#### Code guidelines

For contributing code, please refer to the [coding guidelines](CODING-GUIDELINES.md).

