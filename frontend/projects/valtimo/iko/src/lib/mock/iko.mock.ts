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

import {Widget} from '@valtimo/layout';

const mockWidgetResponse = [
  {
    type: 'fields',
    key: 'persoon',
    title: 'Partner',
    width: 1,
    highContrast: true,
    actions: [],
    properties: {
      columns: [
        [
          {
            key: 'naam',
            title: 'Naam',
            value: 'iko:/persoon/naam/volledigeNaam',
          },
          {
            key: 'bsn',
            title: 'BSN',
            value: 'iko:/persoon/burgerservicenummer',
          },
          {
            key: 'geboortedatum',
            title: 'Geboortedatum',
            value: 'iko:/persoon/geboorte/datum/datum',
            displayProperties: {
              type: 'date',
              format: 'DD-MM-YYYY',
              hideWhenEmpty: false,
            },
          },
        ],
      ],
    },
  },
  {
    type: 'collection',
    key: 'nationaliteiten',
    title: 'Nationaliteiten',
    width: 3,
    highContrast: false,
    actions: [],
    properties: {
      collection: 'iko:/persoon/nationaliteiten',
      defaultPageSize: 4,
      title: {
        value: 'nationaliteit',
      },
      fields: [
        {
          key: 'nationaliteit',
          title: 'Nationaliteit',
          value: '/nationaliteit/omschrijving',
          width: 'full',
        },
        {
          key: 'datumIngangGeldigheid',
          title: 'Datum Ingang Geldigheid',
          value: '/datumIngangGeldigheid/langFormaat',
          width: 'full',
        },
      ],
    },
  },
  {
    type: 'table',
    key: 'lopendeZaken',
    title: 'Lopende zaken',
    width: 4,
    highContrast: false,
    actions: [],
    properties: {
      collection: 'iko:/zaken',
      defaultPageSize: 4,
      columns: [
        {
          key: 'zaakNummer',
          title: 'Zaaknummer',
          value: '/zaakNummer',
        },
        {
          key: 'type',
          title: 'Type',
          value: '/type',
        },
        {
          key: 'status',
          title: 'Status',
          value: '/status',
        },
        {
          key: 'uiterlijkeEinddatum',
          title: 'Uiterlijke einddatum',
          value: '/uiterlijkeEinddatum',
          displayProperties: {
            type: 'date',
            format: 'DD-MM-YYYY',
            hideWhenEmpty: false,
          },
        },
      ],
      firstColumnAsTitle: false,
    },
  },
] as any as Widget[];

export {mockWidgetResponse};
