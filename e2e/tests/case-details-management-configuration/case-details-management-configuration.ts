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

import {generateId} from '../../utils/dataGenerator';

export const DRAFT_CASE_IDENTIFIER = 'bezwaar';

// Finalized on purpose and therefore permanent, like the e2e-final-test fixture in case-management.
export const FINAL_CASE_KEY = 'e2e-case-configuration';
export const FINAL_CASE_VERSION = '1.0.0';
export const FINAL_CONFIGURATION_KEY = 'e2eNotificationEmail';
export const FINAL_CONFIGURATION_DEFAULT = 'test@example.com';

export function createConfigurationTestData() {
  const id = generateId();
  return {
    key: `e2e-email-${id}`,
    defaultValue: 'test@example.com',
    updatedDefaultValue: 'non-production@example.com',
    environmentValue: 'afdeling@example.com',
  };
}
