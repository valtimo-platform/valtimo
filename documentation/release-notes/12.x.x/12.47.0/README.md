# 12.47.0

## Bugfixes

* **Users only see related files they have permission to view**

  The list of files related to a case (`GET /api/v1/zaken-api/document/{documentId}/files`) was returned without
  checking the `view_list` permission on ZGW documents, so users without that permission could still see which
  files belong to the case. The list is now empty for those users. This applies when
  `valtimo.authorization.zgwDocuments.enabled` is set to `true`.
