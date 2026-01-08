# Style guide

In order to keep the documentation in this repository consistent and accessible, refer to the style guidelines below
before contributing documentation.

# Language

## Spelling

All documentation is written in English, using American spelling. Refer to [this page](https://www.oxfordinternationalenglish.com/differences-in-british-and-american-spelling/)
for an overview of differences between American and British spelling.

## Formal writing voice

All documentation is written in a formal writing voice. For example, avoid the use of contractions or colloquial
language. Please refer to [this page](http://facultyweb.ivcc.edu/rrambo/tip_formal_writing_voice.htm) for a complete set
of instructions and examples.

* **Correct**: Do not attempt to solve the problem without consulting the support lead.
* **Incorrect**: Don't try to fix it without hitting up the support lead.

## General descriptions

General descriptions are written in the passive voice (as opposed to the active voice).

* **Correct**: Design tokens are used for customizing the application theme.
* **Incorrect**: You can use design tokens to customize your application theme.

## Instructions

Instructions are written in the passive voice or in the second person.

* **Correct**: This module is then imported.
* **Correct**: You then import this module.
* **Incorrect**: We then import this module.

## Abbreviations

The first time an abbreviation is used on a page, the fully written meaning should be included.

**For example**: it is recommended to use Node Version Manager (NVM)

# General guidelines

## Release notes

If possible, a release note should link to the documentation page of the related feature. For each release note, try to
give an example of its use case, and only go into technical detail when necessary.

### Features

Release notes for new features should convey clearly what functionality has been introduced, and how this functionality 
can be used.

Any required steps to use new functionality either go in the migration section if it is a one time action, or should
be listed on a separate page describing the feature so that people can find the usage in later versions.

## Introductions

Every page under the sections 'Introduction', 'Using Valtimo', and 'Extending Valtimo' should contain an introductory
paragraph at the top of the page. Try to mention use cases in this introduction. Under other sections, assess on a
case-by-case basis whether a page should contain an introduction.

## Screenshots

Adding screenshots is useful when writing instructions. All text contained in the screenshot should be in English.
Preferably show screenshots from the default Valtimo implementation, and remember to keep all screenshots up-to-date.

## External references

When including a reference to an external source, a link to the external documentation should be included when possible.

# Target audience

When contributing documentation under a certain section, be mindful of its target audience. Below is an overview of each
section and their respective target audience.

## Introduction

This section is intended for anyone interested in Valtimo. It should contain only general descriptions, and technical
details should be understandable for everyone.

## Contributing

This section is intended for developers who want to contribute to the Valtimo product through code. It contains
a description of how the product's release and branching strategy is set up. Moreover, it contains documentation
related to contributing to the product from a technical perspective.

## Creating your own Valtimo implementation

This section is intended for people with good technical knowledge, who would like to create their own Valtimo 
implementation.

## Using Valtimo

This section is intended for people who implement Valtimo using a low-code approach.

## Extending Valtimo

This section is intended for developers, who would like to extend Valtimo through code.

## References

This section is intended both for developers and for people who implement Valtimo using a low-code
approach.

## Release notes

This section is intended for non-technical stakeholders, low-code implementors, and developers.
