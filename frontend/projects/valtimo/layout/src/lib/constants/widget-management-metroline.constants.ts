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

import {MetrolineMode} from '../models';

const METROLINE_MODE_OPTIONS: MetrolineMode[] = [
  MetrolineMode.INTERNAL_CASE_STATUS,
  MetrolineMode.ZAAKSTATUS,
];

const METROLINE_MODE_TRANSLATION_KEYS: Record<MetrolineMode, string> = {
  [MetrolineMode.INTERNAL_CASE_STATUS]:
    'widgetTabManagement.content.metroline.statusSource.internalStatus',
  [MetrolineMode.ZAAKSTATUS]: 'widgetTabManagement.content.metroline.statusSource.zaakStatus',
};

export {METROLINE_MODE_OPTIONS, METROLINE_MODE_TRANSLATION_KEYS};
