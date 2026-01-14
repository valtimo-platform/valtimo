# 12.23.0

## New Features

* The Zaken API plugin now supports a plugin action to Update a zaak.

## Enhancements

* **Better handling of file extensions in the Documenten API uploader FormIO component**

    - It is now possible to restrict allowed file types in the Documenten API uploader FormIO component.
    - The file extension will now always reflect the actual file type of the uploaded file even when we set the filename
      programmatically from within the documenten API uploader component.
