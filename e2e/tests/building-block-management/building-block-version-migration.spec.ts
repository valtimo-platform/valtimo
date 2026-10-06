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
import {VERSION_MIGRATION} from './building-block-config';
import {BuildingBlockManagementPage} from './page';

test.use({storageState: undefined});

/**
 * gzac-issues#841 — migrate the references to an outdated building block version
 * from the building block management list.
 */
test.describe('Building block management — version migration wizard', () => {
  test.describe.configure({timeout: 120_000});

  let context;
  let page;
  let request;
  let buildingBlockPage: BuildingBlockManagementPage;

  const uniqueId = generateId();
  const sendEmail = `${VERSION_MIGRATION.sendEmailKeyPrefix}-${uniqueId}`;
  const draftContainer = `${VERSION_MIGRATION.draftContainerKeyPrefix}-${uniqueId}`;
  const notify = `${VERSION_MIGRATION.notifyKeyPrefix}-${uniqueId}`;
  const outer = `${VERSION_MIGRATION.outerKeyPrefix}-${uniqueId}`;
  const {sourceVersionTag, targetVersionTag, containerVersionTag, newDraftVersionTag} =
    VERSION_MIGRATION;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    buildingBlockPage = new BuildingBlockManagementPage(page, request);

    // send-email 1.0.0 and 1.0.1, both final.
    await buildingBlockPage.createBuildingBlockViaApi(sendEmail, sourceVersionTag);
    await buildingBlockPage.finalizeBuildingBlockViaApi(sendEmail, sourceVersionTag);
    await buildingBlockPage.createBuildingBlockDraftViaApi(
      sendEmail,
      sourceVersionTag,
      targetVersionTag
    );
    await buildingBlockPage.finalizeBuildingBlockViaApi(sendEmail, targetVersionTag);

    // A draft container that calls send-email 1.0.0.
    await buildingBlockPage.createBuildingBlockViaApi(draftContainer, containerVersionTag);
    await buildingBlockPage.linkMainProcessToBuildingBlockViaApi(
      draftContainer,
      containerVersionTag,
      VERSION_MIGRATION.sendEmailActivityId,
      sendEmail,
      sourceVersionTag
    );

    // A finalized chain: outer 1.0.0 → notify 1.0.0 → send-email 1.0.0.
    await buildingBlockPage.createBuildingBlockViaApi(notify, containerVersionTag);
    await buildingBlockPage.linkMainProcessToBuildingBlockViaApi(
      notify,
      containerVersionTag,
      VERSION_MIGRATION.sendEmailActivityId,
      sendEmail,
      sourceVersionTag
    );
    await buildingBlockPage.finalizeBuildingBlockViaApi(notify, containerVersionTag);

    await buildingBlockPage.createBuildingBlockViaApi(outer, containerVersionTag);
    await buildingBlockPage.linkMainProcessToBuildingBlockViaApi(
      outer,
      containerVersionTag,
      VERSION_MIGRATION.notifyActivityId,
      notify,
      containerVersionTag
    );
    await buildingBlockPage.finalizeBuildingBlockViaApi(outer, containerVersionTag);

    await page.goto('/');
  });

  test.afterAll(async () => {
    // Building block definitions cannot be removed: the management API has no
    // DELETE endpoint for them (see `deleteBuildingBlockViaApi`), and finalized
    // versions are immutable. The calls below are no-ops today and clean up once
    // that endpoint exists; until then the uniquely keyed fixture stays behind.
    for (const key of [outer, notify, draftContainer, sendEmail]) {
      for (const versionTag of new Set([sourceVersionTag, targetVersionTag])) {
        await buildingBlockPage.deleteBuildingBlockViaApi(key, versionTag);
      }
    }

    await context.close();
  });

  test('migrates send-email 1.0.0 to 1.0.1 in a draft and, opted in, through a finalized chain', async () => {
    await buildingBlockPage.openMigrationWizard();

    await buildingBlockPage.selectMigrationSource(sendEmail, sourceVersionTag);
    await buildingBlockPage.selectMigrationTarget(targetVersionTag);

    // One chain per reference: the draft one is selected by default, the one
    // through finalized building blocks has to be opted in.
    await expect(buildingBlockPage.migrationChain(sendEmail)).toHaveCount(2);
    await expect(buildingBlockPage.migrationChainCheckbox(draftContainer)).toBeChecked();
    await expect(buildingBlockPage.migrationChainCheckbox(outer)).not.toBeChecked();
    await buildingBlockPage.selectMigrationChain(outer);
    await buildingBlockPage.goToNextMigrationStep();

    await expect(buildingBlockPage.migrationDifferences).toHaveCount(2);
    await buildingBlockPage.goToNextMigrationStep();

    // Nothing is executed without an explicit confirmation.
    await expect(buildingBlockPage.migrationReview).toBeVisible();
    await expect(buildingBlockPage.migrationExecuteButton).toBeDisabled();
    await buildingBlockPage.confirmMigration();

    const response = await buildingBlockPage.executeMigration();
    expect(response.status()).toBe(200);

    // The summary links to the drafts that were created and modified.
    await expect(buildingBlockPage.migrationResult).toBeVisible();
    await expect(buildingBlockPage.migrationDraftLinks).toHaveCount(3);
    const draftLinkTexts = await buildingBlockPage.migrationDraftLinks.allInnerTexts();
    expect(draftLinkTexts.map(text => text.trim()).sort()).toEqual(
      [
        `${notify} ${newDraftVersionTag}`,
        `${outer} ${newDraftVersionTag}`,
        `${draftContainer} ${containerVersionTag}`,
      ].sort()
    );

    // The draft's link now points to the target version.
    const draftLink = await buildingBlockPage.getBuildingBlockProcessLinkViaApi(
      draftContainer,
      containerVersionTag,
      VERSION_MIGRATION.sendEmailActivityId
    );
    expect(draftLink).toMatchObject({
      buildingBlockDefinitionKey: sendEmail,
      buildingBlockDefinitionVersionTag: targetVersionTag,
    });

    // The finalized containers got new drafts, chained to each other and to 1.0.1...
    for (const key of [notify, outer]) {
      expect(await buildingBlockPage.getBuildingBlockVersionsViaApi(key)).toEqual(
        expect.arrayContaining([
          {versionTag: containerVersionTag, final: true},
          {versionTag: newDraftVersionTag, final: false},
        ])
      );
    }
    expect(
      await buildingBlockPage.getBuildingBlockProcessLinkViaApi(
        notify,
        newDraftVersionTag,
        VERSION_MIGRATION.sendEmailActivityId
      )
    ).toMatchObject({
      buildingBlockDefinitionKey: sendEmail,
      buildingBlockDefinitionVersionTag: targetVersionTag,
    });
    expect(
      await buildingBlockPage.getBuildingBlockProcessLinkViaApi(
        outer,
        newDraftVersionTag,
        VERSION_MIGRATION.notifyActivityId
      )
    ).toMatchObject({
      buildingBlockDefinitionKey: notify,
      buildingBlockDefinitionVersionTag: newDraftVersionTag,
    });

    // ...while the finalized versions themselves are unchanged.
    expect(
      await buildingBlockPage.getBuildingBlockProcessLinkViaApi(
        notify,
        containerVersionTag,
        VERSION_MIGRATION.sendEmailActivityId
      )
    ).toMatchObject({
      buildingBlockDefinitionKey: sendEmail,
      buildingBlockDefinitionVersionTag: sourceVersionTag,
    });
    expect(
      await buildingBlockPage.getBuildingBlockProcessLinkViaApi(
        outer,
        containerVersionTag,
        VERSION_MIGRATION.notifyActivityId
      )
    ).toMatchObject({
      buildingBlockDefinitionKey: notify,
      buildingBlockDefinitionVersionTag: containerVersionTag,
    });
  });
});
