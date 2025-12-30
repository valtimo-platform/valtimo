import { unlinkSync, existsSync } from 'fs';
import { disposeApi } from './api.utils';

export default async function globalTeardown() {
  const tokenFile = 'playwright/.auth/accessToken.json';
  const uiStateFile = 'playwright/.auth/uiState.json';

  if (existsSync(tokenFile)) {
    unlinkSync(tokenFile);
    console.log('[TEARDOWN] Deleted access token file');
  }

  if (existsSync(uiStateFile)) {
    unlinkSync(uiStateFile);
    console.log('[TEARDOWN] Deleted uiState File');
  }

  await disposeApi();
  console.log('[TEARDOWN] Disposed API context');
}
