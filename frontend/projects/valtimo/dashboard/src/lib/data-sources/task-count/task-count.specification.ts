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
      path: 'Pfad',
      operator: 'Operator',
      value: 'Wert',
      caseDefinitionName: 'Falltyp',
      caseDefinitionNameHelperText: 'Optional. Zählt nur Aufgaben, die zu diesem Falltyp gehören.',
      allCaseDefinitions: 'Alle Falltypen',
      conditions: 'Bedingungen',
      conditionsHelperText: `Geben Sie optionale Bedingungen zum Abrufen der Anzahl der Aufgaben. ${CONDITIONS_HELPER_TEXTS.DE('task:assignee')}`,
      addCondition: 'Bedingung hinzufügen',
      orGroupTitle: 'ODER-Gruppen',
      orGroupHelperText:
        'Bedingungen innerhalb einer Gruppe werden mit ODER verknüpft, Gruppen werden mit den übrigen Bedingungen mit UND verknüpft.',
      addOrGroup: 'ODER-Gruppe hinzufügen',
      deleteOrGroup: 'ODER-Gruppe löschen',
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
      conditions: 'Conditions',
      conditionsHelperText: `Specify optional conditions for retrieving the number of tasks. ${CONDITIONS_HELPER_TEXTS.EN('task:assignee')}`,
      addCondition: 'Add condition',
      orGroupTitle: 'OR groups',
      orGroupHelperText:
        'Conditions within a group are combined with OR; groups are combined with the other conditions using AND.',
      addOrGroup: 'Add OR group',
      deleteOrGroup: 'Delete OR group',
      unsupportedConditionsNotification:
        'This widget contains conditions that can only be edited through configuration files. They are preserved when you save.',
    },
    nl: {
      title: 'Aantal taken',
      path: 'Pad',
      operator: 'Operator',
      value: 'Waarde',
      caseDefinitionName: 'Zaaktype',
      caseDefinitionNameHelperText: 'Optioneel. Telt alleen taken die bij dit zaaktype horen.',
      allCaseDefinitions: 'Alle zaaktypes',
      conditions: 'Condities',
      conditionsHelperText: `Geef optionele condities op voor het ophalen van het aantal taken. ${CONDITIONS_HELPER_TEXTS.NL('task:assignee')}}`,
      addCondition: 'Conditie toevoegen',
      orGroupTitle: 'OF-groepen',
      orGroupHelperText:
        'Condities binnen een groep worden met OF gecombineerd; groepen worden met de overige condities gecombineerd met EN.',
      addOrGroup: 'OF-groep toevoegen',
      deleteOrGroup: 'OF-groep verwijderen',
      unsupportedConditionsNotification:
        'Dit widget bevat condities die alleen via configuratiebestanden bewerkt kunnen worden. Ze blijven behouden bij het opslaan.',
    },
  },
};
