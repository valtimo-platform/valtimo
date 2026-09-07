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

import {expect, type Locator, type Page} from '@playwright/test';
import {endpoints} from '../../api/endpoints';
import {DASHBOARD_TEST_IDS, DASHBOARD_WIDGET_TEST_ID_PREFIX} from '../../constants';
import {apiDelete, apiGet, apiPost, apiPut} from '../../utils/api.utils';
import {USER_DASHBOARD_CONFIG} from './user-dashboard-config';

/** Widget configuration as returned by the management API. */
export interface WidgetConfiguration {
  key: string;
  title: string;
  dataSourceKey: string;
  displayType: string;
  dataSourceProperties: Record<string, unknown>;
  displayTypeProperties: Record<string, unknown>;
  url: string | null;
}

/** Dashboard as returned by the user-facing API, including its widgets. */
export interface UserDashboard {
  key: string;
  title: string;
  widgets: Array<{key: string; title: string; displayType: string; url: string | null}> | null;
}

/** One widget's data point as returned by the user-facing data endpoint. */
export interface WidgetData {
  key: string;
  data: Record<string, unknown>;
}

export class UserDashboardPage {
  constructor(private readonly page: Page) {}

  // ─── Locators ─────────────────────────────────────────────────────

  get container(): Locator {
    return this.page.getByTestId(DASHBOARD_TEST_IDS.container);
  }

  get title(): Locator {
    return this.page.getByTestId(DASHBOARD_TEST_IDS.title);
  }

  get widgetContainer(): Locator {
    return this.page.getByTestId(DASHBOARD_TEST_IDS.widgetContainer);
  }

  get noWidgetsMessage(): Locator {
    return this.page.getByTestId(DASHBOARD_TEST_IDS.noWidgets);
  }

  get noDashboardsMessage(): Locator {
    return this.page.getByTestId(DASHBOARD_TEST_IDS.noDashboards);
  }

  /** A single rendered widget, addressed by its widget key. */
  widget(widgetKey: string): Locator {
    return this.page.getByTestId(`${DASHBOARD_WIDGET_TEST_ID_PREFIX}${widgetKey}`);
  }

  /** All rendered widgets on the currently displayed dashboard. */
  get widgets(): Locator {
    return this.widgetContainer.locator(
      '[data-test-id^="' + DASHBOARD_WIDGET_TEST_ID_PREFIX + '"]'
    );
  }

  /** The clickable inner surface of a widget — this is what carries the click handler. */
  widgetContent(widgetKey: string): Locator {
    return this.widget(widgetKey).locator('.widget-configuration-content');
  }

  // ─── Navigation ───────────────────────────────────────────────────

  /**
   * Opens the user dashboard (the application root) and waits until the widget data of the
   * selected dashboard has been fetched, so widgets are rendered before assertions run.
   *
   * This always performs a fresh navigation, so it doubles as a reload that picks up widget
   * configuration changes made through the API. It deliberately does not use `page.reload()`:
   * a test that clicked through to a widget's linked route would otherwise reload that route
   * instead of the dashboard, and the widget data would never be requested.
   *
   * Returns the widget data the dashboard received, which lets tests assert on the numbers
   * the widgets report without reading them out of chart SVG internals.
   */
  async openDashboard(): Promise<WidgetData[]> {
    const dataResponse = this.page.waitForResponse(
      res =>
        res.url().includes(endpoints.userDashboard.data(USER_DASHBOARD_CONFIG.dashboardKey)) &&
        res.request().method() === 'GET' &&
        res.ok(),
      {timeout: 30_000}
    );

    await this.page.goto('/');

    const data = (await (await dataResponse).json()) as WidgetData[];
    await expect(this.container).toBeVisible({timeout: 15_000});
    return data;
  }

  // ─── Assertions ───────────────────────────────────────────────────

  async assertWidgetVisible(widgetKey: string) {
    await expect(this.widget(widgetKey)).toBeVisible({timeout: 15_000});
  }

  async assertWidgetNotRendered(widgetKey: string) {
    await expect(this.widget(widgetKey)).toHaveCount(0);
  }

  /** Waits until exactly `count` widgets are rendered — Muuri mounts them one by one. */
  async assertWidgetCount(count: number) {
    await expect(this.widgets).toHaveCount(count, {timeout: 15_000});
  }

  // ─── Widget interactions ──────────────────────────────────────────

  /**
   * Clicks a widget that has a `url` configured and waits for the resulting navigation.
   * Clicks near the widget's top-left corner so the click lands on the widget surface
   * rather than on chart internals that swallow the event.
   */
  async clickWidget(widgetKey: string) {
    await this.widgetContent(widgetKey).click({position: {x: 4, y: 4}});
  }

