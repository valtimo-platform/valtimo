# Documentation

The Valtimo product team aims to deliver new functionality to its users quickly. Contributions from outside the core development team are very much appreciated and welcomed. Part of making a contribution to Valtimo is writing clear and accessible documentation.

## Writing documentation

There are two different circumstances for which documentation for Valtimo can be written.

* Either because it is related to a particular change in the product that will be included in an upcoming release.
* Or to add something that is not related to an upcoming release, e.g. fixing spelling errors or documenting part of an already existing feature.

### Documentation related to an upcoming release <a href="#writing-documentation-related-to-an-upcoming-release" id="writing-documentation-related-to-an-upcoming-release"></a>

1. Write documentation/release notes. These should be written as a PR for [this repository](https://github.com/valtimo-platform/valtimo-documentation/tree/main).
   * Information on what language to use, as well as general guidelines can be found [here](https://github.com/valtimo-platform/valtimo-documentation/blob/story/restructure-docs/contributing/style-guide/README.md).
   * Release notes to in the `release-notes` package.
   * If new pages are added, these should also be added to `SUMMARY.md`. The sidebar shown on GitBook corresponds to this structure.
   * It is required to fork the repository to implement the changes and create the PR.
2. The Valtimo team will merge the PR after approval.

### Documentation unrelated to an upcoming release <a href="#writing-documentation-unrelated-to-an-upcoming-release" id="writing-documentation-unrelated-to-an-upcoming-release"></a>

1. In case of a new page, discuss the documentation you want to write with someone from the Valtimo team.
2. Write documentation. This should be written as a PR for [this repository](https://github.com/valtimo-platform/valtimo-documentation). Make a branch from the `main` branch, add all [team Valtimo developers](https://github.com/orgs/valtimo-platform/teams/valtimo-product-team/members) to this PR as reviewers.
3. Merge the branch after getting an approval from the Valtimo team.

## Style guide

In order to keep the documentation in this repository consistent and accessible, refer to the style guidelines below before contributing to the documentation.

{% tabs %}
{% tab title="Language" %}
#### Spelling

All documentation is written in English, using American spelling. Refer to [this page](https://www.oxfordinternationalenglish.com/differences-in-british-and-american-spelling/) for an overview of differences between American and British spelling.

#### Formal writing voice

All documentation is written in a formal writing voice. For example, avoid the use of contractions or colloquial language. Please refer to [this page](http://facultyweb.ivcc.edu/rrambo/tip_formal_writing_voice.htm) for a complete set of instructions and examples.

* **Correct**: Do not attempt to solve the problem without consulting the support lead.
* **Incorrect**: Don't try to fix it without hitting up the support lead.

#### General descriptions

General descriptions are written in the passive voice (as opposed to the active voice).

* **Correct**: Design tokens are used for customizing the application theme.
* **Incorrect**: You can use design tokens to customize your application theme.

#### Instructions

Instructions are written in the passive voice or in the second person.

* **Correct**: This module is then imported.
* **Correct**: You then import this module.
* **Incorrect**: We then import this module.

#### Abbreviations

The first time an abbreviation is used on a page, the fully written meaning should be included.

**For example**: it is recommended to use Node Version Manager (NVM)
{% endtab %}

{% tab title="General guidelines" %}
#### Release notes

If possible, a release note should link to the documentation page of the related feature. For each release note, try to give an example of its use case, and only go into technical detail when necessary.

**Features**

Release notes for new features should convey clearly what functionality has been introduced, and how this functionality can be used.

Any required steps to use new functionality either go in the migration section if it is a one time action, or should be listed on a separate page describing the feature so that people can find the usage in later versions.

#### Introductions

Every page under the sections 'Introduction', 'Using Valtimo', and 'Extending Valtimo' should contain an introductory paragraph at the top of the page. Try to mention use cases in this introduction. Under other sections, assess on a case-by-case basis whether a page should contain an introduction.

#### Screenshots

Adding screenshots is useful when writing instructions. All text contained in the screenshot should be in English. Preferably show screenshots from the default Valtimo implementation, and remember to keep all screenshots up-to-date.

#### External references

When including a reference to an external source, a link to the external documentation should be included when possible.
{% endtab %}

{% tab title="Target audience" %}
When contributing documentation under a certain section, be mindful of its target audience.
{% endtab %}
{% endtabs %}
