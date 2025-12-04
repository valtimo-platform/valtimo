# 12.3.0

## New features

#### ZGW - save result after uploading documents

When a document has been uploaded, either on the documents-tab or as part of a task form, the configured 'upload process' is executed. As part of this process, the URL of the stored document in the Documenten API is now stored. Additionally, a REST API endpoint has been introduced to retrieve the stored data. This local storage of the document URL will be used in a future release to provide a download Form.io component for existing files, and to support the scenario of uploading a document thas has to be processed later.

















