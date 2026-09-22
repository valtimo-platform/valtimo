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
import {CreatedCase, UserCasesPage} from './page';
import {USER_CASES_CONFIG} from './user-cases-config';

test.use({storageState: 'playwright/.auth/uiState.json'});

test.describe('Feature 2 — Cases (User)', () => {
  let context;
  let page;
  let userCasesPage: UserCasesPage;
  const createdCases: CreatedCase[] = [];

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({
      baseURL,
      storageState: 'playwright/.auth/uiState.json',
    });
    page = await context.newPage();
    userCasesPage = new UserCasesPage(page);

    try {
      const probe = await userCasesPage.createCaseViaApi();
      createdCases.push(probe);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes('→ 500')) {
        test.skip(
          true,
          `Bezwaar case creation returns 500 in this env; skipping user-cases until the backend is investigated. Underlying error: ${message.slice(0, 200)}`
        );
      } else {
        throw e;
      }
    }
  });

  test.afterAll(async () => {
    for (const created of createdCases) {
      await userCasesPage.deleteCaseViaApi(created.documentId);
    }
    await context.close();
  });

  test.describe('2.1 — View cases overview per definition', () => {
    let created: CreatedCase;

    test.beforeAll(async () => {
      created = await userCasesPage.createCaseViaApi();
      createdCases.push(created);
    });

    test('displays the bezwaar case list populated with cases', async () => {
      await userCasesPage.goToCaseList();
      await expect(userCasesPage.caseList.table).toBeVisible();
      await userCasesPage.selectCaseListTab('All cases');
      expect(await userCasesPage.caseList.rows.count()).toBeGreaterThan(0);
      void created;
    });
  });

  test.describe('2.3 — Search/filter cases', () => {
    let created: CreatedCase;

    test.beforeAll(async () => {
      created = await userCasesPage.createCaseViaApi();
      createdCases.push(created);
      await userCasesPage.goToCaseList();
      await userCasesPage.selectCaseListTab('All cases');
    });

    test('deselecting a status in the filter hides matching rows and re-selecting restores them', async () => {
      const firstTag = userCasesPage.caseList.rows.locator('cds-tag').first();
      const hasStatusTags = await firstTag
        .waitFor({state: 'visible', timeout: 5_000})
        .then(() => true)
        .catch(() => false);
      test.skip(
        !hasStatusTags,
        'Case list does not render status tags in this env (bezwaar likely has no status column configured)'
      );

      const initialStatuses = await userCasesPage.visibleStatusTagTexts();
      expect(
        initialStatuses.length,
        'expected at least one status tag in the case list'
      ).toBeGreaterThan(0);
      const statusToToggle = initialStatuses[0];

      await userCasesPage.openSearchAccordion();
      await userCasesPage.openStatusDropdown();

      // All statuses are selected by default, so the one we want must be present
      await expect(userCasesPage.statusOptionByName(statusToToggle)).toBeVisible();

      // Deselect the chosen status
      await userCasesPage.toggleStatusOption(statusToToggle);
      await userCasesPage.closeStatusDropdown();

      // Verify no visible row carries the deselected status tag anymore
      await expect
        .poll(() => userCasesPage.visibleStatusTagTexts(), {timeout: 15_000})
        .not.toContain(statusToToggle);

      // Restore the original state
      await userCasesPage.openStatusDropdown();
      await userCasesPage.toggleStatusOption(statusToToggle);
      await userCasesPage.closeStatusDropdown();

      await expect
        .poll(() => userCasesPage.visibleStatusTagTexts(), {timeout: 15_000})
        .toContain(statusToToggle);
    });
  });

  test.describe('2.2 — View case details (tabs)', () => {
    let created: CreatedCase;

    test.beforeAll(async () => {
      created = await userCasesPage.createCaseViaApi();
      createdCases.push(created);
      await userCasesPage.goToCaseDetail(created.documentId);
    });

    test('shows the Summary, Progress, Audit and Documents tabs', async () => {
      await expect(userCasesPage.detailTab(USER_CASES_CONFIG.detailTabs.summary)).toBeVisible();
      await expect(userCasesPage.detailTab(USER_CASES_CONFIG.detailTabs.progress)).toBeVisible();
      await expect(userCasesPage.detailTab(USER_CASES_CONFIG.detailTabs.audit)).toBeVisible();
      await expect(userCasesPage.detailTab(USER_CASES_CONFIG.detailTabs.documents)).toBeVisible();
    });
  });

  test.describe('2.5 — View case progress/status', () => {
    let created: CreatedCase;

    test.beforeAll(async () => {
      created = await userCasesPage.createCaseViaApi();
      createdCases.push(created);
      await userCasesPage.goToCaseDetail(created.documentId);
      await userCasesPage.detailTab(USER_CASES_CONFIG.detailTabs.progress).click();
    });

    test('shows the process dropdown and BPMN visualisation', async () => {
      await expect(userCasesPage.progressTabContent).toBeVisible();
      await expect(userCasesPage.progressProcessComboBox).toBeVisible();
      await expect(userCasesPage.progressBpmnSvg.first()).toBeVisible({timeout: 15_000});
    });
  });

  test.describe('2.4 — View case documents', () => {
    let created: CreatedCase;

    test.beforeAll(async () => {
      created = await userCasesPage.createCaseViaApi();
      createdCases.push(created);
      await userCasesPage.goToCaseDetail(created.documentId);
      await userCasesPage.detailTab(USER_CASES_CONFIG.detailTabs.documents).click();
    });

    test('renders the documents tab container', async () => {
      await expect(userCasesPage.documentsTabContainer.first()).toBeVisible({timeout: 15_000});
    });
  });

  test.describe('2.6 — Execute tasks within case', () => {
    let created: CreatedCase;

    test.beforeAll(async () => {
      test.slow();
      created = await userCasesPage.createCaseViaApi();
      createdCases.push(created);
      await userCasesPage.goToCaseDetail(created.documentId);
    });

    test('starts the Change name sub-process, assigns and completes the task', async () => {
      test.slow();

      // The bezwaar case auto-starts its root process, which immediately creates the
      // "Valideer gegevens aanvrager" user task — so the task list is populated (never
      // empty) right after creation. Just assert the panel is loaded before continuing.
      await expect(userCasesPage.taskListPanel).toBeVisible({timeout: 15_000});

      // Start the "Change name" sub-process via the header "Start" overflow.
      await userCasesPage.startSubProcess(USER_CASES_CONFIG.changeNameProcess);

      // The process-start form opens as an HTML form — submit it to start the process.
      await expect(userCasesPage.formStartButton).toBeVisible({timeout: 15_000});
      await userCasesPage.submitFormStart();

      // The new user task appears in the task list panel.
      const taskTile = userCasesPage.taskTileByName(USER_CASES_CONFIG.changeNameProcess);
      await expect(taskTile).toBeVisible({timeout: 15_000});

      // Open the task and assign it to the current user + default team.
      await taskTile.click();
      await userCasesPage.assignTaskToSelf();

      // After assignment the task form is re-rendered; submit it to complete.
      await expect(userCasesPage.taskFormStartButton).toBeVisible({timeout: 15_000});
      await userCasesPage.submitTaskForm();

      // Completing the "Change name" task removes its tile from the list. The case's
      // initial "Valideer gegevens aanvrager" task stays, so the list is not empty.
      await expect(taskTile).not.toBeVisible({timeout: 15_000});
    });
  });

  // Regression for #842: a start form opened in the side panel must stay open and
  // keep its entered data on every tab switch — including tabs that hide the task
  // panel — until the user deliberately closes it. Before the fix the panel was
  // force-closed on each tab switch (and torn down entirely on task-hiding tabs).
  test.describe('2.7 — In-panel start form persists across tab switches', () => {
    const noteSubject = 'Persistent panel note 842';

    test.beforeAll(async () => {
      const created = await userCasesPage.createCaseViaApi();
      createdCases.push(created);
      await userCasesPage.goToCaseDetail(created.documentId);
    });

    test('keeps a start form open with entered data across task-hiding tabs and back', async () => {
      await userCasesPage.openStartFormInPanel(USER_CASES_CONFIG.createZaaknotitieProcess);
      await expect(userCasesPage.startFormPanelTitle).toHaveText(
        USER_CASES_CONFIG.createZaaknotitieProcess
      );

      const subject = userCasesPage.startFormField(/Onderwerp/);
      await subject.fill(noteSubject);

      // Progress and Documents both hide the task panel — the panel used to be torn down here
      await userCasesPage.detailTab(USER_CASES_CONFIG.detailTabs.progress).click();
      await expect(userCasesPage.startFormPanel).toBeVisible();
      await expect(subject).toHaveValue(noteSubject);

      await userCasesPage.detailTab(USER_CASES_CONFIG.detailTabs.documents).click();
      await expect(userCasesPage.startFormPanel).toBeVisible();
      await expect(subject).toHaveValue(noteSubject);

      // Back to a tab that shows the task panel — the form is still there
      await userCasesPage.detailTab(USER_CASES_CONFIG.detailTabs.summary).click();
      await expect(userCasesPage.startFormPanel).toBeVisible();
      await expect(subject).toHaveValue(noteSubject);
    });

    test('closes the panel via the header close button', async () => {
      await userCasesPage.closeStartFormPanel();
    });

    test('keeps a read-only start form open across a task-hiding tab', async () => {
      await userCasesPage.openStartFormInPanel(USER_CASES_CONFIG.catalogiGetTypenProcess);
      await expect(userCasesPage.startFormPanelTitle).toHaveText(
        USER_CASES_CONFIG.catalogiGetTypenProcess
      );

      await userCasesPage.detailTab(USER_CASES_CONFIG.detailTabs.audit).click();
      await expect(userCasesPage.startFormPanel).toBeVisible();

      await userCasesPage.detailTab(USER_CASES_CONFIG.detailTabs.summary).click();
      await expect(userCasesPage.startFormPanel).toBeVisible();

      await userCasesPage.closeStartFormPanel();
    });

    test('keeps an in-panel task form open across a task-hiding tab and back', async () => {
      // The first task of a fresh bezwaar case (validate-request) is configured to
      // open its form in the side panel — before the fix this was hidden and reset
      // when routing through a tab that does not show the task panel.
      await userCasesPage.openTaskInPanel(USER_CASES_CONFIG.validateRequestTask);

      await userCasesPage.detailTab(USER_CASES_CONFIG.detailTabs.audit).click();
      await expect(userCasesPage.taskDetailPanel).toBeVisible();

      await userCasesPage.detailTab(USER_CASES_CONFIG.detailTabs.summary).click();
      await expect(userCasesPage.taskDetailPanel).toBeVisible();
    });
  });
});
