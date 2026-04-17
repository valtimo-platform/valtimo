/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

export const CASE_IDENTIFIER = 'bezwaar';

export const HEADER_WIDGET_FIXTURE = {
  type: 'fields',
  highContrast: false,
  properties: {
    columns: [
      [
        {
          key: 'e2e-field',
          title: 'E2e Field',
          value: 'doc:voornaam',
          displayProperties: {type: 'text'},
        },
      ],
    ],
  },
};
