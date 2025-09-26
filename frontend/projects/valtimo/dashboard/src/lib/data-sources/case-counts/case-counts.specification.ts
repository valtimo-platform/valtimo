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
import {CaseCountsConfigurationComponent} from './components';

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
      countsHelperText:
        "Geben Sie eine oder mehrere Bedingungen für mindestens zwei Anzahllen an. Zum Beispiel: 'case:createdBy', 'Gleich', 'test@test.com'. Zum Vergleichen mit leeren Werten kann als Wert '${null}' eingegeben werden. Zum Vergleichen mit dem aktuellen Datum kann als Wert '${localDateTimeNow}' eingegeben werden. Damit wird beispielsweise auch folgende Logik unterstützt: '${localDateTimeNow.minusWeeks(2)}'.",
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
      countsHelperText:
        "Specify one or more conditions for each count that should be displayed. For example: 'case:createdBy', 'Equal to', 'test@test.com'. Configure at least two counts and at least one condition per count.",
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
      countsHelperText:
        "Geef een of meer condities op voor een minimum van twee aantallen. Bijvoorbeeld: 'case:createdBy', 'Gelijk aan', 'test@test.com'. Voor het vergelijken met lege waardes kan '${null}' ingevuld worden als waarde. Voor het vergelijken met de huidige datum kan '${localDateTimeNow}' ingevuld worden als waarde. Deze ondersteunt ook bijvoorbeeld de volgende logica: '${localDateTimeNow.minusWeeks(2)}'.",
      addCondition: 'Conditie toevoegen',
      countTitle: 'Aantaltitel',
    },
  },
};
