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

// Import directly from the constants file — importing from public_api pulls in Angular
// component code that Node cannot parse at test runtime.
export {
  LOGGING_LIST_TEST_IDS,
  LOG_SEARCH_TEST_IDS,
  LOG_DETAILS_TEST_IDS,
} from '../../frontend/projects/valtimo/logging/src/lib/constants/logging.test-ids';
