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

enum VERSION_MIGRATION_STEP {
  SOURCE = 'source',
  TARGET = 'target',
  CHAINS = 'chains',
  DIFFERENCES = 'differences',
  REVIEW = 'review',
}

const VERSION_MIGRATION_STEPS = [
  VERSION_MIGRATION_STEP.SOURCE,
  VERSION_MIGRATION_STEP.TARGET,
  VERSION_MIGRATION_STEP.CHAINS,
  VERSION_MIGRATION_STEP.DIFFERENCES,
  VERSION_MIGRATION_STEP.REVIEW,
];

const VERSION_MIGRATION_PREVIEW_DEBOUNCE_MS = 300;

export {VERSION_MIGRATION_PREVIEW_DEBOUNCE_MS, VERSION_MIGRATION_STEP, VERSION_MIGRATION_STEPS};
