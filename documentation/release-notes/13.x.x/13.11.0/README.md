# 13.11.0

{% hint style="info" %}
**Release date 14-01-2026**
{% endhint %}

## New Features

## Enhancements

* **Better handling of file extensions in the Documenten API uploader FormIO component**

  - It is now possible to restrict allowed file types in the Documenten API uploader FormIO component.
  - The file extension will now always reflect the actual file type of the uploaded file even when we set the filename
    programmatically from within the Documenten API uploader component.

* **Lazy loading for case widgets**
  - The case widgets are now loaded lazily to improve the performance of the case widget page.

## Bugfixes

* **Fixed pagination on choice field values page**

  - Pagination now correctly updates and allows switching pages on the choice field values page (/choice-fields/field/{id}).

* **Prevent an error when retrieving users from Keycloak with version 26.3.0 or newer.**
* **Fixed document type dropdown of the Documenten API upload field in start forms**
    - The document type dropdown in the Documenten API metadata modal is now correctly populated when uploading documents in start forms by using the case context as a fallback.
* **Fixed logging_event errors when the application was started with an empty database**
