Will create a test environment. This comment will be updated once it is available. This usually takes a few minutes.
Closing or merging this PR will automatically delete the test environment. Pushing commits to this PR will update the test environment.
Progress:

- [x] Created test environment
- [x] Images tagged `${FRONTEND_IMAGE_TAG}` (frontend) / `${BACKEND_IMAGE_TAG}` (backend) available
- [x] Started test environment
- [x] Test environment is running at ${TEST_ENV_URL}

Test environment metadata:

- URL: ${TEST_ENV_URL}
- Commit: ${COMMIT_SHA}
- Frontend contents: `${FRONTEND_CONTENTS_SHA}`
- Backend contents: `${BACKEND_CONTENTS_SHA}`
- Frontend image: `ghcr.io/valtimo-platform/valtimo/gzac-frontend:${FRONTEND_IMAGE_TAG}`
- Backend image: `ghcr.io/valtimo-platform/valtimo/gzac-backend:${BACKEND_IMAGE_TAG}`

Observability:

- [Grafana Metrics](${METRICS_URL})
- [Grafana Logs](${LOGS_URL})
