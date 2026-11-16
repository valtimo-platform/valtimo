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

import {ExchangeEstafetteStage} from '../models';

const ESTAFETTE_STAGES: ReadonlyArray<ExchangeEstafetteStage> = [
  'HELP_WANTED',
  'COMMUNITY',
  'CANDIDATE',
  'HALL_OF_FAME',
];

const ESTAFETTE_TAG_TYPES: Record<ExchangeEstafetteStage, 'magenta' | 'blue' | 'purple' | 'green'> =
  {
    HELP_WANTED: 'magenta',
    COMMUNITY: 'blue',
    CANDIDATE: 'purple',
    HALL_OF_FAME: 'green',
  };

const nextEstafetteStage = (stage: ExchangeEstafetteStage): ExchangeEstafetteStage | null =>
  ESTAFETTE_STAGES[ESTAFETTE_STAGES.indexOf(stage) + 1] ?? null;

export {ESTAFETTE_STAGES, ESTAFETTE_TAG_TYPES, nextEstafetteStage};
