# 12.16.0

## Bugfixes

* Supporting process modal now displays a loading spinner instead of the "No form linked" error while loading form data.

## Security improvements

* Cases can now have their content hidden via the `application.yml` by setting the 
  `valtimo.includeDocumentContentInResponse` property. This is set to true by default, and should be set to false as
  much as possible to prevent sending data that does not need to be shared.

**Breaking Change**  
As part of the security improvements, scripting in processes is now restricted by a whitelist.  
If your application uses custom scripting classes, you may need to whitelist them explicitly.

* A security advisory has been published [here](https://github.com/valtimo-platform/valtimo-backend-libraries/security/advisories/GHSA-w48j-pp7j-fj55).
* Users with administrator privileges previously had access to unnecessary resources through the scripting engine in processes.
* To mitigate this, Valtimo now restricts scripting access by default, allowing only a limited set of methods and classes.

For migration details, see: [Whitelisting Scripting classes](/features/process/process/whitelist-scripting-classes.md).
