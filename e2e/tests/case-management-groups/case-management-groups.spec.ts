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
  createGroupViaApi,
  deleteGroupViaApi,
  exportGroupViaApi,
  getGroupsViaApi,
  GROUP_MANAGEMENT_ENDPOINT,
  importGroupViaApi,
  putListColumnsViaApi,
  putSearchFieldsViaApi,
  addMemberViaApi,
  uniqueGroupTitle,
  caseFieldColumn,
  getCaseDefinitionName,
} from '../../utils/case-group.utils';
import {CaseManagementGroupsPage} from './page';
import {MEMBER_KEYS} from './case-management-groups-config';

test.use({storageState: undefined});

// One shared page; tests build on each other within a describe.
test.describe.configure({mode: 'serial'});

interface GroupWithMembers extends CaseGroup {
  members: Array<{caseDefinitionKey: string; order: number}>;
  color: string | null;
}

test.describe('Case groups management', () => {
  let context;
  let page;
  let groupsPage: CaseManagementGroupsPage;
  const createdGroupKeys = new Set<string>();

  const track = (group: CaseGroup): CaseGroup => {
    createdGroupKeys.add(group.key);
    return group;
  };

  const getGroup = (key: string) => apiGet<GroupWithMembers>(`${GROUP_MANAGEMENT_ENDPOINT}/${key}`);

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    groupsPage = new CaseManagementGroupsPage(page);
    await page.goto('/');
  });

  test.afterAll(async () => {
    for (const key of createdGroupKeys) {
      await deleteGroupViaApi(key);
    }
    await context.close();
  });

  // ─── 6.113 Case groups tab ───────────────────────────────────────

  test.describe('6.113 — Case groups tab', () => {
    test('switching tabs adds and removes ?tab=groups', async () => {
      await page.goto('/case-management');
      await expect(groupsPage.listTab('Cases')).toHaveAttribute('aria-selected', 'true');

      await groupsPage.listTab('Case groups').click();
      await expect(page).toHaveURL(/[?&]tab=groups/);
      await expect(groupsPage.caseGroupsTabPanel).toBeVisible();

      await groupsPage.listTab('Cases').click();
      await expect(page).not.toHaveURL(/tab=groups/);
      await expect(groupsPage.casesTabPanel).toBeVisible();
    });

    test('opening ?tab=groups directly selects the Case groups tab', async () => {
      await groupsPage.goToGroupsTab();
      await expect(groupsPage.listTab('Case groups')).toHaveAttribute('aria-selected', 'true');
      await groupsPage.groupsList.assertColumnHeaders(['Name', 'Key', 'Number of cases']);
    });
  });

  // ─── 6.114 Create case group ─────────────────────────────────────

  test.describe('6.114 — Create case group', () => {
    test.describe('Success', () => {
      test('creates a group from the modal and lists it with a generated key', async () => {
        const title = uniqueGroupTitle();
        await groupsPage.goToGroupsTab();

        await groupsPage.openCreateModal();
        await groupsPage.fillModal(title, 'Created by e2e');
        const created = track(await groupsPage.submitCreateModal());

        expect(created.key).toMatch(/^[a-z][a-z0-9_]*$/);
        const row = groupsPage.groupRow(title);
        await expect(row).toBeVisible();
        await expect(row).toContainText(created.key);
      });

      test('a second group with the same title gets a suffixed key', async () => {
        const title = uniqueGroupTitle();
        const first = track(await createGroupViaApi(title));
        await groupsPage.goToGroupsTab();

        await groupsPage.openCreateModal();
        await groupsPage.fillModal(title);
        const second = track(await groupsPage.submitCreateModal());

        expect(second.key).toBe(`${first.key}_2`);
        await expect(groupsPage.groupRow(second.key)).toBeVisible();
      });
    });

    test.describe('Failure scenarios', () => {
      test('Create stays disabled while the name is empty', async () => {
        await groupsPage.goToGroupsTab();
        await groupsPage.openCreateModal();

        await expect(groupsPage.modalSubmitButton).toBeDisabled();
        await groupsPage.fillModal('x');
        await expect(groupsPage.modalSubmitButton).toBeEnabled();
        await groupsPage.modalTitleInput.clear();
        await expect(groupsPage.modalSubmitButton).toBeDisabled();

        await groupsPage.modalCancelButton.click();
        await expect(groupsPage.modal).toBeHidden();
      });

      test('cancel does not create a group', async () => {
        const title = uniqueGroupTitle();
        await groupsPage.goToGroupsTab();
        let posted = false;
        page.on('request', request => {
          if (request.method() === 'POST' && request.url().endsWith(GROUP_MANAGEMENT_ENDPOINT)) {
            posted = true;
          }
        });

        await groupsPage.openCreateModal();
        await groupsPage.fillModal(title);
        await groupsPage.modalCancelButton.click();

        await expect(groupsPage.modal).toBeHidden();
        expect(posted).toBe(false);
        expect((await getGroupsViaApi()).some(group => group.title === title)).toBe(false);
      });

      test('a whitespace-only name is rejected by the backend', async () => {
        await groupsPage.goToGroupsTab();
        const groupCountBefore = (await getGroupsViaApi()).length;

        await groupsPage.openCreateModal();
        await groupsPage.fillModal('   ');
        const [response] = await Promise.all([
          page.waitForResponse(
            res =>
              res.request().method() === 'POST' &&
              new URL(res.url()).pathname === GROUP_MANAGEMENT_ENDPOINT
          ),
          groupsPage.modalSubmitButton.click(),
        ]);

        expect(response.status()).toBe(400);
        expect(await getGroupsViaApi()).toHaveLength(groupCountBefore);
      });
    });
  });

  // ─── 6.115 Group detail and edit ─────────────────────────────────

  test.describe('6.115 — Group detail and edit', () => {
    let group: CaseGroup;

    test.beforeAll(async () => {
      group = track(await createGroupViaApi(uniqueGroupTitle(), 'Detail description'));
    });

    test('clicking a row opens the group on the Config tab', async () => {
      await groupsPage.goToGroupsTab();
      await groupsPage.groupsList.row(group.key).click();

      await expect(page).toHaveURL(new RegExp(`/case-management/group/${group.key}/config$`));
      await expect(groupsPage.heading).toHaveText(group.title);
      await expect(groupsPage.detailTab('Config')).toHaveAttribute('aria-selected', 'true');
    });

    test('the group root redirects to the Config tab', async () => {
      await page.goto(`/case-management/group/${group.key}`);
      await expect(page).toHaveURL(new RegExp(`/case-management/group/${group.key}/config$`));
    });

    test('tabs navigate to their child routes', async () => {
      await groupsPage.goToGroup(group.key);

      await groupsPage.detailTab('List columns').click();
      await expect(page).toHaveURL(new RegExp(`/group/${group.key}/list-columns$`));

      await groupsPage.detailTab('Search fields').click();
      await expect(page).toHaveURL(new RegExp(`/group/${group.key}/search-fields$`));

      await groupsPage.detailTab('Config').click();
      await expect(page).toHaveURL(new RegExp(`/group/${group.key}/config$`));
    });

    test('the Case groups breadcrumb leads back to the groups tab', async () => {
      await groupsPage.goToGroup(group.key);
      await expect(groupsPage.breadcrumb).toContainText(group.title);

      await groupsPage.breadcrumb.getByRole('link', {name: 'Case groups'}).click();
      await expect(page).toHaveURL(/\/case-management\?tab=groups/);
      await expect(groupsPage.listTab('Case groups')).toHaveAttribute('aria-selected', 'true');
    });

    test('editing title and description updates the page and keeps the color', async () => {
      await groupsPage.goToGroup(group.key);
      await groupsPage.editButton.click();
      await expect(groupsPage.modalTitleInput).toHaveValue(group.title);
      await expect(groupsPage.modalDescriptionInput).toHaveValue('Detail description');

      const newTitle = `${group.title} edited`;
      await groupsPage.fillModal(newTitle, 'Edited description');
      const body = await groupsPage.submitEditModal(group.key);

      expect(body).toMatchObject({title: newTitle, description: 'Edited description'});
      expect(body).toHaveProperty('color');
      await expect(groupsPage.heading).toHaveText(newTitle);
      await expect(groupsPage.breadcrumb).toContainText(newTitle);
      expect((await getGroup(group.key)).title).toBe(newTitle);
    });
  });

  // ─── 6.116 Config tab: members ───────────────────────────────────

  test.describe('6.116 — Config: members', () => {
    let group: CaseGroup;
    const [firstMemberKey, secondMemberKey] = MEMBER_KEYS;
    let firstMemberName: string;
    let secondMemberName: string;

    test.beforeAll(async () => {
      group = track(await createGroupViaApi(uniqueGroupTitle()));
      firstMemberName = await getCaseDefinitionName(firstMemberKey);
      secondMemberName = await getCaseDefinitionName(secondMemberKey);
    });

    test('a new group shows the empty member state', async () => {
      await groupsPage.goToGroup(group.key);
      await expect(groupsPage.noMembers).toBeVisible();
      await expect(groupsPage.memberCount).toHaveText('0 cases in this group');
    });

    test('Add to group stays disabled until a case is selected', async () => {
      await groupsPage.openAddPanel();
      await expect(groupsPage.addToGroupButton).toBeDisabled();
    });

    test('adds two case definitions as members', async () => {
      await groupsPage.addMember(firstMemberName, group.key);
      await expect(groupsPage.memberRow(firstMemberKey)).toBeVisible();

      await groupsPage.addMember(secondMemberName, group.key);
      await expect(groupsPage.memberRow(secondMemberKey)).toBeVisible();

      await expect(groupsPage.memberRows).toHaveCount(2);
      await expect(groupsPage.memberCount).toHaveText('2 cases in this group');
      await expect(groupsPage.memberRow(firstMemberKey)).toContainText(firstMemberName);
      expect((await getGroup(group.key)).members.map(m => m.caseDefinitionKey)).toEqual([
        firstMemberKey,
        secondMemberKey,
      ]);
    });

    test('existing members are no longer offered in the case select', async () => {
      await page.reload();
      await expect(groupsPage.memberRows).toHaveCount(2);

      const options = await groupsPage.availableCaseOptions();
      expect(options).not.toContain(firstMemberName);
      expect(options).not.toContain(secondMemberName);

      await groupsPage.heading.click();
      await expect(groupsPage.addPanel).toBeHidden();
    });

    test('member search filters by name and key', async () => {
      await groupsPage.memberSearchInput.fill(secondMemberKey);
      await expect(groupsPage.memberRows).toHaveCount(1);
      await expect(groupsPage.memberRow(secondMemberKey)).toBeVisible();

      await groupsPage.memberSearchInput.fill('no-such-case-zzz');
      await expect(groupsPage.memberRows).toHaveCount(0);
      await expect(groupsPage.noMemberSearchResults).toBeVisible();

      await groupsPage.memberSearchInput.fill('');
      await expect(groupsPage.memberRows).toHaveCount(2);
    });

    test('removes a member from the group', async () => {
      await groupsPage.removeMember(firstMemberKey, group.key);

      await expect(groupsPage.memberRow(firstMemberKey)).toHaveCount(0);
      await expect(groupsPage.memberRows).toHaveCount(1);
      await expect(groupsPage.memberCount).toHaveText('1 cases in this group');
      expect((await getGroup(group.key)).members.map(m => m.caseDefinitionKey)).toEqual([
        secondMemberKey,
      ]);
    });
  });

  // ─── 6.117 Config tab: color ─────────────────────────────────────

  test.describe('6.117 — Config: color', () => {
    let group: CaseGroup;

    test.beforeAll(async () => {
      group = track(await createGroupViaApi(uniqueGroupTitle()));
    });

    test('picking a swatch saves the color and shows it as selected', async () => {
      await groupsPage.goToGroup(group.key);
      await expect(groupsPage.colorPanel.swatches).toHaveCount(27);
      const color = await groupsPage.colorPanel.pickDifferentColor(null);

      const body = await groupsPage.pickSwatch(color, group.key);

      expect(body).toMatchObject({
        title: group.title,
        color: expect.stringMatching(new RegExp(color, 'i')),
      });
      await groupsPage.colorPanel.assertSelected(color);
      expect((await getGroup(group.key)).color?.toUpperCase()).toBe(color);
    });

    test('the selected color survives a reload', async () => {
      const saved = (await getGroup(group.key)).color as string;
      await page.reload();
      await groupsPage.colorPanel.assertSelected(saved);
    });

    test('picking another swatch replaces the color', async () => {
      const current = (await getGroup(group.key)).color;
      const next = await groupsPage.colorPanel.pickDifferentColor(current);

      await groupsPage.pickSwatch(next, group.key);

      await groupsPage.colorPanel.assertSelected(next);
    });
  });

  // ─── 6.118 Import / export (API only, no UI) ─────────────────────

  test.describe('6.118 — Import / export (API)', () => {
    let group: CaseGroup;
    let zip: Buffer;

    test.beforeAll(async () => {
      group = track(await createGroupViaApi(uniqueGroupTitle(), 'Export me'));
      for (const memberKey of MEMBER_KEYS) await addMemberViaApi(group.key, memberKey);
      await putListColumnsViaApi(group.key, [
        caseFieldColumn('created-on', 'Created on', 'case:createdOn', [...MEMBER_KEYS], {
          displayType: {type: 'date', displayTypeParameters: {}},
          defaultSort: 'DESC',
        }),
      ]);
      await putSearchFieldsViaApi(group.key, [
        {
          key: 'created',
          title: 'Created',
          dataType: 'date',
          fieldType: 'range',
          pathMappings: MEMBER_KEYS.map(caseDefinitionKey => ({
            caseDefinitionKey,
            path: 'case:createdOn',
          })),
        },
      ]);
    });

    test('export returns a zip with the group definition file', async () => {
      zip = await exportGroupViaApi(group.key);

      expect(zip.subarray(0, 2).toString()).toBe('PK');
      expect(
        zip.includes(
          Buffer.from(`config/global/case-group/${group.key}/${group.key}.case-group.json`)
        )
      ).toBe(true);
    });

    test('importing the export restores a deleted group', async () => {
      const before = await getGroup(group.key);
      await deleteGroupViaApi(group.key);

      await importGroupViaApi(zip);

      const restored = await getGroup(group.key);
      expect(restored).toMatchObject({
        key: before.key,
        title: before.title,
        description: before.description,
      });
      expect(restored.members.map(m => m.caseDefinitionKey)).toEqual(
        before.members.map(m => m.caseDefinitionKey)
      );
      const columns = await apiGet<Array<{key: string; defaultSort: string}>>(
        `${GROUP_MANAGEMENT_ENDPOINT}/${group.key}/list-column`
      );
      expect(columns).toEqual([expect.objectContaining({key: 'created-on', defaultSort: 'DESC'})]);
      const fields = await apiGet<Array<{key: string}>>(
        `${GROUP_MANAGEMENT_ENDPOINT}/${group.key}/search-field`
      );
      expect(fields.map(field => field.key)).toEqual(['created']);
    });

    test('importing the same zip again is idempotent', async () => {
      await importGroupViaApi(zip);

      const groups = (await getGroupsViaApi()).filter(g => g.key === group.key);
      expect(groups).toHaveLength(1);
      expect((await getGroup(group.key)).members).toHaveLength(MEMBER_KEYS.length);
    });

    test('importing a file that is not a group export is rejected', async () => {
      let status: number | undefined;
      try {
        await importGroupViaApi(Buffer.from('not a zip'), 'broken.zip');
      } catch (error) {
        status = isApiStatus(error, 400) ? 400 : (error as {status?: number}).status;
      }
      expect(status).toBe(400);
    });
  });
});
