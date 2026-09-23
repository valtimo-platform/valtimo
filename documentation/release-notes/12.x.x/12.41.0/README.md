# 12.41.0

## Bugfixes

* **Documents tab no longer fails when a linked document is missing in the Documenten API**

  Documents that are still linked to the zaak but no longer exist in the Documenten API are
  now skipped (with a warning in the log), so the remaining documents of the case are still
  shown instead of an error. Pagination of the documents tab also no longer fails when
  skipped documents leave a page beyond the end of the result set, and deleting a case no
  longer fails when one of its linked documents is missing in the Documenten API.
