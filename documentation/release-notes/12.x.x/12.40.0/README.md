# 12.40.0

## Security

* **Case documents can no longer be downloaded from the wrong case**

  When downloading or retrieving a case document, the application now checks that the document actually belongs to the
  case in the request before returning it. Previously this check was only applied when editing or deleting a document,
  so a signed-in user could retrieve a document from another case by referencing it directly. The read and download
  paths now enforce the same check.

* Updated several dependencies to address reported vulnerabilities.