  // ─── API helpers: dashboards ──────────────────────────────────────

  async getUserDashboardsViaApi(): Promise<UserDashboard[]> {
    return apiGet<UserDashboard[]>(endpoints.userDashboard.getAll);
  }

  async createDashboardViaApi(title: string, description: string): Promise<string> {
    const result = await apiPost<{key: string}>(endpoints.dashboard.create, {title, description});
    return result.key;
  }

  async deleteDashboardViaApi(key: string) {
    try {
      await apiDelete(endpoints.dashboard.delete(key));
    } catch {
      // Already deleted or never created
    }
  }

  // ─── API helpers: widgets ─────────────────────────────────────────

  async getWidgetConfigurationsViaApi(): Promise<WidgetConfiguration[]> {
    return apiGet<WidgetConfiguration[]>(
      endpoints.dashboard.widgetConfigurations(USER_DASHBOARD_CONFIG.dashboardKey)
    );
  }

  /**
   * Adds a widget to the seeded dashboard and returns its generated key.
   * The key is derived from the title by the backend, so it is read back from the response
   * instead of being guessed.
   */
  async createWidgetViaApi(widget: {
    title: string;
    dataSourceKey: string;
    displayType: string;
    dataSourceProperties?: Record<string, unknown>;
    displayTypeProperties?: Record<string, unknown>;
    url?: string | null;
  }): Promise<string> {
    const result = await apiPost<{key: string}>(
      endpoints.dashboard.widgetConfigurations(USER_DASHBOARD_CONFIG.dashboardKey),
      {
        title: widget.title,
        dataSourceKey: widget.dataSourceKey,
        displayType: widget.displayType,
        dataSourceProperties: widget.dataSourceProperties ?? {
          documentDefinition: USER_DASHBOARD_CONFIG.caseDefinitionKey,
          queryConditions: [],
        },
        displayTypeProperties: widget.displayTypeProperties ?? {},
        url: widget.url ?? null,
      }
    );
    return result.key;
  }

  async deleteWidgetViaApi(widgetKey: string) {
    try {
      await apiDelete(
        endpoints.dashboard.widgetConfiguration(USER_DASHBOARD_CONFIG.dashboardKey, widgetKey)
      );
    } catch {
      // Already deleted or never created
    }
  }

  /**
   * Replaces the full widget list of the seeded dashboard. Passing an empty array removes
   * every widget, which is how the "no widgets" empty state is reached; passing a
   * previously captured list restores the dashboard exactly, including widget order.
   */
  async replaceWidgetsViaApi(widgets: WidgetConfiguration[]) {
    await apiPut(
      endpoints.dashboard.widgetConfigurations(USER_DASHBOARD_CONFIG.dashboardKey),
      widgets
    );
  }

  /** Restores the seeded widget configuration, tolerating a partially broken state. */
  async restoreWidgetsViaApi(widgets: WidgetConfiguration[]) {
    try {
      await this.replaceWidgetsViaApi(widgets);
    } catch {
      // Leave cleanup of the remaining resources to run
    }
  }

  // ─── API helpers: cases ───────────────────────────────────────────

  /** Creates a bezwaar case, which increases the counts the seeded widgets report. */
  async createCaseViaApi(): Promise<string> {
    const response = await apiPost<{document: {id: string}}>(
      USER_DASHBOARD_CONFIG.processDocumentEndpoint,
      {
        processDefinitionKey: USER_DASHBOARD_CONFIG.processDefinitionKey,
        request: {
          definition: USER_DASHBOARD_CONFIG.caseDefinitionKey,
          caseDefinitionKey: USER_DASHBOARD_CONFIG.caseDefinitionKey,
          caseDefinitionVersionTag: USER_DASHBOARD_CONFIG.caseDefinitionVersionTag,
          content: {},
        },
      }
    );
    return response.document.id;
  }

  async deleteCaseViaApi(documentId: string) {
    try {
      await apiDelete(`${USER_DASHBOARD_CONFIG.documentEndpoint}/${documentId}`);
    } catch {
      // Already deleted or permission denied
    }
  }

  // ─── Data helpers ─────────────────────────────────────────────────

  /** Reads the `total` a `case-count` widget reported in a widget data payload. */
  static widgetTotal(data: WidgetData[], widgetKey: string): number | undefined {
    const entry = data.find(item => item.key === widgetKey);
    return entry?.data?.total as number | undefined;
  }

  /** Reads the `value` a `case-count` widget reported in a widget data payload. */
  static widgetValue(data: WidgetData[], widgetKey: string): number | undefined {
    const entry = data.find(item => item.key === widgetKey);
    return entry?.data?.value as number | undefined;
  }
}
