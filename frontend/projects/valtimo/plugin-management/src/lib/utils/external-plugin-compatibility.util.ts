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

import {TranslateService} from '@ngx-translate/core';
import {ExternalPluginCompatibilityInfo} from '@valtimo/plugin';

/**
 * Builds the localized, non-blocking compatibility warning shown wherever an incompatible external
 * plugin surfaces (add-configuration modal, configuration table tooltip, upload confirmation).
 *
 * Keeps it simple: state that the version is incompatible, the version in use, and the supported
 * bounds — the maximum only when the plugin declares one. Single source of truth so every entry
 * point reads identically.
 */
export function buildExternalPluginCompatibilityMessage(
  info: ExternalPluginCompatibilityInfo,
  translateService: TranslateService
): string {
  const current = info.currentGzacVersion ?? '?';

  const parts: string[] = [
    translateService.instant('pluginManagement.compatibility.intro'),
    translateService.instant('pluginManagement.compatibility.current', {current}),
  ];

  if (info.minGzacVersion) {
    parts.push(
      translateService.instant('pluginManagement.compatibility.minimum', {min: info.minGzacVersion})
    );
  }
  if (info.maxGzacVersion) {
    parts.push(
      translateService.instant('pluginManagement.compatibility.maximum', {max: info.maxGzacVersion})
    );
  }

  return parts.join(' ');
}
