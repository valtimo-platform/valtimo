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
import {CaseGroupByConfigurationComponent} from './components';

export const caseGroupByDataSourceSpecification: DataSourceSpecification = {
  dataSourceKey: 'case-group-by',
  configurationComponent: CaseGroupByConfigurationComponent,
  translations: {
    de: {
      title: 'Gruppe',
      documentDefinition: 'Falltyp (erforderlich)',
      documentDefinitionHelperText: 'Der Falltyp, für den die Anzahl abgerufen wird',
      '!=': 'Nicht gleichzusetzen mit',
      '==': 'Gleich',
      '>': 'Größer als',
      '>=': 'Größer als oder gleich wie',
      '<': 'Weniger als',
      '<=': 'Gleich oder kleiner als',
      path: 'Pfad',
      pathHelperText: 'Der Pfad innerhalb der Fall, deren Werte gruppiert werden sollen',
      operator: 'Operator',
      value: 'Wert',
      conditions: 'Bedingungen',
      conditionsHelperText:
        "Geben Sie optionale Bedingungen zum Abrufen der Gruppierung für den ausgewählten Falltyp an. Zum Beispiel: 'case:createdBy', 'Nicht gleichzusetzen mit', 'test@test.com'.",
      addCondition: 'Bedingung hinzufügen',
      enum: 'Anzeige der Werte',
      enumHelperText:
        "Einige Werte aus der Datenbank sind für den Endbenutzer nicht lesbar. Geben Sie hier an, wie die Werte angezeigt werden sollen. Beispiel: Wert: 'anfrage-gesendet', Anzeige: 'Anfrage gesendet'.",
      displayValue: 'Anzeige',
      addDisplay: 'Ansicht hinzufügen',
    },
    en: {
      title: 'Group by',
      documentDefinition: 'Case type (required)',
      documentDefinitionHelperText: 'The case type for which the count is retrieved',
      '!=': 'Not equal to',
      '==': 'Equal to',
      '>': 'Greater than',
      '>=': 'Greater than or equal to',
      '<': 'Less than',
      '<=': 'Less than or equal to',
      path: 'Path (required)',
      pathHelperText: 'The path within the case of which the values should be grouped',
      operator: 'Operator',
      value: 'Value',
      conditions: 'Conditions',
      conditionsHelperText:
        "Specify optional conditions for retrieving the grouping for the selected case type. For example: 'case:createdBy', 'Not equal to', 'test@test.com'. To compare with empty values, '${null}' can be entered as a value. To compare with the current date, '${localDateTimeNow}' can be entered as a value. This also supports, for example, the following logic: '${localDateTimeNow.minusWeeks(2)}'.",
      addCondition: 'Add condition',
      enum: 'Display of values',
      enumHelperText:
        "Some values from the database will not be readable by the end user. Specify here how the values should be displayed. For example: Value: 'request-sent', Display: 'Request sent'.",
      displayValue: 'Display',
      addDisplay: 'Add display',
    },
    nl: {
      title: 'Groepering',
      documentDefinition: 'Dossiertype (vereist)',
      documentDefinitionHelperText: 'Het dossiertype waarvoor de telling wordt opgehaald',
      '!=': 'Niet gelijk aan',
      '==': 'Gelijk aan',
      '>': 'Groter dan',
      '>=': 'Groter dan of gelijk aan',
      '<': 'Minder dan',
      '<=': 'Minder dan of gelijk aan',
      path: 'Pad',
      pathHelperText: 'Het pad binnen het dossier waarvan de waardes gegroepeerd moeten worden',
      operator: 'Operator',
      value: 'Waarde',
      conditions: 'Condities',
      conditionsHelperText:
        "Geef optionele condities op voor het ophalen van de groepering voor het geselecteerde dossiertype. Bijvoorbeeld: 'case:createdBy', 'Niet gelijk aan', 'test@test.com'. Voor het vergelijken met lege waardes kan '${null}' ingevuld worden als waarde. Voor het vergelijken met de huidige datum kan '${localDateTimeNow}' ingevuld worden als waarde. Deze ondersteunt ook bijvoorbeeld de volgende logica: '${localDateTimeNow.minusWeeks(2)}'.",
      addCondition: 'Conditie toevoegen',
      enum: 'Weergave van waardes',
      enumHelperText:
        "Sommige waardes uit de database zullen niet leesbaar zijn voor de eindgebruiker. Geef hier op hoe de waardes weergegeven moeten worden. Bijvoorbeeld: Waarde: 'aanvraag-verzonden', Weergave: 'Aanvraag verzonden'.",
      displayValue: 'Weergave',
      addDisplay: 'Weergave toevoegen',
    },
  },
};
