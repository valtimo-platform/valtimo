# 📖 How to use this documentation

Since there are multiple ways to approach case and process implementations in Valtimo we've structured the documentation to support this. The documentation structure is feature based. Documentation is written for each feature explaining the available functionality for that feature and how to configure the feature.\
\
Instructions are available for configuration via the User Interface (**UI**) or directly in the source code via an Integrated Development Environment (**IDE**).\
\
Within each feature the following subjects are documented:

* **Required knowledge indication**\
  &#xNAN;_&#x49;f applicable the knowledge pre-requisites for that feature are listed_
* **Feature description and explanation**\
  &#xNAN;_&#x57;hat is the primary function of the feature, what does it do._
* **Feature configuration via UI and IDE**\
  &#xNAN;_&#x44;ocumentation on how to configure the feature._
* **For developers**\
  &#xNAN;_&#x54;echnical documentation for the feature written primarily for software developers. These pages can help when altering a feature to your own needs or if you would like to extend certain features._

{% hint style="info" %}
The "**For developers**" section in each feature always has the knowledge pre-requisite on software development. More detailed technical feature information on the Java/Kotlin and Angular code is given in these sections.
{% endhint %}

### Required knowledge indication

If certain skills are required to understand certain pages in the documentation then this will be displayed in a Hint at the top of the page like so:

{% hint style="info" %}
This page requires:

* Knowledge of \<subject x>
* Knowledge of \<subject y>
{% endhint %}

### Written for multiple disciplines

If a page contains instructions for configurations in Valtimo then these instructions are displayed in Tabs for working via the UI and for working with an IDE like so:

{% tabs %}
{% tab title="Via UI" %}
These are the instructions for configuring via the UI.
{% endtab %}

{% tab title="Via IDE" %}
Follow these instructions to configure via the IDE.
{% endtab %}
{% endtabs %}

### Heads-up

Important information in a certain feature will be outlined in a Hint or Warning like so:

{% hint style="warning" %}
<mark style="color:orange;">**Please note**</mark>

Changes to document definitions **have immediate effect on newly created cases** based on this document definition. Changing this file means changing the blueprint that is used to validate each case that is created in Valtimo based on this blueprint. Changes will have impact, so create backups when unsure of the result.
{% endhint %}
