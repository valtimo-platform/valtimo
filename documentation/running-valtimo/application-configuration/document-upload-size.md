# Configuring the document upload size limit

An upload passes through several layers, **each with its own maximum size** — a file is only accepted if it fits within
all of them. So an error like `Maximum upload size exceeded` means that one layer is still set too low.

| Layer                         | Default  | Setting                                                                                
|-------------------------------|----------|----------------------------------------------------------------------------------------|
| 1a. GZAC frontend             | **5 MB** | `caseFileSizeUploadLimitMB`                                                            |
| 1b. form.io upload component  | **5 MB** | `customOptions.maxFileSize`                                                            |
| 2. GZAC backend               | **1 MB** | `SPRING_SERVLET_MULTIPART_MAX_FILE_SIZE` & `SPRING_SERVLET_MULTIPART_MAX_REQUEST_SIZE` |
| 3. Documenten API (Open Zaak) | **4 GB** | `MIN_UPLOAD_SIZE`                                                                      |

## Layer 1 (GZAC frontend)

Angular `src/environment.(prod).ts` config, 50 MB example:

```
export const environment: ValtimoConfig = {
  ...
  caseFileSizeUploadLimitMB: 50
  ...
}
```

Form.io upload components, 50 MB example:

```
"customOptions": {"maxFileSize": 50, ...}
```

## Layer 2 (GZAC backend)

Environment properties, 50 MB example:

```
SPRING_SERVLET_MULTIPART_MAX_FILE_SIZE=50MB
SPRING_SERVLET_MULTIPART_MAX_REQUEST_SIZE=50MB
```

## Layer 3 (Documenten API)

Environment properties, 50 MB example:

```
MIN_UPLOAD_SIZE=52428800
```
