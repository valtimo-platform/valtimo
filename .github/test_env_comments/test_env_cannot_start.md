Will create a test environment. This comment will be updated once it is available. This usually takes a few minutes.
Closing or merging this PR will automatically delete the test environment. Pushing commits to this PR will update the test environment.
Progress:

- [x] Created test environment
- [x] Images tagged `${IMAGE_TAG}` available
- [ ] Starting test environment
  - Test environment failed to start for an unexpected reason. Please notify DevOps.
- [ ] Waiting for environment to run

Error: ${ERROR_MESSAGE}

Test environment metadata:

- Commit: ${COMMIT_SHA}
- Frontend contents: `${FRONTEND_CONTENTS_SHA}`
- Backend contents: `${BACKEND_CONTENTS_SHA}`
- Frontend image: `ghcr.io/valtimo-platform/valtimo/gzac-frontend:${IMAGE_TAG}`
- Backend image: `ghcr.io/valtimo-platform/valtimo/gzac-backend:${IMAGE_TAG}`
