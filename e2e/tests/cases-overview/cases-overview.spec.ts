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
import {apiGet, isApiStatus} from '../../utils/api.utils';
import {
  CaseGroup,
  clearPinnedItemsViaApi,
  createGroupWithMembersViaApi,
  deleteGroupViaApi,
  getCaseDefinitionName,
  getPinnedItemsViaApi,
  GROUP_USER_ENDPOINT,
  PinnedItem,
  pinViaApi,
  restorePinnedItemsViaApi,
  uniqueGroupTitle,
  unpinViaApi,
} from '../../utils/case-group.utils';
import {CasesOverviewPage} from './page';
import {GROUP_MEMBER_KEY, PINNED_CASE_TYPE_KEY} from './cases-overview-config';

test.use({storageState: undefined});

// Pins are per user and shared across tests; keep them in one ordered group.
test.describe.configure({mode: 'serial'});

test.describe('Cases overview and pinned items', () => {
  let context;
  let page;
  let overviewPage: CasesOverviewPage;
  let group: CaseGroup;
  let caseTypeName: string;
  let originalPins: PinnedItem[] = [];
  const createdGroupKeys: string[] = [];

  test.beforeAll(async ({browser, baseURL}) => {
    originalPins = await clearPinnedItemsViaApi();
    // "E2E" sorts before the case type name, so alphabetical and pin order differ
    group = await createGroupWithMembersViaApi(
      uniqueGroupTitle('E2E overview'),
      [GROUP_MEMBER_KEY],
      'Group for the overview e2e'
    );
    createdGroupKeys.push(group.key);
    caseTypeName = await getCaseDefinitionName(PINNED_CASE_TYPE_KEY);

    context = await browser.newContext({baseURL});
    page = await context.newPage();
    overviewPage = new CasesOverviewPage(page);
    await page.goto('/');
    await overviewPage.clearPinInfoDismissal();
  });

  test.afterAll(async () => {
    try {
      await clearPinnedItemsViaApi();
      await restorePinnedItemsViaApi(originalPins);
    } catch {
      // Best effort
    }
    for (const key of createdGroupKeys) await deleteGroupViaApi(key);
    try {
      await overviewPage.clearPinInfoDismissal();
    } catch {
      // Page may already be gone
    }
    await context.close();
  });

  // ─── 2.7 Cases overview ─────────────────────────────────────────

  test.describe('2.7 — Cases overview', () => {
    test('with nothing pinned the sidebar shows the pin placeholder', async () => {
      await overviewPage.goTo();
      await expect(overviewPage.pinPlaceholder).toBeVisible();
      await expect(overviewPage.pinnedMenuItems).toHaveCount(0);
    });

    test('the placeholder links to the overview', async () => {
      await page.goto('/cases/bezwaar');
      await overviewPage.expandCasesMenu();
      await expect(overviewPage.pinPlaceholder).toBeVisible();

      await overviewPage.pinPlaceholder.click();
      await expect(page).toHaveURL(/\/cases-overview$/);
    });

    test('clicking the Cases title opens the overview without toggling the menu', async () => {
      await page.goto('/tasks');
      await expect(overviewPage.casesMenuToggle).toHaveAttribute('aria-expanded', 'false');

      await overviewPage.casesMenuTitle.click();

      await expect(page).toHaveURL(/\/cases-overview$/);
      await expect(overviewPage.casesMenuToggle).toHaveAttribute('aria-expanded', 'false');

      await page.goto('/cases/bezwaar');
      await overviewPage.expandCasesMenu();

      await overviewPage.casesMenuTitle.click();

      await expect(page).toHaveURL(/\/cases-overview$/);
      await expect(overviewPage.casesMenuToggle).toHaveAttribute('aria-expanded', 'true');
    });

    test('the chevron toggles the menu without navigating', async () => {
      await overviewPage.goTo();
      await expect(overviewPage.pinPlaceholder).toBeVisible();

      await overviewPage.casesMenuChevron.click();
      await expect(overviewPage.pinPlaceholder).toBeHidden();
      await expect(page).toHaveURL(/\/cases-overview$/);

      await overviewPage.casesMenuChevron.click();
      await expect(overviewPage.pinPlaceholder).toBeVisible();
    });

    test('lists the visible case groups and active case types with counts', async () => {
      await overviewPage.goTo();
      const groups = await apiGet<CaseGroup[]>(GROUP_USER_ENDPOINT);
      const caseTypes = await apiGet<unknown[]>('/api/v1/case-definition?active=true');

      await expect(overviewPage.groupTiles).toHaveCount(groups.length);
      await expect(overviewPage.groupsCount).toHaveText(String(groups.length));
      await expect(overviewPage.typeRows).toHaveCount(caseTypes.length);
      await expect(overviewPage.typesCount).toHaveText(String(caseTypes.length));
      await expect(overviewPage.groupTile(group.title)).toContainText('Group for the overview e2e');
    });

    test('unpinned items are sorted alphabetically', async () => {
      const titles = await overviewPage.groupTitles();
      expect(titles).toEqual(
        [...titles].sort((a, b) => a.localeCompare(b, undefined, {sensitivity: 'base'}))
      );
      const names = await overviewPage.typeNames();
      expect(names).toEqual(
        [...names].sort((a, b) => a.localeCompare(b, undefined, {sensitivity: 'base'}))
      );
    });

    test('search filters groups by title and case types by name', async () => {
      await overviewPage.search(group.title);
      await expect(overviewPage.groupTiles).toHaveCount(1);
      await expect(overviewPage.groupTile(group.title)).toBeVisible();
      await expect(overviewPage.typesNoResults).toBeVisible();

      await overviewPage.search(caseTypeName);
      await expect(overviewPage.typeRow(caseTypeName)).toBeVisible();
      for (const name of await overviewPage.typeNames()) {
        expect(name.toLowerCase()).toContain(caseTypeName.toLowerCase());
      }
    });

    test('a search without matches shows both empty states', async () => {
      await overviewPage.search('no-such-case-zzz');
      await expect(overviewPage.groupsNoResults).toHaveText('No case groups match your search.');
      await expect(overviewPage.typesNoResults).toHaveText('No case types match your search.');
      await expect(overviewPage.groupsCount).toHaveText('0');

      await overviewPage.search('');
      await expect(overviewPage.groupTile(group.title)).toBeVisible();
    });

    test('links open the group list and the case type list', async () => {
      await overviewPage.groupOpenLink(group.title).click();
      await expect(page).toHaveURL(new RegExp(`/groups/${group.key}`));

      await overviewPage.goTo();
      await overviewPage.typeLink(caseTypeName).click();
      await expect(page).toHaveURL(new RegExp(`/cases/${PINNED_CASE_TYPE_KEY}`));
    });

    test('closing the pin info stays closed after a reload', async () => {
      await overviewPage.goTo();
      await expect(overviewPage.pinInfoNotification).toBeVisible();

      await overviewPage.pinInfoCloseButton.click();
      await expect(overviewPage.pinInfoNotification).toBeHidden();

      await page.reload();
      await expect(overviewPage.typesSection).toBeVisible();
      await expect(overviewPage.pinInfoNotification).toBeHidden();
    });
  });

  // ─── 2.8 Pinning ────────────────────────────────────────────────

  test.describe('2.8 — Pin and unpin', () => {
    test('pinning a group updates the tile, the sidebar and shows a toast', async () => {
      await overviewPage.goTo();
      const pinButton = overviewPage.groupPinButton(group.title);
      await overviewPage.assertPinned(pinButton, false);

      const response = await overviewPage.togglePin(pinButton, 'POST');

      expect(response.status()).toBe(201);
      await overviewPage.assertPinned(pinButton, true);
      await expect(
        overviewPage.toast(`Case group '${group.title}' now appears under 'Cases' in the left sidebar.`)
      ).toBeVisible();
      await expect(overviewPage.pinnedMenuItem(group.title)).toBeVisible();
      await expect(overviewPage.pinPlaceholder).toHaveCount(0);
      expect((await overviewPage.groupTitles())[0]).toBe(group.title);
    });

    test('pinning a case type moves it to the top of its section', async () => {
      const pinButton = overviewPage.typePinButton(caseTypeName);

      await overviewPage.togglePin(pinButton, 'POST');

      await overviewPage.assertPinned(pinButton, true);
      await expect(
        overviewPage.toast(`Case type '${caseTypeName}' now appears under 'Cases' in the left sidebar.`)
      ).toBeVisible();
      expect((await overviewPage.typeNames())[0]).toBe(caseTypeName);
      await expect(overviewPage.pinnedMenuItem(caseTypeName)).toBeVisible();
    });

    test('the sidebar lists pins alphabetically, not by pin order', async () => {
      const apiOrder = (await getPinnedItemsViaApi()).map(item => item.displayName);
      expect(apiOrder).toEqual([caseTypeName, group.title]);

      expect(await overviewPage.pinnedMenuNames()).toEqual(
        [group.title, caseTypeName].sort((a, b) =>
          a.localeCompare(b, undefined, {sensitivity: 'base'})
        )
      );
    });

    test('unpinning a case type removes it from the sidebar', async () => {
      const pinButton = overviewPage.typePinButton(caseTypeName);

      const response = await overviewPage.togglePin(pinButton, 'DELETE');

      expect(response.status()).toBe(204);
      await overviewPage.assertPinned(pinButton, false);
      await expect(
        overviewPage.toast(
          `Case type '${caseTypeName}' no longer appears under 'Cases' in the left sidebar.`
        )
      ).toBeVisible();
      await expect(overviewPage.pinnedMenuItem(caseTypeName)).toHaveCount(0);
      await expect(overviewPage.pinnedMenuItem(group.title)).toBeVisible();
    });

    test.describe('Failure scenarios', () => {
      test('a failed pin request rolls the button back', async () => {
        await page.route('**/api/v1/pinned-item', route =>
          route.request().method() === 'POST'
            ? route.fulfill({status: 500, body: '{}', contentType: 'application/json'})
            : route.continue()
        );
        const pinButton = overviewPage.typePinButton(caseTypeName);

        await overviewPage.togglePin(pinButton, 'POST');

        await overviewPage.assertPinned(pinButton, false);
        await expect(overviewPage.pinnedMenuItem(caseTypeName)).toHaveCount(0);
        await page.unroute('**/api/v1/pinned-item');
      });

      test('the API rejects a duplicate pin and an unknown target', async () => {
        const statusOf = async (action: () => Promise<unknown>) => {
          try {
            await action();
            return 200;
          } catch (error) {
            return isApiStatus(error, 409) ? 409 : isApiStatus(error, 404) ? 404 : -1;
          }
        };

        expect(await statusOf(() => pinViaApi('CASE_DEFINITION_GROUP', group.key))).toBe(409);
        expect(await statusOf(() => pinViaApi('CASE_DEFINITION', 'no-such-case-zzz'))).toBe(404);
      });
    });
  });

  // ─── 2.9 Sidebar ────────────────────────────────────────────────

  test.describe('2.9 — Sidebar', () => {
    test('a pinned group opens its case list', async () => {
      await overviewPage.goTo();
      await overviewPage.pinnedMenuItem(group.title).click();
      await expect(page).toHaveURL(new RegExp(`/groups/${group.key}`));
    });

    test('a pinned case type opens its case list', async () => {
      await pinViaApi('CASE_DEFINITION', PINNED_CASE_TYPE_KEY);
      await overviewPage.goTo();

      await overviewPage.pinnedMenuItem(caseTypeName).click();

      await expect(page).toHaveURL(new RegExp(`/cases/${PINNED_CASE_TYPE_KEY}`));
    });

    for (const route of ['/cases-overview', '/cases/bezwaar', 'group']) {
      test(`a direct load of ${route === 'group' ? '/groups/:key' : route} highlights Cases`, async () => {
        await page.goto(route === 'group' ? `/groups/${group.key}` : route);

        await overviewPage.assertCasesSectionActive(true);
        await overviewPage.expandCasesMenu();
        await expect(overviewPage.pinnedMenuItem(group.title)).toBeVisible();
      });
    }

    test('Cases is not highlighted outside its section', async () => {
      await page.goto('/tasks');
      await expect(overviewPage.casesMenu).toBeVisible();
      await overviewPage.assertCasesSectionActive(false);
    });

    test('a deleted group disappears from the sidebar and the overview', async () => {
      const doomed = await createGroupWithMembersViaApi(uniqueGroupTitle('E2E doomed'), [
        GROUP_MEMBER_KEY,
      ]);
      createdGroupKeys.push(doomed.key);
      await pinViaApi('CASE_DEFINITION_GROUP', doomed.key);
      await overviewPage.goTo();
      await expect(overviewPage.pinnedMenuItem(doomed.title)).toBeVisible();

      await deleteGroupViaApi(doomed.key);
      await page.reload();

      await expect(overviewPage.typesSection).toBeVisible();
      await expect(overviewPage.pinnedMenuItem(doomed.title)).toHaveCount(0);
      await expect(overviewPage.groupTile(doomed.title)).toHaveCount(0);
      await unpinViaApi('CASE_DEFINITION_GROUP', doomed.key);
    });
  });
});
