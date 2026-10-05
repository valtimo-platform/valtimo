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

export const USER_DASHBOARD_CONFIG = {
  /**
   * The only dashboard a ROLE_USER may view. The user-facing dashboard list is filtered
   * by an access-control permission that is scoped to this exact key (see
   * `backend/apps/dev/src/main/resources/config/global/permission/dashboard.permission.json`),
   * so any other dashboard is invisible on the user dashboard regardless of its content.
   */
  dashboardKey: 'user-dashboard',
  /** Title of the seeded dashboard, rendered as the heading in the single-dashboard layout. */
  dashboardTitle: 'My dashboard',

  /** Widget keys seeded by `user-dashboard.dashboard.json`. */
  seededWidgets: {
    gauge: 'gauge_chart',
    donut: 'donut_chart',
  },

  /** Display type titles rendered inside the seeded widgets. */
  seededWidgetTitles: {
    gauge: 'Zaken zonder behandelaar',
    donut: 'Zaakstatussen',
  },

  /**
   * Widget added during the tests to prove a newly configured widget shows up for the
   * user. `number` is the registered display type key of the "Big number" widget — the
   * backend accepts any string, but the frontend only renders registered display types.
   */
  addedWidget: {
    titlePrefix: 'E2E User Dashboard Widget',
    dataSourceKey: 'case-count',
    displayType: 'number',
    displayTitle: 'E2E widget total',
    displaySubtitle: 'bezwaar',
    /** Route the widget navigates to when clicked. */
    url: '/cases/bezwaar',
  },

  /**
   * Widget with a display type that is not registered in the frontend. The backend stores
   * it, but the dashboard must silently skip it instead of rendering a broken widget.
   */
  unsupportedWidget: {
    titlePrefix: 'E2E Unsupported Widget',
    dataSourceKey: 'case-count',
    displayType: 'not-a-registered-display-type',
  },

  /** Case definition used to change the numbers the widgets report. */
  caseDefinitionKey: 'bezwaar',
  caseDefinitionVersionTag: '1.0.1',
  processDefinitionKey: 'bezwaar',
  processDocumentEndpoint: '/api/v1/process-document/operation/new-document-and-start-process',
  documentEndpoint: '/api/v1/document',

  /** Copy of the "no widgets" empty state (`dashboard.noWidgets` in `en.json`). */
  noWidgetsTitle: 'No widgets',
} as const;
