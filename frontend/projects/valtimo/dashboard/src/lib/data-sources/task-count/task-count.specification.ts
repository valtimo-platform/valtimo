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
import {CONDITIONS_HELPER_TEXTS} from '../shared';
import {TaskCountConfigurationComponent} from './components';

export const taskCountSpecification: DataSourceSpecification = {
  dataSourceKey: 'task-count',
  configurationComponent: TaskCountConfigurationComponent,
  translations: {
    de: {
      title: 'Aufgabenanzahl',
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
      conditionsHelperText: `Geben Sie optionale Bedingungen zum Abrufen der Anzahl der Aufgaben. ${CONDITIONS_HELPER_TEXTS.DE('task:assignee')}`,
      addCondition: 'Bedingung hinzufügen',
    },
    en: {
      title: 'Task count',
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
      conditionsHelperText: `Specify optional conditions for retrieving the number of tasks. ${CONDITIONS_HELPER_TEXTS.EN('task:assignee')}`,
      addCondition: 'Add condition',
    },
    nl: {
      title: 'Aantal taken',
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
      conditionsHelperText: `Geef optionele condities op voor het ophalen van het aantal taken. ${CONDITIONS_HELPER_TEXTS.NL('task:assignee')}}`,
      addCondition: 'Conditie toevoegen',
    },
  },
};
