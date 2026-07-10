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

/**
 * One activated external-plugin `page` bundle, as returned by `GET /api/v1/external-plugin/menu-pages`.
 * The builder lists these under "Plugin pages"; the routed page wrapper renders the resolved
 * [bundleUrl]. [titleTranslations] localizes [title]; fall back to [title] then [configurationTitle].
 */
interface ExternalPluginMenuPage {
  configurationId: string;
  configurationTitle: string;
  bundleKey: string | null;
  bundleUrl: string | null;
  title: string | null;
  titleTranslations: Record<string, string>;
  icon: string | null;
}

interface ExternalPluginUserTokenResponse {
  userToken: string;
  expiresAt: string;
}

export {ExternalPluginMenuPage, ExternalPluginUserTokenResponse};
