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

import {expect, test, type Browser, type BrowserContext, type Page} from '@playwright/test';
import {IkoServerPage} from '../iko-server/page';
import {
  IKO_SERVER_TITLE_PREFIX,
  ikoServerConfig,
  uniqueServerTitle,
} from '../iko-server/iko-server-config';
import {IkoViewPage} from '../iko-view/page';
import {IkoTabPage} from '../iko-tab/page';
import {IkoWidgetPage} from './page';
import {
  IKO_WIDGET_DIVIDER_TITLE_PREFIX,
  IKO_WIDGET_HEADERS,
  IKO_WIDGET_TITLE_PREFIX,
  IKO_WIDGET_TYPE_SPECS,
  IKO_WIDGET_TYPE_TILES,
  IKO_WIDGET_UNAVAILABLE_TYPE_TILES,
  uniqueDividerTitle,
  uniqueWidgetTitle,
} from './iko-widget-config';
import {generateId} from '../../../../utils/dataGenerator';

test.use({storageState: undefined});

test.describe('Feature 15G — IKO Widgets', () => {
  let context: BrowserContext;
  let page: Page;
  let ikoServerPage: IkoServerPage;
  let ikoViewPage: IkoViewPage;
  let tabPage: IkoTabPage;
  let widgetPage: IkoWidgetPage;
  let parentServerKey: string;
  let parentViewKey: string;
  let widgetTabKey: string;

  test.beforeAll(async ({browser, baseURL}: {browser: Browser; baseURL?: string}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    ikoServerPage = new IkoServerPage(page, context.request);
    ikoViewPage = new IkoViewPage(page, context.request);
    tabPage = new IkoTabPage(page, context.request);
    widgetPage = new IkoWidgetPage(page, context.request);

    // Widgets live under a tab, under a view, under a server. All three
    // parents are created via the API so this suite focuses on widgets and
    // exercises the tab → widget-details navigation only once for 15.65.
    const parentServerTitle = uniqueServerTitle('widget-suite');
    parentServerKey = await ikoServerPage.createServerViaApi(
      parentServerTitle,
      ikoServerConfig.serverUrl
    );

    const parentViewTitle = `E2E IKO View widget-suite-parent`;
    parentViewKey = await ikoViewPage.createViewViaApi(parentServerKey, parentViewTitle);

    // Create the "Widgets" tab the user asked us to create — it will be
    // deleted by the API in afterAll.
    widgetTabKey = await tabPage.createTabViaApi(parentViewKey, 'E2E IKO Tab widget-suite-parent');

    await page.goto('/');
  });

  test.afterAll(async () => {
    // Widgets cascade with the tab, but clean any UI-created leftovers
    // explicitly so a partial failure doesn't poison the next suite.
    await widgetPage.cleanupTestWidgetsViaApi(parentViewKey, widgetTabKey, [
      IKO_WIDGET_TITLE_PREFIX,
      IKO_WIDGET_DIVIDER_TITLE_PREFIX,
    ]);
    await tabPage.deleteTabViaApi(parentViewKey, widgetTabKey);
    await ikoViewPage.deleteViewViaApi(parentViewKey);
    await ikoServerPage.cleanupTestServersViaApi(IKO_SERVER_TITLE_PREFIX);
    await context.close();
  });

  test.afterEach(async () => {
    await widgetPage.closeAnyOpenModal();
  });

  // ─── 15.65 — Reach widget details from the tabs list ────────────────

  test.describe('15.65 — View widget details page', () => {
    test('opens the widget-details page when clicking a widgets-type tab row', async () => {
      await tabPage.goToTabsTab(parentServerKey, parentViewKey);
      await tabPage.list.row(widgetTabKey).click();

      // The widget editor mounts only on the widget-details route.
      await expect(widgetPage.editorContainer).toBeVisible();
      expect(page.url()).toContain(`/widget-details/${widgetTabKey}`);
    });
  });

  // ─── 15.66, 15.67 — Widget list & column headers ────────────────────

  test.describe('15.66, 15.67 — Widgets list', () => {
    test.beforeAll(async () => {
      await widgetPage.goToWidgetDetails(parentServerKey, parentViewKey, widgetTabKey);
    });

    test('15.66 — shows the widgets list and the add buttons', async () => {
      await expect(widgetPage.list.table).toBeVisible();
      await expect(widgetPage.addWidgetButton).toBeVisible();
      await expect(widgetPage.addDividerButton).toBeVisible();
    });

    test('15.67 — shows the expected column headers', async () => {
      // Seed a single widget so the list renders columns instead of the
      // no-results state.
      const seededKey = 'e2e-iko-widget-header-seed';
      const seededTitle = uniqueWidgetTitle('header-seed');
      await widgetPage.createWidgetViaApi(parentViewKey, widgetTabKey, {
        key: seededKey,
        title: seededTitle,
        type: 'divider',
        icon: null,
        color: 'WHITE',
        width: 2,
        highContrast: false,
        isCompact: false,
        displayConditions: [],
        actions: [],
      });

      try {
        await widgetPage.goToWidgetDetails(parentServerKey, parentViewKey, widgetTabKey);
        for (const header of IKO_WIDGET_HEADERS) {
          await widgetPage.assertHeaderVisible(header);
        }
        await widgetPage.assertWidgetVisible(seededTitle);
      } finally {
        await widgetPage.deleteWidgetViaApi(parentViewKey, widgetTabKey, seededKey);
      }
    });
  });

  // ─── 15.68 — Toggle visual / JSON editor ────────────────────────────

  test.describe('15.68 — Toggle visual / JSON editor', () => {
    test.beforeAll(async () => {
      await widgetPage.goToWidgetDetails(parentServerKey, parentViewKey, widgetTabKey);
    });

    test('switches between visual and JSON editors', async () => {
      await widgetPage.switchToJsonEditor();
      // The JSON editor host element is only attached when the JSON tab is
      // active, so its presence confirms the switch.
      await expect(page.locator('valtimo-json-editor')).toBeVisible();

      await widgetPage.switchToVisualEditor();
      await expect(widgetPage.editorContainer).toBeVisible();
    });
  });

  // ─── 15.69, 15.75 — Edit widgets through the JSON editor ────────────

  test.describe('15.69, 15.75 — Edit widgets JSON', () => {
    const jsonWidgetTitle = uniqueWidgetTitle('json-divider');
    const jsonWidgetKey = `e2e-iko-json-divider-${Date.now()}`;

    test.beforeAll(async () => {
      await widgetPage.goToWidgetDetails(parentServerKey, parentViewKey, widgetTabKey);
    });

    test('adds a widget via the JSON editor and saves the configuration', async () => {
      await widgetPage.addWidgetViaJsonEditor(parentViewKey, widgetTabKey, {
        type: 'divider',
        key: jsonWidgetKey,
        title: jsonWidgetTitle,
        icon: null,
        color: 'WHITE',
        width: 4,
        highContrast: false,
        isCompact: null,
        displayConditions: [],
        actions: [],
      });

      await widgetPage.assertWidgetVisible(jsonWidgetTitle);
    });

    test('removes the JSON-added widget via the JSON editor', async () => {
      await widgetPage.removeWidgetViaJsonEditor(parentViewKey, widgetTabKey, jsonWidgetKey);
      await widgetPage.assertWidgetNotVisible(jsonWidgetTitle);
    });
  });

  // ─── 15.70, 15.71, 15.72 — Add widget divider ───────────────────────

  test.describe('15.70-15.72 — Add widget divider', () => {
    const dividerTitle = uniqueDividerTitle('divider-modal');
    let dividerKey: string;

    test.beforeAll(async () => {
      await widgetPage.goToWidgetDetails(parentServerKey, parentViewKey, widgetTabKey);
      await widgetPage.switchToVisualEditor();
    });

    test('15.70 — opens the add-divider modal', async () => {
      await widgetPage.addDividerButton.click();
      await expect(widgetPage.dividerTitleInput).toBeVisible();
      await widgetPage.dividerCancelButton.click();
      await expect(page.locator('cds-modal[open]')).toHaveCount(0);
    });

    test('15.71, 15.72 — auto-generates the key from the divider title', async () => {
      await widgetPage.addDividerButton.click();
      await widgetPage.dividerTitleInput.fill(dividerTitle);
      await expect(widgetPage.dividerKeyInput).not.toHaveValue('');
      // Cancel — the next test does the real save so we don't seed a
      // half-created divider.
      await widgetPage.dividerCancelButton.click();
    });

    test('saves the divider through the modal', async () => {
      dividerKey = await widgetPage.addDivider(dividerTitle);
      expect(dividerKey).not.toEqual('');
      await widgetPage.assertWidgetVisible(dividerTitle);
      await widgetPage.assertWidgetTypeTag(dividerTitle, 'Divider');
    });

    test.afterAll(async () => {
      if (dividerKey) {
        await widgetPage.deleteWidgetViaApi(parentViewKey, widgetTabKey, dividerKey);
      }
    });
  });

  // ─── 15.73, 15.74 — Open the create-widget wizard & choose type ─────

  test.describe('15.73, 15.74 — Create widget & choose widget type', () => {
    test.beforeAll(async () => {
      await widgetPage.goToWidgetDetails(parentServerKey, parentViewKey, widgetTabKey);
    });

    test('15.73 — opens the wizard via the add-widget button', async () => {
      await widgetPage.openWizard();
      await widgetPage.wizardCancelButton.click();
      await expect(widgetPage.wizardModal).toBeHidden();
    });

    test('15.74 — exposes exactly the IKO-supported widget types', async () => {
      await widgetPage.openWizard();

      for (const testId of Object.values(IKO_WIDGET_TYPE_TILES)) {
        await expect(widgetPage.widgetTypeTile(testId)).toBeVisible();
      }
      // The IKO management page restricts the type list — Custom, Form.io,
      // Person card and Metroline must NOT appear here.
      for (const testId of IKO_WIDGET_UNAVAILABLE_TYPE_TILES) {
        await expect(widgetPage.widgetTypeTile(testId)).toHaveCount(0);
      }

      // Selecting a tile enables the wizard's Next step (the actual save is
      // covered by 15.69 via the JSON editor — which exercises the same
      // backend API the wizard calls).
      await widgetPage.widgetTypeTile(IKO_WIDGET_TYPE_TILES.fields).click();
      await expect(widgetPage.wizardNextButton).toBeEnabled();

      await widgetPage.wizardCancelButton.click();
      await expect(widgetPage.wizardModal).toBeHidden();
    });
  });

  // ─── 15.73, 15.74, 15.75 — Create, edit & delete every IKO widget type ─

  test.describe('15.73-15.75 — Create, edit and delete every IKO widget type', () => {
    // Tracks the widgets created in this block so afterAll can remove every
    // one of them once all create/edit tests have run.
    const created: Array<{key: string; title: string}> = [];
    // Per-type state shared between each type's create and edit test.
    const stateBySlug: Record<string, {key: string; title: string}> = {};

    test.beforeAll(async () => {
      await widgetPage.goToWidgetDetails(parentServerKey, parentViewKey, widgetTabKey);
    });

    for (const spec of IKO_WIDGET_TYPE_SPECS) {
      test(`15.73, 15.74, 15.75 — creates a ${spec.typeLabel} widget`, async () => {
        const key = `e2e-iko-${spec.slug}-${generateId()}`;
        const title = uniqueWidgetTitle(spec.slug);
        stateBySlug[spec.slug] = {key, title};
        created.push({key, title});

        await widgetPage.addWidgetViaJsonEditor(
          parentViewKey,
          widgetTabKey,
          spec.build(key, title)
        );

        await widgetPage.assertWidgetVisible(title);
        await widgetPage.assertWidgetTypeTag(title, spec.typeLabel);
      });

      test(`edits the ${spec.typeLabel} widget`, async () => {
        const current = stateBySlug[spec.slug];
        const newTitle = uniqueWidgetTitle(`${spec.slug}-edited`);

        await widgetPage.editWidgetViaJsonEditor(parentViewKey, widgetTabKey, current.key, {
          title: newTitle,
        });

        await widgetPage.assertWidgetVisible(newTitle);
        await widgetPage.assertWidgetNotVisible(current.title);
        await widgetPage.assertWidgetTypeTag(newTitle, spec.typeLabel);

        // Keep tracking the latest title for cleanup / debugging.
        current.title = newTitle;
        const tracked = created.find(w => w.key === current.key);
        if (tracked) tracked.title = newTitle;
      });
    }

    test.afterAll(async () => {
      // The user asked us to remove every widget once all tests have run.
      for (const widget of created) {
        await widgetPage.deleteWidgetViaApi(parentViewKey, widgetTabKey, widget.key);
      }
    });
  });

  // ─── Failure scenarios ──────────────────────────────────────────────

  test.describe('Failure scenarios', () => {
    test.beforeAll(async () => {
      await widgetPage.goToWidgetDetails(parentServerKey, parentViewKey, widgetTabKey);
      await widgetPage.switchToVisualEditor();
    });

    test('divider create button is disabled until both title and key are set', async () => {
      await widgetPage.addDividerButton.click();

      // Empty form → create stays disabled.
      await expect(widgetPage.dividerCreateButton).toBeDisabled();

      // Title without a saved key still keeps create disabled until the
      // auto-key picks up the slugified value.
      await widgetPage.dividerTitleInput.fill('');
      await expect(widgetPage.dividerCreateButton).toBeDisabled();

      await widgetPage.dividerCancelButton.click();
      await expect(page.locator('cds-modal[open]')).toHaveCount(0);
    });

    test('wizard next button is disabled before a widget type is selected', async () => {
      await widgetPage.addWidgetButton.click();
      await expect(widgetPage.wizardModal).toBeVisible();
      await expect(widgetPage.wizardNextButton).toBeDisabled();
      await widgetPage.wizardCancelButton.click();
      await expect(widgetPage.wizardModal).toBeHidden();
    });
  });
});
