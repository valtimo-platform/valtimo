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

enum USAGE_UPDATE_STEP {
  SOURCE = 'source',
  TARGET = 'target',
  CHAINS = 'chains',
  DIFFERENCES = 'differences',
  REVIEW = 'review',
}

const USAGE_UPDATE_STEPS = [
  USAGE_UPDATE_STEP.SOURCE,
  USAGE_UPDATE_STEP.TARGET,
  USAGE_UPDATE_STEP.CHAINS,
  USAGE_UPDATE_STEP.DIFFERENCES,
  USAGE_UPDATE_STEP.REVIEW,
];

const USAGE_UPDATE_PREVIEW_DEBOUNCE_MS = 300;

export {USAGE_UPDATE_PREVIEW_DEBOUNCE_MS, USAGE_UPDATE_STEP, USAGE_UPDATE_STEPS};
