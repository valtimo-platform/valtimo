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
import {CaseCountConfigurationComponent} from './components';

export const caseCountDataSourceSpecification: DataSourceSpecification = {
  dataSourceKey: 'case-count',
  configurationComponent: CaseCountConfigurationComponent,
  translations: {
    de: {
      title: 'Fallzahl',
      documentDefinition: 'Falltyp (erforderlich)',
      documentDefinitionHelperText: 'Der Falltyp, für den die Anzahl abgerufen wird',
      '!=': 'Nicht gleichzusetzen mit',
      '==': 'Gleich',
      '>': 'Größer als',
      '>=': 'Größer als oder gleich wie',
      '<': 'Weniger als',
      '<=': 'Gleich oder kleiner als',
      path: 'Pfad',
      operator: 'Operator',
      value: 'Wert',
      conditions: 'Bedingungen',
      conditionsHelperText:
        "Geben Sie optionale Bedingungen zum Abrufen der Anzahl der Fälle für den ausgewählten Falltyp an. Zum Beispiel: 'case:createdBy', 'Gleich', 'test@test.com'. Zum Vergleichen mit leeren Werten kann als Wert '${null}' eingegeben werden. Zum Vergleichen mit dem aktuellen Datum kann als Wert '${localDateTimeNow}' eingegeben werden. Damit wird beispielsweise auch folgende Logik unterstützt: '${localDateTimeNow.minusWeeks(2)}'.",
      addCondition: 'Bedingung hinzufügen',
    },
    en: {
      title: 'Case count',
      documentDefinition: 'Case type (required)',
      documentDefinitionHelperText: 'The case type for which the count is retrieved',
      '!=': 'Not equal to',
      '==': 'Equal to',
      '>': 'Greater than',
      '>=': 'Greater than or equal to',
      '<': 'Less than',
      '<=': 'Less than or equal to',
      path: 'Path (required)',
      operator: 'Operator',
      value: 'Value',
      conditions: 'Conditions',
      conditionsHelperText:
        "Specify optional conditions for retrieving the number of cases for the selected case type. For example: 'case:createdBy', 'Equal to', 'test@test.com'. To compare with empty values, '${null}' can be entered as a value. To compare with the current date, '${localDateTimeNow}' can be entered as a value. This also supports, for example, the following logic: '${localDateTimeNow.minusWeeks(2)}'.",
      addCondition: 'Add condition',
    },
    nl: {
      title: 'Aantal dossiers',
      documentDefinition: 'Dossiertype (vereist)',
      documentDefinitionHelperText: 'Het dossiertype waarvoor de telling wordt opgehaald',
      '!=': 'Niet gelijk aan',
      '==': 'Gelijk aan',
      '>': 'Groter dan',
      '>=': 'Groter dan of gelijk aan',
      '<': 'Minder dan',
      '<=': 'Minder dan of gelijk aan',
      path: 'Pad',
      operator: 'Operator',
      value: 'Waarde',
      conditions: 'Condities',
      conditionsHelperText:
        "Geef optionele condities op voor het ophalen van het aantal zaken voor het geselecteerde zaaktype. Bijvoorbeeld: 'case:createdBy', 'Gelijk aan', 'test@test.com'. Voor het vergelijken met lege waardes kan '${null}' ingevuld worden als waarde. Voor het vergelijken met de huidige datum kan '${localDateTimeNow}' ingevuld worden als waarde. Deze ondersteunt ook bijvoorbeeld de volgende logica: '${localDateTimeNow.minusWeeks(2)}'.",
      addCondition: 'Conditie toevoegen',
    },
  },
};
