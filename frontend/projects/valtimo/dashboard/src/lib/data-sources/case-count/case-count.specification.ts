/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
import {CaseCountConfigurationComponent} from './components';

export const caseCountDataSourceSpecification: DataSourceSpecification = {
  dataSourceKey: 'case-count',
  configurationComponent: CaseCountConfigurationComponent,
  translations: {
    de: {
      title: 'Fallzahl',
      documentDefinition: 'Falltyp',
      documentDefinitionHelperText: 'Der Falltyp, für den die Anzahl abgerufen wird',
      '!=': 'Nicht gleichzusetzen mit',
      '==': 'Gleich',
      '>': 'Größer als',
      '>=': 'Größer als oder gleich wie',
      '<': 'Weniger als',
      '<=': 'Gleich oder kleiner als',
      path: 'Pfad',
      operator: 'Operator',
      value: 'Wert in Wochen',
    },
    en: {
      title: 'Case count',
      documentDefinition: 'Case type',
      documentDefinitionHelperText: 'The case type for which the count is retrieved',
      '!=': 'Not equal to',
      '==': 'Equal to',
      '>': 'Greater than',
      '>=': 'Greater than or equal to',
      '<': 'Less than',
      '<=': 'Less than or equal to',
      path: 'Path (required)',
      operator: 'Operator',
      value: 'Value in weeks',
    },
    nl: {
      title: 'Aantal dossiers',
      documentDefinition: 'Dossiertype',
      documentDefinitionHelperText: 'Het dossiertype waarvoor de telling wordt opgehaald',
      '!=': 'Niet gelijk aan',
      '==': 'Gelijk aan',
      '>': 'Groter dan',
      '>=': 'Groter dan of gelijk aan',
      '<': 'Minder dan',
      '<=': 'Minder dan of gelijk aan',
      path: 'Pad',
      operator: 'Operator',
      value: 'Waarde in weken',
    },
  },
};
