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

import {expect, test} from '@playwright/test';
import {generateId} from '../../utils/dataGenerator';
import {UserDashboardPage, type WidgetConfiguration} from './page';
import {USER_DASHBOARD_CONFIG} from './user-dashboard-config';

test.use({storageState: 'playwright/.auth/uiState.json'});

test.describe('Feature 1 — Dashboard (User)', () => {
  let context;
  let page;
  let dashboardPage: UserDashboardPage;

  /** Widget configuration of the seeded dashboard, restored after the suite. */
  let seededWidgets: WidgetConfiguration[] = [];
  const createdWidgetKeys: string[] = [];
  const createdDashboardKeys: string[] = [];
  const createdCaseIds: string[] = [];

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({
      baseURL,
      storageState: 'playwright/.auth/uiState.json',
    });
    page = await context.newPage();
    dashboardPage = new UserDashboardPage(page);

    // Capture the seeded widget configuration so every test can restore the dashboard to
    // the state it found it in — the tests below add, remove and clear widgets.
    seededWidgets = await dashboardPage.getWidgetConfigurationsViaApi();
    expect(
      seededWidgets.length,
      'expected the seeded user-dashboard to have widgets configured'
    ).toBeGreaterThan(0);
  });

  test.afterAll(async () => {
    // Remove anything the tests created, children before parents.
    for (const widgetKey of createdWidgetKeys) {
      await dashboardPage.deleteWidgetViaApi(widgetKey);
    }
    for (const dashboardKey of createdDashboardKeys) {
      await dashboardPage.deleteDashboardViaApi(dashboardKey);
    }
    for (const documentId of createdCaseIds) {
      await dashboardPage.deleteCaseViaApi(documentId);
    }

    // Restore the seeded widget configuration last, so a test that failed midway through a
    // mutation cannot leave the dashboard empty for the rest of the suite.
    if (seededWidgets.length) {
      await dashboardPage.restoreWidgetsViaApi(seededWidgets);
    }

    await context.close();
  });

  test.describe('1.1 — Display widget-based dashboard', () => {
    test('loads the dashboard with its title and every configured widget', async () => {
      await dashboardPage.openDashboard();

      await expect(dashboardPage.title).toHaveText(USER_DASHBOARD_CONFIG.dashboardTitle);
      await expect(dashboardPage.widgetContainer).toBeVisible();

      await dashboardPage.assertWidgetVisible(USER_DASHBOARD_CONFIG.seededWidgets.gauge);
      await dashboardPage.assertWidgetVisible(USER_DASHBOARD_CONFIG.seededWidgets.donut);
      await dashboardPage.assertWidgetCount(seededWidgets.length);

      // The empty state must not be shown while widgets are present.
      await expect(dashboardPage.noWidgetsMessage).toHaveCount(0);
    });

    test('renders the configured display title inside each widget', async () => {
      await dashboardPage.openDashboard();

      await expect(dashboardPage.widget(USER_DASHBOARD_CONFIG.seededWidgets.gauge)).toContainText(
        USER_DASHBOARD_CONFIG.seededWidgetTitles.gauge
      );
      await expect(dashboardPage.widget(USER_DASHBOARD_CONFIG.seededWidgets.donut)).toContainText(
        USER_DASHBOARD_CONFIG.seededWidgetTitles.donut
      );
    });

    test('shows the "No widgets" empty state when the dashboard has no widgets', async () => {
      try {
        // Clearing the widget list is the only way to reach this state: the dashboard the
        // user may view is seeded with widgets.
        await dashboardPage.replaceWidgetsViaApi([]);
        await dashboardPage.openDashboard();

        await expect(dashboardPage.noWidgetsMessage).toBeVisible({timeout: 15_000});
        await expect(dashboardPage.noWidgetsMessage).toContainText(
          USER_DASHBOARD_CONFIG.noWidgetsTitle
        );
        await dashboardPage.assertWidgetCount(0);

        // The dashboard itself is still shown — only its content is empty.
        await expect(dashboardPage.title).toHaveText(USER_DASHBOARD_CONFIG.dashboardTitle);
      } finally {
        await dashboardPage.restoreWidgetsViaApi(seededWidgets);
      }
    });
  });

  test.describe('1.2 — Configure widgets per user/role', () => {
    test('adding a widget shows it to the user, removing it hides it again', async () => {
      const widgetTitle = `${USER_DASHBOARD_CONFIG.addedWidget.titlePrefix} ${generateId()}`;
      let widgetKey: string | undefined;

      try {
        await test.step('a newly configured widget appears on the dashboard', async () => {
          widgetKey = await dashboardPage.createWidgetViaApi({
            title: widgetTitle,
            dataSourceKey: USER_DASHBOARD_CONFIG.addedWidget.dataSourceKey,
            displayType: USER_DASHBOARD_CONFIG.addedWidget.displayType,
            displayTypeProperties: {
              title: USER_DASHBOARD_CONFIG.addedWidget.displayTitle,
              subtitle: USER_DASHBOARD_CONFIG.addedWidget.displaySubtitle,
            },
          });
          createdWidgetKeys.push(widgetKey);

          await dashboardPage.openDashboard();

          await dashboardPage.assertWidgetVisible(widgetKey);
          await expect(dashboardPage.widget(widgetKey)).toContainText(
            USER_DASHBOARD_CONFIG.addedWidget.displayTitle
          );
          await dashboardPage.assertWidgetCount(seededWidgets.length + 1);
        });

        await test.step('removing the widget hides it from the dashboard', async () => {
          await dashboardPage.deleteWidgetViaApi(widgetKey!);
          createdWidgetKeys.splice(createdWidgetKeys.indexOf(widgetKey!), 1);

          await dashboardPage.openDashboard();

          await dashboardPage.assertWidgetNotRendered(widgetKey!);
          await dashboardPage.assertWidgetCount(seededWidgets.length);
          // The widgets that were there before are untouched.
          await dashboardPage.assertWidgetVisible(USER_DASHBOARD_CONFIG.seededWidgets.gauge);
        });
      } finally {
        if (widgetKey) await dashboardPage.deleteWidgetViaApi(widgetKey);
      }
    });

    test('a dashboard the user has no view permission for is not shown', async () => {
      // Dashboard visibility is role-scoped: ROLE_USER may only view the dashboard whose key
      // the seeded access-control permission names. A dashboard created without such a
      // permission must stay invisible on the user dashboard.
      const dashboardTitle = `E2E Unpermitted Dashboard ${generateId()}`;
      const dashboardKey = await dashboardPage.createDashboardViaApi(
        dashboardTitle,
        'Created by the user-dashboard e2e test'
      );
      createdDashboardKeys.push(dashboardKey);

      const userDashboards = await dashboardPage.getUserDashboardsViaApi();
      expect(userDashboards.map(dashboard => dashboard.key)).not.toContain(dashboardKey);

      await dashboardPage.openDashboard();

      // Still the single-dashboard layout showing only the permitted dashboard.
      await expect(dashboardPage.title).toHaveText(USER_DASHBOARD_CONFIG.dashboardTitle);
      await expect(page.getByRole('tab', {name: dashboardTitle})).toHaveCount(0);
      await expect(dashboardPage.container).not.toContainText(dashboardTitle);
    });
  });

  test.describe('1.4 — Refresh widget data on open', () => {
    test('widget data is re-fetched and reflects new cases when the dashboard is re-opened', async () => {
      const gaugeKey = USER_DASHBOARD_CONFIG.seededWidgets.gauge;

      const dataBefore = await dashboardPage.openDashboard();
      const totalBefore = UserDashboardPage.widgetTotal(dataBefore, gaugeKey);
      expect(totalBefore, `expected widget data for "${gaugeKey}"`).not.toBeUndefined();

      // Change what the widget counts by adding a case to the underlying case definition.
      const documentId = await dashboardPage.createCaseViaApi();
      createdCaseIds.push(documentId);

      // Re-opening re-requests the widget data — openDashboard fails if it is not requested.
      const dataAfter = await dashboardPage.openDashboard();
      const totalAfter = UserDashboardPage.widgetTotal(dataAfter, gaugeKey);

      expect(totalAfter).toBeGreaterThan(totalBefore!);
      await dashboardPage.assertWidgetVisible(gaugeKey);
    });
  });

  test.describe('1.5 — Navigate from a widget to its linked route', () => {
    test('clicking a widget with a configured URL navigates to that route', async () => {
      const widgetTitle = `${USER_DASHBOARD_CONFIG.addedWidget.titlePrefix} link ${generateId()}`;
      let widgetKey: string | undefined;

      try {
        widgetKey = await dashboardPage.createWidgetViaApi({
          title: widgetTitle,
          dataSourceKey: USER_DASHBOARD_CONFIG.addedWidget.dataSourceKey,
          displayType: USER_DASHBOARD_CONFIG.addedWidget.displayType,
          displayTypeProperties: {title: USER_DASHBOARD_CONFIG.addedWidget.displayTitle},
          url: USER_DASHBOARD_CONFIG.addedWidget.url,
        });
        createdWidgetKeys.push(widgetKey);

        await dashboardPage.openDashboard();
        await dashboardPage.assertWidgetVisible(widgetKey);

        await dashboardPage.clickWidget(widgetKey);

        await page.waitForURL(
          url => url.pathname.startsWith(USER_DASHBOARD_CONFIG.addedWidget.url),
          {timeout: 15_000}
        );
      } finally {
        if (widgetKey) {
          await dashboardPage.deleteWidgetViaApi(widgetKey);
          const index = createdWidgetKeys.indexOf(widgetKey);
          if (index >= 0) createdWidgetKeys.splice(index, 1);
        }
      }
    });
  });

  test.describe('Failure scenarios (1.6)', () => {
    test('a widget with an unsupported display type is skipped without breaking the dashboard', async () => {
      // The backend accepts any display type string, but the frontend only renders display
      // types it has registered. An unknown one must be dropped silently — the rest of the
      // dashboard has to keep working.
      const widgetTitle = `${USER_DASHBOARD_CONFIG.unsupportedWidget.titlePrefix} ${generateId()}`;
      let widgetKey: string | undefined;

      try {
        widgetKey = await dashboardPage.createWidgetViaApi({
          title: widgetTitle,
          dataSourceKey: USER_DASHBOARD_CONFIG.unsupportedWidget.dataSourceKey,
          displayType: USER_DASHBOARD_CONFIG.unsupportedWidget.displayType,
        });
        createdWidgetKeys.push(widgetKey);

        // The widget is stored, so this really exercises the frontend filter.
        const stored = await dashboardPage.getWidgetConfigurationsViaApi();
        expect(stored.map(widget => widget.key)).toContain(widgetKey);

        await dashboardPage.openDashboard();

        await dashboardPage.assertWidgetNotRendered(widgetKey);
        await dashboardPage.assertWidgetCount(seededWidgets.length);
        await dashboardPage.assertWidgetVisible(USER_DASHBOARD_CONFIG.seededWidgets.gauge);
        await dashboardPage.assertWidgetVisible(USER_DASHBOARD_CONFIG.seededWidgets.donut);
        await expect(dashboardPage.noWidgetsMessage).toHaveCount(0);
      } finally {
        if (widgetKey) {
          await dashboardPage.deleteWidgetViaApi(widgetKey);
          const index = createdWidgetKeys.indexOf(widgetKey);
          if (index >= 0) createdWidgetKeys.splice(index, 1);
        }
      }
    });
  });
});
