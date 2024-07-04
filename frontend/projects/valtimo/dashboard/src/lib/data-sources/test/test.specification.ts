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

import {DataSourceSpecification} from '../../models';
import {TestConfigurationComponent} from './components';

export const testDataSourceSpecification: DataSourceSpecification = {
  dataSourceKey: 'test',
  configurationComponent: TestConfigurationComponent,
  translations: {
    de: {
      title: 'Test-Datenquelle',
      value: 'Wert (erforderlich)',
      valueHelperText: 'Der im Widget angezeigte Wert',
      total: 'Gesamtwert (erforderlich)',
      totalHelperText: 'Der im Widget angezeigte Gesamtwert',
    },
    en: {
      title: 'Test data source',
      value: 'Value (required)',
      valueHelperText: 'The value displayed in the widget',
      total: 'Total value (required)',
      totalHelperText: 'The total value displayed in the widget',
    },
    nl: {
      title: 'Testdatabron',
      value: 'Waarde (vereist)',
      valueHelperText: 'De waarde die wordt weergegeven in de widget',
      total: 'Totaalwaarde (vereist)',
      totalHelperText: 'De totaalwaarde die wordt weergegeven in de widget',
    },
  },
};
