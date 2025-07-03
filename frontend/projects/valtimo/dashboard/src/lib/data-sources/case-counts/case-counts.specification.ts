/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import {CaseCountsConfigurationComponent} from './components';
import {CONDITIONS_HELPER_TEXTS} from '../shared';

export const caseCountsDataSourceSpecification: DataSourceSpecification = {
  dataSourceKey: 'case-counts',
  configurationComponent: CaseCountsConfigurationComponent,
  translations: {
    de: {
      title: 'Mehrere Fallanzahllen',
      documentDefinition: 'Falltyp (erforderlich)',
      documentDefinitionHelperText: 'Der Falltyp, für den die Anzahllen abgeruft wirden',
      '!=': 'Nicht gleichzusetzen mit',
      '==': 'Gleich',
      '>': 'Größer als',
      '>=': 'Größer als oder gleich wie',
      '<': 'Weniger als',
      '<=': 'Gleich oder kleiner als',
      path: 'Pfad',
      operator: 'Operator',
      value: 'Wert',
      counts: 'Anzahllen',
      countsHelperText: `Geben Sie eine oder mehrere Bedingungen für jede anzuzeigende Zählung an. Konfigurieren Sie mindestens zwei Zählungen und mindestens eine Bedingung pro Zählung. ${CONDITIONS_HELPER_TEXTS.DE()}`,
      addCondition: 'Bedingung hinzufügen',
      countTitle: 'Anzahltitel',
    },
    en: {
      title: 'Multiple case counts',
      documentDefinition: 'Case type (required)',
      documentDefinitionHelperText: 'The case type for which the counts are retrieved',
      '!=': 'Not equal to',
      '==': 'Equal to',
      '>': 'Greater than',
      '>=': 'Greater than or equal to',
      '<': 'Less than',
      '<=': 'Less than or equal to',
      path: 'Path (required)',
      operator: 'Operator',
      value: 'Value',
      counts: 'Counts',
      countsHelperText: `Specify one or more conditions for each count that should be displayed. Configure at least two counts and at least one condition per count. ${CONDITIONS_HELPER_TEXTS.EN()}`,
      addCondition: 'Add condition',
      countTitle: 'Count title',
    },
    nl: {
      title: 'Meerdere dossieraantallen',
      documentDefinition: 'Dossiertype (vereist)',
      documentDefinitionHelperText: 'Het dossiertype waarvoor de aantallen worden opgehaald',
      '!=': 'Niet gelijk aan',
      '==': 'Gelijk aan',
      '>': 'Groter dan',
      '>=': 'Groter dan of gelijk aan',
      '<': 'Minder dan',
      '<=': 'Minder dan of gelijk aan',
      path: 'Pad',
      operator: 'Operator',
      value: 'Waarde',
      counts: 'Aantallen',
      countsHelperText: `Geef een of meer condities op voor elk aantal dat moet worden weergegeven. Configureer minimaal twee aantallen en minimaal één conditie per aantal. ${CONDITIONS_HELPER_TEXTS.NL()}`,
      addCondition: 'Conditie toevoegen',
      countTitle: 'Aantaltitel',
    },
  },
};
