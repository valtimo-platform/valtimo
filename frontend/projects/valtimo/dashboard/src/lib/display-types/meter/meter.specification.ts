/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import {DisplayTypeSpecification} from '../../models';
import {MeterDisplayComponent} from './components/meter-display/meter-display.component';

export const meterSpecification: DisplayTypeSpecification = {
  displayTypeKey: 'meter',
  displayComponent: MeterDisplayComponent,
  width: 2,
  height: 1,
  translations: {
    nl: {
      title: 'Meter',
    },
    en: {
      title: 'Meter',
    },
    de: {
      title: 'Meter',
    },
  },
  requiredDataFeatures: [],
};
