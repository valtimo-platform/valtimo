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

export const DASHBOARD_TEST_IDS = {
  /** Wrapper around the whole user-facing dashboard view. */
  container: 'dashboardContainer',
  /** Title shown when the user has access to exactly one dashboard. */
  title: 'dashboardTitle',
  /** Empty state shown when the user has access to no dashboards at all. */
  noDashboards: 'dashboardNoDashboards',
  /** Grid that holds the rendered widgets of the selected dashboard. */
  widgetContainer: 'dashboardWidgetContainer',
  /** Empty state shown when the selected dashboard has no (supported) widgets. */
  noWidgets: 'dashboardNoWidgets',
  /** Spinner shown while the widget data of the selected dashboard is loading. */
  loading: 'dashboardLoading',
} as const;

/**
 * Prefix for a single rendered widget on the user-facing dashboard. The full test id
 * is `dashboardWidget-<widget key>`, e.g. `dashboardWidget-gauge_chart`.
 *
 * Only widgets whose `displayType` is registered in the frontend are rendered, so a
 * widget with an unsupported display type has no element and therefore no test id.
 */
export const DASHBOARD_WIDGET_TEST_ID_PREFIX = 'dashboardWidget-';
