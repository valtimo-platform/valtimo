# 13.1.2

## Security improvements

{% hint style="danger" %}
**Breaking Change**

As part of the security improvements, scripting in processes is now restricted by a whitelist. If your application uses custom scripting classes, you may need to whitelist them explicitly.
{% endhint %}

* A security advisory has been published [here](https://github.com/valtimo-platform/valtimo-backend-libraries/security/advisories/GHSA-w48j-pp7j-fj55).
* Users with administrator privileges previously had access to unnecessary resources through the scripting engine in processes.
* To mitigate this, Valtimo now restricts scripting access by default, allowing only a limited set of methods and classes.

For migration details, see: [Whitelisting Scripting classes](../../features/process/process/whitelist-scripting-classes.md).

## Bugfixes

* Improved the migration script for migrating Camunda web-app roles to the corresponding Operaton web-app roles. The 
application should no longer break when starting up when those Operaton web-app roles were already present before 
running the migrating.
