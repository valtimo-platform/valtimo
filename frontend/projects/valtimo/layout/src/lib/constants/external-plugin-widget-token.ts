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

import {InjectionToken} from '@angular/core';
import {Observable} from 'rxjs';

/** One `case-widget` bundle a plugin configuration exposes. */
interface ExternalPluginWidgetBundleOption {
  key: string | null;
  title: string;
}

/** An activated plugin configuration that exposes at least one `case-widget` bundle. */
interface ExternalPluginWidgetConfigOption {
  configId: string;
  label: string;
  bundles: ExternalPluginWidgetBundleOption[];
}

/**
 * Supplies the external-plugin widget config editor with the selectable plugin configurations +
 * their `case-widget` bundles. Implemented by an app that has `@valtimo/plugin` available (e.g.
 * case-management), so `@valtimo/layout` needs no dependency on `@valtimo/plugin` — mirrors
 * {@link CUSTOM_WIDGET_TOKEN}. When the token is absent the editor renders a disabled/empty state.
 */
interface ExternalPluginWidgetConfigProvider {
  getConfigOptions(): Observable<ExternalPluginWidgetConfigOption[]>;
}

const EXTERNAL_PLUGIN_WIDGET_CONFIG_TOKEN = new InjectionToken<ExternalPluginWidgetConfigProvider>(
  'Provides the selectable external-plugin configurations and their case-widget bundles.'
);

export {
  EXTERNAL_PLUGIN_WIDGET_CONFIG_TOKEN,
  ExternalPluginWidgetBundleOption,
  ExternalPluginWidgetConfigOption,
  ExternalPluginWidgetConfigProvider,
};
