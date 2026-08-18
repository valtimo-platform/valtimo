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
import {CONDITIONS_HELPER_TEXTS} from '../shared';
import {TaskCountConfigurationComponent} from './components';

export const taskCountSpecification: DataSourceSpecification = {
  dataSourceKey: 'task-count',
  configurationComponent: TaskCountConfigurationComponent,
  translations: {
    de: {
      title: 'Aufgabenanzahl',
      path: 'Pfad (erforderlich)',
      operator: 'Operator',
      value: 'Wert',
      caseDefinitionName: 'Falltyp',
      caseDefinitionNameHelperText: 'Optional. Zählt nur Aufgaben, die zu diesem Falltyp gehören.',
      allCaseDefinitions: 'Alle Falltypen',
      conditions: 'Bedingungen (optional)',
      conditionsHelperText: `Geben Sie optionale Bedingungen zum Abrufen der Anzahl der Aufgaben. ${CONDITIONS_HELPER_TEXTS.DE('task:assignee')} Bedingungen innerhalb einer Gruppe werden mit dem Operator der Gruppe verknüpft.`,
      addCondition: 'Bedingung hinzufügen',
      and: 'UND',
      or: 'ODER',
      add: 'Hinzufügen',
      deleteGroup: 'Gruppe löschen',
      unsupportedConditionsNotification:
        'Dieses Widget enthält Bedingungen, die nur über Konfigurationsdateien bearbeitet werden können. Sie bleiben beim Speichern erhalten.',
    },
    en: {
      title: 'Task count',
      path: 'Path (required)',
      operator: 'Operator',
      value: 'Value',
      caseDefinitionName: 'Case type',
      caseDefinitionNameHelperText: 'Optional. Only counts tasks that belong to this case type.',
      allCaseDefinitions: 'All case types',
      conditions: 'Conditions (optional)',
      conditionsHelperText: `Specify optional conditions for retrieving the number of tasks. ${CONDITIONS_HELPER_TEXTS.EN('task:assignee')} Conditions within a group are combined using the operator of that group.`,
      addCondition: 'Add condition',
      and: 'AND',
      or: 'OR',
      add: 'Add',
      deleteGroup: 'Delete group',
      unsupportedConditionsNotification:
        'This widget contains conditions that can only be edited through configuration files. They are preserved when you save.',
    },
    nl: {
      title: 'Aantal taken',
      path: 'Pad (verplicht)',
      operator: 'Operator',
      value: 'Waarde',
      caseDefinitionName: 'Zaaktype',
      caseDefinitionNameHelperText: 'Optioneel. Telt alleen taken die bij dit zaaktype horen.',
      allCaseDefinitions: 'Alle zaaktypes',
      conditions: 'Condities (optioneel)',
      conditionsHelperText: `Geef optionele condities op voor het ophalen van het aantal taken. ${CONDITIONS_HELPER_TEXTS.NL('task:assignee')} Condities binnen een groep worden gecombineerd met de operator van die groep.`,
      addCondition: 'Conditie toevoegen',
      and: 'EN',
      or: 'OF',
      add: 'Toevoegen',
      deleteGroup: 'Groep verwijderen',
      unsupportedConditionsNotification:
        'Dit widget bevat condities die alleen via configuratiebestanden bewerkt kunnen worden. Ze blijven behouden bij het opslaan.',
    },
  },
};
