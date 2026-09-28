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

interface ExternalPluginWidgetContext {
  documentId: string;
  caseDefinitionKey: string;
  caseDefinitionVersionTag: string;
  pluginConfigurationId: string | null;
}

/**
 * Descriptor returned by the widget-data endpoint for an `external-plugin` widget. Mirrors the
 * case-tab content but the configuration id may be `null` (a widget that imported dangling), in
 * which case `bundleUrl` is `null` and the widget renders an unavailable state.
 */
interface ExternalPluginWidgetContent {
  bundleUrl: string | null;
  configurationId: string | null;
  bundleKey: string | null;
  context: ExternalPluginWidgetContext;
}

type ExternalPluginWidgetState = 'loading' | 'ready' | 'error' | 'unavailable';

export {ExternalPluginWidgetContext, ExternalPluginWidgetContent, ExternalPluginWidgetState};
