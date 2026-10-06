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
import {apiGet} from '../../utils/api.utils';
import {generateId} from '../../utils/dataGenerator';
import {
  CaseGroup,
  caseFieldColumn,
  createDocumentViaApi,
  createDocumentWithProcessViaApi,
  createGroupWithMembersViaApi,
  deleteDocumentViaApi,
  deleteGroupViaApi,
  deleteQuickSearchViaApi,
  documentColumn,
  GROUP_USER_ENDPOINT,
  putListColumnsViaApi,
  putSearchFieldsViaApi,
  uniqueGroupTitle,
} from '../../utils/case-group.utils';
import {GroupCaseListPage} from './page';
import {
  CELL,
  DOC_PATHS,
  MEMBER_KEYS,
  SHARED_STATUS_MEMBER_KEYS,
  SHARED_STATUS_TITLE,
  verhuizingContent,
} from './group-case-list-config';

test.use({storageState: undefined});

// One page; filters, sorting and saved searches carry over between tests.
test.describe.configure({mode: 'serial'});

test.describe('Group case list', () => {
  let context;
  let page;
  let listPage: GroupCaseListPage;
  let group: CaseGroup;
  const runId = generateId();
  const name = (suffix: string) => `E2E-${runId}-${suffix}`;
  const documentIds: Record<string, string> = {};
  const createdGroupKeys: string[] = [];
  const quickSearchTitle = `E2E search ${runId}`;
  const [bezwaar, verhuizing] = MEMBER_KEYS;

  test.beforeAll(async ({browser, baseURL}) => {
    group = await createGroupWithMembersViaApi(uniqueGroupTitle('E2E list'), [...MEMBER_KEYS]);
    createdGroupKeys.push(group.key);
    await putListColumnsViaApi(group.key, [
      caseFieldColumn('created-on', 'Created on', 'case:createdOn', [...MEMBER_KEYS], {
        displayType: {type: 'date', displayTypeParameters: {}},
        defaultSort: 'DESC',
      }),
      documentColumn('name', 'Name', [
        {caseDefinitionKey: bezwaar, path: DOC_PATHS[bezwaar]},
        {caseDefinitionKey: verhuizing, path: DOC_PATHS[verhuizing]},
      ]),
      caseFieldColumn('status', 'Status', 'case:internalStatus', [...MEMBER_KEYS]),
    ]);
    await putSearchFieldsViaApi(group.key, [
      {
        key: 'name',
        title: 'Name',
        dataType: 'text',
        fieldType: 'single',
        matchType: 'like',
        pathMappings: [
          {caseDefinitionKey: bezwaar, path: DOC_PATHS[bezwaar]},
          {caseDefinitionKey: verhuizing, path: DOC_PATHS[verhuizing]},
        ],
      },
      {
        key: 'bezwaar-name',
        title: 'Bezwaar name',
        dataType: 'text',
        fieldType: 'single',
        matchType: 'like',
        pathMappings: [{caseDefinitionKey: bezwaar, path: DOC_PATHS[bezwaar]}],
      },
    ]);

    // Created in this order, so the default sort (newest first) is B2, V1, B1
    documentIds.B1 = await createDocumentViaApi(bezwaar, {achternaam: name('B1')});
    documentIds.V1 = await createDocumentViaApi(verhuizing, verhuizingContent(name('V1')));
    documentIds.B2 = await createDocumentViaApi(bezwaar, {achternaam: name('B2')});

    context = await browser.newContext({baseURL});
    page = await context.newPage();
    listPage = new GroupCaseListPage(page);
    await page.goto('/');
  });

  test.afterAll(async () => {
    await deleteQuickSearchViaApi(group.key, quickSearchTitle);
    for (const id of Object.values(documentIds)) await deleteDocumentViaApi(id);
    for (const key of createdGroupKeys) await deleteGroupViaApi(key);
    await context.close();
  });

  // ─── 2.10 Columns and rows ──────────────────────────────────────

  test.describe('2.10 — Columns and rows', () => {
    test('shows the group title and its configured columns, without an assignee column', async () => {
      await listPage.goTo(group.key);

      await expect(listPage.heading).toHaveText(group.title);
      await listPage.list.assertColumnHeadersContain(['Created on', 'Name', 'Status']);
      await expect(listPage.columnHeader('Assignee')).toHaveCount(0);
    });

    test('offers the assignee tabs but no start or export buttons', async () => {
      for (const tab of ['All cases', 'My cases', 'Unassigned cases']) {
        await expect(listPage.assigneeTab(tab)).toBeVisible();
      }
      await expect(listPage.startCaseButton).toHaveCount(0);
      await expect(listPage.exportButton).toHaveCount(0);
    });

    test('a search field narrows the list to cases from every member', async () => {
      await listPage.searchFor('name', `E2E-${runId}`);

      await expect(listPage.list.rows).toHaveCount(3);
      expect(await listPage.columnValues(CELL.name)).toEqual([name('B2'), name('V1'), name('B1')]);
    });
  });

  // ─── 2.11 Sorting ───────────────────────────────────────────────

  test.describe('2.11 — Sorting', () => {
    test('the default sort is the column default: newest first', async () => {
      await expect(page).toHaveURL(/sortStateName=created-on&sortStateDirection=DESC/);
      expect(await listPage.columnValues(CELL.name)).toEqual([name('B2'), name('V1'), name('B1')]);
    });

    test('clicking a sortable header flips the order', async () => {
      await Promise.all([listPage.waitForSearch(), listPage.list.sortByColumn('Created on')]);

      await expect(page).toHaveURL(/sortStateName=created-on&sortStateDirection=ASC/);
      await expect
        .poll(() => listPage.columnValues(CELL.name))
        .toEqual([name('B1'), name('V1'), name('B2')]);
    });

    test('columns on document paths cannot be sorted', async () => {
      await expect(listPage.columnHeader('Name').getByRole('button')).toHaveCount(0);
      await expect(listPage.columnHeader('Status').getByRole('button')).toHaveCount(1);
    });
  });

  // ─── 2.12 Search ────────────────────────────────────────────────

  test.describe('2.12 — Search', () => {
    test('a field mapped for one member only returns that member’s cases', async () => {
      await listPage.goTo(group.key);
      await listPage.searchFor('bezwaar-name', `E2E-${runId}`);

      await expect(listPage.list.rows).toHaveCount(2);
      expect((await listPage.columnValues(CELL.name)).sort()).toEqual([name('B1'), name('B2')]);
    });

    test('saving the search adds a quick search that reopens it', async () => {
      await listPage.saveCurrentSearch(quickSearchTitle);

      await expect(listPage.quickSearchItem(quickSearchTitle)).toBeVisible();
      const stored = await apiGet<Array<{title: string}>>(
        `${GROUP_USER_ENDPOINT}/${group.key}/stored-quick-search`
      );
      expect(stored.map(item => item.title)).toContain(quickSearchTitle);

      await listPage.goTo(group.key);
      await Promise.all([
        listPage.waitForSearch(),
        listPage.quickSearchItem(quickSearchTitle).click(),
      ]);
      await expect(page).toHaveURL(new RegExp(`/groups/${group.key}\\?`));
      await expect(listPage.list.rows).toHaveCount(2);
    });

    test('deleting the quick search removes it', async () => {
      await listPage.deleteQuickSearch(quickSearchTitle);

      await expect(listPage.quickSearchItem(quickSearchTitle)).toHaveCount(0);
      const stored = await apiGet<Array<{title: string}>>(
        `${GROUP_USER_ENDPOINT}/${group.key}/stored-quick-search`
      );
      expect(stored.map(item => item.title)).not.toContain(quickSearchTitle);
    });

    test('a search without matches shows no rows', async () => {
      await listPage.goTo(group.key);
      await listPage.searchFor('name', `no-match-${runId}`);

      await listPage.list.assertNoResults();
    });
  });

  // ─── 2.13 Navigation and settings ───────────────────────────────

  test.describe('2.13 — Navigation and settings', () => {
    test('a row opens the case in its own case definition', async () => {
      await listPage.goTo(group.key);
      await listPage.searchFor('name', name('V1'));
      await expect(listPage.list.rows).toHaveCount(1);

      await listPage.list.rows.first().getByRole('cell').nth(CELL.name).click();

      await expect(page).toHaveURL(new RegExp(`/cases/${verhuizing}/document/${documentIds.V1}`));
    });

    test('the page size is remembered per group', async () => {
      await listPage.goTo(group.key);
      await listPage.pageSizeSelect.selectOption('20');
      await listPage.list.waitForLoaded();

      await listPage.goTo(group.key);

      await expect(listPage.pageSizeSelect).toHaveValue('20');
    });
  });

  // ─── 2.14 Status filter across members ──────────────────────────

  test.describe('2.14 — Status filter', () => {
    let statusGroup: CaseGroup;
    const statusCaseIds: string[] = [];

    test.beforeAll(async () => {
      statusGroup = await createGroupWithMembersViaApi(uniqueGroupTitle('E2E status'), [
        ...SHARED_STATUS_MEMBER_KEYS,
      ]);
      createdGroupKeys.push(statusGroup.key);
      await putListColumnsViaApi(statusGroup.key, [
        documentColumn('name', 'Name', [{caseDefinitionKey: bezwaar, path: DOC_PATHS[bezwaar]}]),
        caseFieldColumn('status', 'Status', 'case:internalStatus', [...SHARED_STATUS_MEMBER_KEYS]),
      ]);
      await putSearchFieldsViaApi(statusGroup.key, [
        {
          key: 'name',
          title: 'Name',
          dataType: 'text',
          fieldType: 'single',
          matchType: 'like',
          pathMappings: [{caseDefinitionKey: bezwaar, path: DOC_PATHS[bezwaar]}],
        },
      ]);
      // The root process sets the initial status
      statusCaseIds.push(await createDocumentWithProcessViaApi(bezwaar, {achternaam: name('S1')}));
    });

    test.afterAll(async () => {
      for (const id of statusCaseIds) await deleteDocumentViaApi(id);
    });

    test('a status shared by two members is offered once', async () => {
      await listPage.goTo(statusGroup.key);

      const options = await listPage.statusOptionTexts();
      expect(options.filter(option => option === SHARED_STATUS_TITLE)).toHaveLength(1);
      expect(new Set(options).size).toBe(options.length);
      await listPage.closeStatusDropdown();
    });

    test('deselecting a status hides the cases that have it', async () => {
      await listPage.searchFor('name', name('S1'));
      await expect(listPage.list.rows).toHaveCount(1);

      await listPage.openStatusDropdown();
      await Promise.all([
        listPage.waitForSearch(),
        listPage.statusOptions.filter({hasText: SHARED_STATUS_TITLE}).click(),
      ]);
      await listPage.closeStatusDropdown();

      await expect(listPage.list.rows).toHaveCount(0);
    });
  });

  // ─── 2.15 Edge cases ────────────────────────────────────────────

  test.describe('2.15 — Edge cases', () => {
    test('a group without columns renders without errors', async () => {
      const bare = await createGroupWithMembersViaApi(uniqueGroupTitle('E2E bare'), [bezwaar]);
      createdGroupKeys.push(bare.key);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));

      await listPage.goTo(bare.key);

      await expect(listPage.heading).toHaveText(bare.title);
      expect(errors).toEqual([]);
    });

    // Needs the backend 404 fix for unknown groups (plan decision 4)
    test.fixme('an unknown group returns 404 and an empty list', async () => {
      const response = await page.request.get(`${GROUP_USER_ENDPOINT}/no-such-group-zzz`);
      expect(response.status()).toBe(404);
    });
  });
});
