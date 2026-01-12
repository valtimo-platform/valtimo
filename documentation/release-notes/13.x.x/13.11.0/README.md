# 13.11.0

{% hint style="info" %}
**Release date ?-?-202?**  
{% endhint %}

## New Features

## Enhancements

* **Better handling of file extensions in the Documenten API uploader FormIO component**

  - It is now possible to restrict allowed file types in the Documenten API uploader FormIO component.
  - The file extension will now always reflect the actual file type of the uploaded file even when we set the filename 
  programmatically from within the documenten API uploader component.

## Bugfixes

* **Fixed pagination on choice field values page**

  - Pagination now correctly updates and allows switching pages on the choice field values page (/choice-fields/field/{id}).

