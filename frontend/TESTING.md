# Testing

Unit tests have not been written consistently since the start of this project. At the time of writing, it was decided to
change this. When writing new code, please refer to the [testing policy](#policy) for a guideline on when to write unit
tests.

## Set-up

In this project, testing is done through [Jasmin](https://jasmine.github.io/) and [Karma](https://karma-runner.github.io/latest/index.html).

To run all unit tests in this project, make sure all dependencies are first installed through `npm install` and all libs
are built using the `libs-build-all` script in the root `package.json`. Next, run all the tests in this project with the
`libs-test-all` script in the root `package.json`.

To run all tests in a pipeline, use `libs-test-all-cicd`, which will run all tests using a headless Chrome browser.

To run tests for an individual library in watch mode, run its testing script from the root `package.json`, for example:
`libs:test:config`.

For instantiating tests, a single [`test.ts`](./src/test.ts) is shared by all libraries. In this file, [`ng-mocks`](https://github.com/help-me-mom/ng-mocks)
is initialized, which can subsequently used to mock inside unit tests.

## Policy

It is advised to write unit tests for all new components, directives, guards, pipes and services with a reasonable
degree of complexity. This is to make sure the code is free of bugs, and to make the intention of the code clear to
other developers.

Unit tests for elements with less complexity and obvious functionality (i.e. display components) are optional. Moreover,
unit tests for third-party dependencies are not required.
