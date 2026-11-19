/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {apiDelete, apiGet, apiPut} from './api.utils';

const FEATURE_TOGGLE_USER_ENDPOINT = '/api/v1/admin-settings/feature-toggles';
const FEATURE_TOGGLE_MANAGEMENT_ENDPOINT = '/api/management/v1/admin-settings/feature-toggles';

/**
 * The frontend reads feature toggles at startup: reload the page after changing one.
 */
export async function getFeatureToggleOverridesViaApi(): Promise<Record<string, boolean>> {
  const response = await apiGet<{overrides: Record<string, boolean>}>(FEATURE_TOGGLE_USER_ENDPOINT);
  return response.overrides ?? {};
}

export async function setFeatureToggleViaApi(key: string, enabled: boolean): Promise<void> {
  await apiPut(FEATURE_TOGGLE_MANAGEMENT_ENDPOINT, {key, enabled});
}

/** Puts a toggle back: removes the override if there was none, otherwise restores the old value. */
export async function restoreFeatureToggleViaApi(
  key: string,
  original: boolean | undefined
): Promise<void> {
  if (original === undefined) {
    await apiDelete(`${FEATURE_TOGGLE_MANAGEMENT_ENDPOINT}/${key}`);
  } else {
    await setFeatureToggleViaApi(key, original);
  }
}
