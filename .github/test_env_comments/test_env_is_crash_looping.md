Will create a test environment. This comment will be updated once it is available. This usually takes a few minutes.
Closing or merging this PR will automatically delete the test environment. Pushing commits to this PR will update the test environment.
Progress:

- [x] Create test environment
- [x] Images tagged `${IMAGE_TAG}` available
- [x] Started test environment
- [ ] Waiting for environment to run
  - The backend is crash-looping. Look at the logs to find out why.

Test environment metadata:

- URL: ${TEST_ENV_URL}
- Commit: ${COMMIT_SHA}
- Frontend contents: `${FRONTEND_CONTENTS_SHA}`
- Backend contents: `${BACKEND_CONTENTS_SHA}`
- Frontend image: `ghcr.io/valtimo-platform/valtimo/gzac-frontend:${IMAGE_TAG}`
- Backend image: `ghcr.io/valtimo-platform/valtimo/gzac-backend:${IMAGE_TAG}`

Observability:

- [Grafana Metrics](${METRICS_URL})
- [Grafana Logs](${LOGS_URL})
