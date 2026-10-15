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
import {likeConditionTestData, permissionTestData} from './access-control';
import {AccessControlPage} from './page';

test.describe('Access Control Management — "contains the text" operator', () => {
  let accessControlPage: AccessControlPage;

  test.beforeEach(async ({page, request}) => {
    accessControlPage = new AccessControlPage(page, request);
    // A run that failed half-way may have left the role behind
    await accessControlPage.deleteRolesViaApi([likeConditionTestData.roleKey]);
    await accessControlPage.goToAccessControlList();
  });

  test.afterEach(async () => {
    await accessControlPage.deleteRolesViaApi([likeConditionTestData.roleKey]);
  });

  test('A condition built with "contains the text" is saved as like and shown in the summary', async () => {
    test.setTimeout(90_000);

    // Arrange
    await accessControlPage.addRole(likeConditionTestData.roleKey);
    await accessControlPage.assertRoleExists(likeConditionTestData.roleKey);
    await accessControlPage.openRole(likeConditionTestData.roleKey);

    // Act — the operator is picked by its label, so this fails if the select does not offer it
    await accessControlPage.addPermissionButton.click();
    await expect(accessControlPage.permissionCards.first()).toBeVisible();
    await accessControlPage.selectResourceType(permissionTestData.resourceType);
    await accessControlPage.toggleAction(permissionTestData.actionLabel);
    await accessControlPage.addPermissionCondition({
      field: permissionTestData.conditionField,
      operator: likeConditionTestData.operatorLabel,
      value: likeConditionTestData.value,
    });
    await accessControlPage.savePermissions(likeConditionTestData.roleKey);

    // Assert — stored with the technical operator
    await accessControlPage.assertRolePermissions(
      likeConditionTestData.roleKey,
      permissions =>
        permissions.some(
          p =>
            p.resourceType === permissionTestData.resourceTypeFqn &&
            p.conditions.some(
              c =>
                c.field === permissionTestData.conditionField &&
                c.operator === likeConditionTestData.operator &&
                c.value === likeConditionTestData.value
            )
        ),
      'no permission with a like condition was saved'
    );

    // Assert — the summary renders the operator by its label, not as "like"
    await accessControlPage.summaryTab.click();
    await expect(accessControlPage.summaryOperators).toHaveText([
      likeConditionTestData.operatorLabel,
    ]);
  });
});
