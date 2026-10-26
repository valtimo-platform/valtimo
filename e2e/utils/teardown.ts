import {unlinkSync, existsSync} from 'fs';
import {disposeApi} from './api.utils';
import {ownsRunLock, releaseRunLock} from './run-lock';

export default async function globalTeardown() {
  const tokenFile = 'playwright/.auth/accessToken.json';
  const uiStateFile = 'playwright/.auth/uiState.json';

  // Only the run that claimed this checkout may remove the shared login.
  if (ownsRunLock()) {
    if (existsSync(tokenFile)) {
      unlinkSync(tokenFile);
      console.log('[TEARDOWN] Deleted access token file');
    }

    if (existsSync(uiStateFile)) {
      unlinkSync(uiStateFile);
      console.log('[TEARDOWN] Deleted uiState File');
    }
  }

  releaseRunLock();

  await disposeApi();
  console.log('[TEARDOWN] Disposed API context');
}
