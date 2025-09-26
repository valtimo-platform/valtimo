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
import {DATA_FEATURES} from '../../constants';
import {DonutConfigurationComponent, DonutDisplayComponent} from './components';

export const donutSpecification: DisplayTypeSpecification = {
  displayTypeKey: 'donut',
  displayComponent: DonutDisplayComponent,
  configurationComponent: DonutConfigurationComponent,
  width: 1,
  height: 2,
  translations: {
    nl: {
      title: 'Donut-diagram',
      formTitle: 'Titel (vereist)',
      formTitleHelperText: 'De titel die wordt weergegeven in de widget',
      subtitle: 'Ondertitel',
      subtitleHelperText: 'De ondertitel weergegeven in de widget',
      label: 'Label',
      labelHelperText: 'Het label dat wordt weergegeven in de widget',
    },
    en: {
      title: 'Donut chart',
      formTitle: 'Title (required)',
      formTitleHelperText: 'The title displayed in the widget',
      subtitle: 'Subtitle',
      subtitleHelperText: 'The subtitle displayed in the widget',
      label: 'Label',
      labelHelperText: 'The label displayed in the widget',
    },
    de: {
      title: 'Donut-Diagramm',
      formTitle: 'Titel (erforderlich)',
      formTitleHelperText: 'Der im Widget angezeigte Titel',
      subtitle: 'Untertitel',
      subtitleHelperText: 'Der im Widget angezeigte Untertitel',
      label: 'Beschriftung',
      labelHelperText: 'Die im Widget angezeigte Beschriftung',
    },
  },
  requiredDataFeatures: [DATA_FEATURES.NUMBERS],
};
