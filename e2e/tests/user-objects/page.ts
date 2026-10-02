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

import {type Locator, type Page, expect} from '@playwright/test';
import {OBJECT_DETAIL_TEST_IDS, OBJECT_LIST_TEST_IDS} from '../../constants';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import {apiGet} from '../../utils/api.utils';
import {USER_OBJECTS_API} from './user-objects-config';

/** A configuration as the user-facing endpoint returns it. */
export interface UserObjectConfiguration {
  id: string;
  title: string;
  formDefinitionView: string | null;
  formDefinitionEdit: string | null;
}

/** One page of objects. */
export interface ObjectPage {
  content: Array<{id: string; items: Array<{key: string; value: unknown}>}>;
  totalElements: number;
}

export class UserObjectsPage {
  readonly carbonList: CarbonList;

  constructor(private readonly page: Page) {
    this.carbonList = new CarbonList(page);
  }

  // ─── List ─────────────────────────────────────────────────────────

  get createButton(): Locator {
    return this.page.getByTestId(OBJECT_LIST_TEST_IDS.createButton);
  }

  // ─── Detail ───────────────────────────────────────────────────────

  get editButton(): Locator {
    return this.page.getByTestId(OBJECT_DETAIL_TEST_IDS.editButton);
  }

  get deleteButton(): Locator {
    return this.page.getByTestId(OBJECT_DETAIL_TEST_IDS.deleteButton);
  }

  get summaryForm(): Locator {
    return this.page.getByTestId(OBJECT_DETAIL_TEST_IDS.summaryForm);
  }

  // ─── Navigation ───────────────────────────────────────────────────

  /**
   * While the objects are still being fetched the component renders a *second*
   * `valtimo-carbon-list` as its loading placeholder, and that one has no
   * columns. `CarbonList` resolves to the first match, so the wait is for the
   * placeholder to go away — not just for a table to appear.
   */
  async goToObjectList(objectManagementId: string) {
    await this.page.goto(`/objects/${objectManagementId}`);
    await this.page.waitForURL(new RegExp(`/objects/${objectManagementId}$`));
    await expect(this.page.locator('valtimo-carbon-list')).toHaveCount(1);
    await this.carbonList.waitForLoaded();
    await expect(this.carbonList.table).toBeVisible();
    await expect(this.carbonList.rows.first()).toBeVisible();
  }

  async goToObjectDetail(objectManagementId: string, objectId: string) {
    await this.page.goto(`/objects/${objectManagementId}/${objectId}`);
    await this.page.waitForURL(new RegExp(`/objects/${objectManagementId}/${objectId}$`));
  }

  // ─── Assertions ───────────────────────────────────────────────────

  /**
   * Polled: on a cold load the header cells are appended a tick after the rows,
   * so a straight read can still come back empty.
   */
  async assertColumnHeaders(expectedHeaders: readonly string[]) {
    await expect
      .poll(async () => {
        const headers = await this.carbonList.table.locator('thead th').allInnerTexts();
        return headers.map(header => header.trim()).filter(Boolean);
      })
      .toEqual([...expectedHeaders]);
  }

  // ─── API helpers ──────────────────────────────────────────────────

  async getConfigurationsViaApi(): Promise<UserObjectConfiguration[]> {
    return apiGet<UserObjectConfiguration[]>(USER_OBJECTS_API.configurations);
  }

  /**
   * The configuration the tests read. Only configurations flagged
   * `showInDataMenu` are served here, so a missing one means the environment is
   * not seeded as expected rather than a broken test.
   */
  async getConfigurationByTitleViaApi(title: string): Promise<UserObjectConfiguration | undefined> {
    const configurations = await this.getConfigurationsViaApi();
    return configurations.find(configuration => configuration.title === title);
  }

  async getObjectsViaApi(objectManagementId: string, size = 10): Promise<ObjectPage> {
    return apiGet<ObjectPage>(
      `${USER_OBJECTS_API.objects(objectManagementId)}?page=0&size=${size}`
    );
  }

  /** The plain object id, which the detail route uses, from the record's URL. */
  static objectIdFromUrl(objectUrl: string): string {
    return objectUrl.split('/').pop() ?? '';
  }
}
