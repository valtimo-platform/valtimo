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
import {USAGE_UPDATE} from './building-block-config';
import {BuildingBlockManagementPage} from './page';

test.use({storageState: undefined});

// gzac-issues#841: update usages of an outdated building block version
test.describe('Building block management — usage update wizard', () => {
  test.describe.configure({timeout: 120_000});

  let context;
  let page;
  let request;
  let buildingBlockPage: BuildingBlockManagementPage;

  const uniqueId = generateId();
  const sendEmail = `${USAGE_UPDATE.sendEmailKeyPrefix}-${uniqueId}`;
  const draftContainer = `${USAGE_UPDATE.draftContainerKeyPrefix}-${uniqueId}`;
  const notify = `${USAGE_UPDATE.notifyKeyPrefix}-${uniqueId}`;
  const outer = `${USAGE_UPDATE.outerKeyPrefix}-${uniqueId}`;
  const {sourceVersionTag, targetVersionTag, containerVersionTag, newDraftVersionTag} =
    USAGE_UPDATE;

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
      USAGE_UPDATE.sendEmailActivityId,
      sendEmail,
      sourceVersionTag
    );

    // A finalized chain: outer 1.0.0 → notify 1.0.0 → send-email 1.0.0.
    await buildingBlockPage.createBuildingBlockViaApi(notify, containerVersionTag);
    await buildingBlockPage.linkMainProcessToBuildingBlockViaApi(
      notify,
      containerVersionTag,
      USAGE_UPDATE.sendEmailActivityId,
      sendEmail,
      sourceVersionTag
    );
    await buildingBlockPage.finalizeBuildingBlockViaApi(notify, containerVersionTag);

    await buildingBlockPage.createBuildingBlockViaApi(outer, containerVersionTag);
    await buildingBlockPage.linkMainProcessToBuildingBlockViaApi(
      outer,
      containerVersionTag,
      USAGE_UPDATE.notifyActivityId,
      notify,
      containerVersionTag
    );
    await buildingBlockPage.finalizeBuildingBlockViaApi(outer, containerVersionTag);

    await page.goto('/');
  });

  test.afterAll(async () => {
    // No-op until a building block DELETE endpoint exists
    for (const key of [outer, notify, draftContainer, sendEmail]) {
      for (const versionTag of new Set([sourceVersionTag, targetVersionTag])) {
        await buildingBlockPage.deleteBuildingBlockViaApi(key, versionTag);
      }
    }

    await context.close();
  });

  test('updates a draft usage and an opted-in finalized chain', async () => {
    await buildingBlockPage.openUsageUpdateWizard();

    await buildingBlockPage.selectUsageUpdateSource(sendEmail, sourceVersionTag);
    await buildingBlockPage.selectUsageUpdateTarget(targetVersionTag);

    // Draft chain selected by default; finalized chain is opt-in
    await expect(buildingBlockPage.usageUpdateChain(sendEmail)).toHaveCount(2);
    await expect(buildingBlockPage.usageUpdateChainCheckbox(draftContainer)).toBeChecked();
    await expect(buildingBlockPage.usageUpdateChainCheckbox(outer)).not.toBeChecked();
    await buildingBlockPage.selectUsageUpdateChain(outer);
    await buildingBlockPage.goToNextUsageUpdateStep();

    await expect(buildingBlockPage.usageUpdateDifferences).toHaveCount(2);
    await buildingBlockPage.goToNextUsageUpdateStep();

    // Nothing is executed without an explicit confirmation.
    await expect(buildingBlockPage.usageUpdateReview).toBeVisible();
    await expect(buildingBlockPage.usageUpdateExecuteButton).toBeDisabled();
    await buildingBlockPage.confirmUsageUpdate();

    const response = await buildingBlockPage.executeUsageUpdate();
    expect(response.status()).toBe(200);

    // The summary links to the drafts that were created and modified.
    await expect(buildingBlockPage.usageUpdateResult).toBeVisible();
    await expect(buildingBlockPage.usageUpdateDraftLinks).toHaveCount(3);
    const draftLinkTexts = await buildingBlockPage.usageUpdateDraftLinks.allInnerTexts();
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
      USAGE_UPDATE.sendEmailActivityId
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
        USAGE_UPDATE.sendEmailActivityId
      )
    ).toMatchObject({
      buildingBlockDefinitionKey: sendEmail,
      buildingBlockDefinitionVersionTag: targetVersionTag,
    });
    expect(
      await buildingBlockPage.getBuildingBlockProcessLinkViaApi(
        outer,
        newDraftVersionTag,
        USAGE_UPDATE.notifyActivityId
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
        USAGE_UPDATE.sendEmailActivityId
      )
    ).toMatchObject({
      buildingBlockDefinitionKey: sendEmail,
      buildingBlockDefinitionVersionTag: sourceVersionTag,
    });
    expect(
      await buildingBlockPage.getBuildingBlockProcessLinkViaApi(
        outer,
        containerVersionTag,
        USAGE_UPDATE.notifyActivityId
      )
    ).toMatchObject({
      buildingBlockDefinitionKey: notify,
      buildingBlockDefinitionVersionTag: containerVersionTag,
    });
  });
});
