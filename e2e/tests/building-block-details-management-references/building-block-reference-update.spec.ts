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
import {REFERENCE_UPDATE} from './building-block-references-config';
import {BuildingBlockReferencesPage} from './page';

test.use({storageState: undefined});

// gzac-issues#841: update references to an outdated building block version
test.describe('Building block details — references tab', () => {
  test.describe.configure({timeout: 120_000});

  let context;
  let page;
  let request;
  let buildingBlockPage: BuildingBlockReferencesPage;

  const uniqueId = generateId();
  const sendEmail = `${REFERENCE_UPDATE.sendEmailKeyPrefix}-${uniqueId}`;
  const draftContainer = `${REFERENCE_UPDATE.draftContainerKeyPrefix}-${uniqueId}`;
  const notify = `${REFERENCE_UPDATE.notifyKeyPrefix}-${uniqueId}`;
  const outer = `${REFERENCE_UPDATE.outerKeyPrefix}-${uniqueId}`;
  const {sourceVersionTag, targetVersionTag, containerVersionTag, newDraftVersionTag} =
    REFERENCE_UPDATE;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    buildingBlockPage = new BuildingBlockReferencesPage(page, request);

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
      REFERENCE_UPDATE.sendEmailActivityId,
      sendEmail,
      sourceVersionTag
    );

    // A finalized chain: outer 1.0.0 → notify 1.0.0 → send-email 1.0.0.
    await buildingBlockPage.createBuildingBlockViaApi(notify, containerVersionTag);
    await buildingBlockPage.linkMainProcessToBuildingBlockViaApi(
      notify,
      containerVersionTag,
      REFERENCE_UPDATE.sendEmailActivityId,
      sendEmail,
      sourceVersionTag
    );
    await buildingBlockPage.finalizeBuildingBlockViaApi(notify, containerVersionTag);

    await buildingBlockPage.createBuildingBlockViaApi(outer, containerVersionTag);
    await buildingBlockPage.linkMainProcessToBuildingBlockViaApi(
      outer,
      containerVersionTag,
      REFERENCE_UPDATE.notifyActivityId,
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

  test('updates a draft reference and an opted-in finalized chain', async () => {
    await buildingBlockPage.goToReferencesTab(sendEmail, sourceVersionTag);

    // Direct references only: outer reaches send-email through notify
    await expect(buildingBlockPage.referenceRow(draftContainer)).toHaveCount(1);
    await expect(buildingBlockPage.referenceRow(notify)).toHaveCount(1);
    await expect(buildingBlockPage.referenceRow(outer)).toHaveCount(0);

    // Building block process pages are routed by process definition id, not key
    await buildingBlockPage.referenceLink(draftContainer).click();
    await expect(page).toHaveURL(
      new RegExp(
        `/building-block/${draftContainer}/version/${containerVersionTag}/process-definition/`
      )
    );
    await expect(page.locator('.djs-container').first()).toBeVisible();
    await buildingBlockPage.goToReferencesTab(sendEmail, sourceVersionTag);

    await buildingBlockPage.openReferenceUpdateWizard();
    await buildingBlockPage.selectReferenceUpdateTarget(targetVersionTag);

    // Draft chain selected by default; finalized chain is opt-in
    await expect(buildingBlockPage.referenceUpdateChains).toHaveCount(2);
    await expect(buildingBlockPage.referenceUpdateChain(draftContainer)).toHaveCount(1);
    await expect(buildingBlockPage.referenceUpdateChain(outer)).toHaveCount(1);
    await expect(buildingBlockPage.referenceUpdateChainCheckbox(draftContainer)).toBeChecked();
    await expect(buildingBlockPage.referenceUpdateChainCheckbox(outer)).not.toBeChecked();
    await buildingBlockPage.selectReferenceUpdateChain(outer);
    await buildingBlockPage.goToNextReferenceUpdateStep();

    await expect(buildingBlockPage.referenceUpdateDifferences).toHaveCount(2);
    await buildingBlockPage.goToNextReferenceUpdateStep();

    // Finalized notify and outer get new drafts; the draft container is changed in place
    await expect(buildingBlockPage.referenceUpdateReview).toBeVisible();
    await expect(buildingBlockPage.referenceUpdateReviewDraftsToCreate).toContainText(notify);
    await expect(buildingBlockPage.referenceUpdateReviewDraftsToCreate).toContainText(outer);
    await expect(buildingBlockPage.referenceUpdateReviewDraftsToCreate).not.toContainText(
      draftContainer
    );
    await expect(buildingBlockPage.referenceUpdateReviewDraftsToModify).toContainText(
      draftContainer
    );
    await expect(buildingBlockPage.referenceUpdateReviewDraftsToModify).not.toContainText(notify);
    for (const key of [draftContainer, notify, outer]) {
      await expect(buildingBlockPage.referenceUpdateReviewLinksToRepoint).toContainText(key);
    }

    // Nothing is executed without an explicit confirmation.
    await expect(buildingBlockPage.referenceUpdateExecuteButton).toBeDisabled();
    await buildingBlockPage.confirmReferenceUpdate();

    const response = await buildingBlockPage.executeReferenceUpdate();
    expect(response.status()).toBe(200);

    // The summary links to the drafts that were created and modified.
    await expect(buildingBlockPage.referenceUpdateResult).toBeVisible();
    await expect(buildingBlockPage.referenceUpdateDraftLinks).toHaveCount(3);
    const createdTexts = await buildingBlockPage.referenceUpdateCreatedDraftLinks.allInnerTexts();
    expect(createdTexts.map(text => text.trim()).sort()).toEqual(
      [`${notify} ${newDraftVersionTag}`, `${outer} ${newDraftVersionTag}`].sort()
    );
    const modifiedTexts = await buildingBlockPage.referenceUpdateModifiedDraftLinks.allInnerTexts();
    expect(modifiedTexts.map(text => text.trim())).toEqual([
      `${draftContainer} ${containerVersionTag}`,
    ]);
    // The finalized notify keeps referencing the source version
    await expect(buildingBlockPage.referenceUpdateRemainingReferences).toContainText(notify);
    await expect(buildingBlockPage.referenceUpdateRemainingReferences).not.toContainText(
      draftContainer
    );

    // Only the unchanged finalized notify still references the source version
    await buildingBlockPage.closeReferenceUpdateWizard();
    await expect(buildingBlockPage.referenceRow(draftContainer)).toHaveCount(0);
    await expect(buildingBlockPage.referenceRow(notify)).toHaveCount(1);

    // The draft's link now points to the target version.
    const draftLink = await buildingBlockPage.getBuildingBlockProcessLinkViaApi(
      draftContainer,
      containerVersionTag,
      REFERENCE_UPDATE.sendEmailActivityId
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
        REFERENCE_UPDATE.sendEmailActivityId
      )
    ).toMatchObject({
      buildingBlockDefinitionKey: sendEmail,
      buildingBlockDefinitionVersionTag: targetVersionTag,
    });
    expect(
      await buildingBlockPage.getBuildingBlockProcessLinkViaApi(
        outer,
        newDraftVersionTag,
        REFERENCE_UPDATE.notifyActivityId
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
        REFERENCE_UPDATE.sendEmailActivityId
      )
    ).toMatchObject({
      buildingBlockDefinitionKey: sendEmail,
      buildingBlockDefinitionVersionTag: sourceVersionTag,
    });
    expect(
      await buildingBlockPage.getBuildingBlockProcessLinkViaApi(
        outer,
        containerVersionTag,
        REFERENCE_UPDATE.notifyActivityId
      )
    ).toMatchObject({
      buildingBlockDefinitionKey: notify,
      buildingBlockDefinitionVersionTag: containerVersionTag,
    });
  });

  // ─── Failure scenarios ──────────────────────────────────────────────

  test.describe('Failure scenarios', () => {
    const selfId = generateId();
    const callee = `${REFERENCE_UPDATE.sendEmailKeyPrefix}-self-${selfId}`;
    const caller = `${REFERENCE_UPDATE.draftContainerKeyPrefix}-self-${selfId}`;
    const inputId = generateId();
    const requiringCallee = `${REFERENCE_UPDATE.sendEmailKeyPrefix}-input-${inputId}`;
    const requiringCaller = `${REFERENCE_UPDATE.draftContainerKeyPrefix}-input-${inputId}`;

    test.afterAll(async () => {
      for (const [key, versionTag] of [
        [caller, newDraftVersionTag],
        [caller, containerVersionTag],
        [callee, sourceVersionTag],
        [requiringCaller, containerVersionTag],
        [requiringCallee, targetVersionTag],
        [requiringCallee, sourceVersionTag],
      ]) {
        await buildingBlockPage.deleteBuildingBlockViaApi(key, versionTag).catch(() => undefined);
      }
    });

    test('rejects an input path without a doc: or case: prefix', async () => {
      // The target version requires a field the existing link does not map
      await buildingBlockPage.createBuildingBlockViaApi(requiringCallee, sourceVersionTag);
      await buildingBlockPage.finalizeBuildingBlockViaApi(requiringCallee, sourceVersionTag);
      await buildingBlockPage.createBuildingBlockDraftViaApi(
        requiringCallee,
        sourceVersionTag,
        targetVersionTag
      );
      await buildingBlockPage.addRequiredDocumentFieldViaApi(
        requiringCallee,
        targetVersionTag,
        REFERENCE_UPDATE.requiredTargetField
      );
      await buildingBlockPage.finalizeBuildingBlockViaApi(requiringCallee, targetVersionTag);
      await buildingBlockPage.createBuildingBlockViaApi(requiringCaller, containerVersionTag);
      await buildingBlockPage.linkMainProcessToBuildingBlockViaApi(
        requiringCaller,
        containerVersionTag,
        REFERENCE_UPDATE.sendEmailActivityId,
        requiringCallee,
        sourceVersionTag
      );

      await buildingBlockPage.goToReferencesTab(requiringCallee, sourceVersionTag);
      await buildingBlockPage.openReferenceUpdateWizard();
      await buildingBlockPage.selectReferenceUpdateTarget(targetVersionTag);
      await expect(buildingBlockPage.referenceUpdateChainCheckbox(requiringCaller)).toBeChecked();
      await buildingBlockPage.goToNextReferenceUpdateStep();

      await expect(buildingBlockPage.referenceUpdateInputMappings).toHaveCount(1);
      await expect(buildingBlockPage.referenceUpdateNextButton).toBeDisabled();

      await buildingBlockPage.enterReferenceUpdateInputPath(REFERENCE_UPDATE.unprefixedInputPath);
      await expect(buildingBlockPage.referenceUpdateInputPathInvalid).toBeVisible();
      await expect(buildingBlockPage.referenceUpdateNextButton).toBeDisabled();

      await buildingBlockPage.enterReferenceUpdateInputPath(REFERENCE_UPDATE.validInputPath);
      await expect(buildingBlockPage.referenceUpdateInputPathInvalid).toBeHidden();
      await expect(buildingBlockPage.referenceUpdateNextButton).toBeEnabled();

      // Nothing was executed: the link still points at the source version
      await buildingBlockPage.cancelReferenceUpdateWizard();
      expect(
        await buildingBlockPage.getBuildingBlockProcessLinkViaApi(
          requiringCaller,
          containerVersionTag,
          REFERENCE_UPDATE.sendEmailActivityId
        )
      ).toMatchObject({
        buildingBlockDefinitionKey: requiringCallee,
        buildingBlockDefinitionVersionTag: sourceVersionTag,
      });
    });

    test('refuses a target that would make the referencing building block call itself', async () => {
      await buildingBlockPage.createBuildingBlockViaApi(callee, sourceVersionTag);
      await buildingBlockPage.finalizeBuildingBlockViaApi(callee, sourceVersionTag);
      await buildingBlockPage.createBuildingBlockViaApi(caller, containerVersionTag);
      await buildingBlockPage.finalizeBuildingBlockViaApi(caller, containerVersionTag);
      await buildingBlockPage.createBuildingBlockDraftViaApi(
        caller,
        containerVersionTag,
        newDraftVersionTag
      );
      await buildingBlockPage.linkMainProcessToBuildingBlockViaApi(
        caller,
        newDraftVersionTag,
        REFERENCE_UPDATE.sendEmailActivityId,
        callee,
        sourceVersionTag
      );

      await buildingBlockPage.goToReferencesTab(callee, sourceVersionTag);
      await buildingBlockPage.updateReferencesButton.click();
      await buildingBlockPage.selectReferenceUpdateTargetKey(caller);
      await buildingBlockPage.selectReferenceUpdateTarget(containerVersionTag);

      // Deploy would bind the call to the caller's own process
      await expect(
        buildingBlockPage.referenceUpdateChainReason(caller, 'SELF_REFERENCE')
      ).toBeVisible();
      await expect(buildingBlockPage.referenceUpdateChainCheckbox(caller)).not.toBeChecked();
      await expect(buildingBlockPage.referenceUpdateChainCheckbox(caller)).toBeDisabled();
      await expect(buildingBlockPage.referenceUpdateNextButton).toBeDisabled();
    });
  });
});
