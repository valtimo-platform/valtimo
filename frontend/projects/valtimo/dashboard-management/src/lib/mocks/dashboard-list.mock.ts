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

import {ROLE_ADMIN, ROLE_DEVELOPER, ROLE_USER} from '@valtimo/config';
import {DashboardItem} from '../models';

export const dashboardListMock: Array<DashboardItem> = [
  {
    key: 'test-id1',
    name: 'Test dashboard 1',
    description: 'Descriptio 1',
    roles: [ROLE_USER],
    createdBy: 'Asha Miller',
    createdOn: 'Created on 19/06/2023 10:41AM',
  },
  {
    key: 'test-id2',
    name: 'Test dashboard 2',
    description: 'Descriptio 1',
    roles: [ROLE_USER, ROLE_ADMIN],
    createdBy: 'Asha Miller',
    createdOn: 'Created on 19/06/2023 10:41AM',
  },
  {
    key: 'test-id3',
    name: 'Test dashboard 3',
    description: 'Descriptio 1',
    roles: [ROLE_ADMIN],
    createdBy: 'Asha Miller',
    createdOn: 'Created on 19/06/2023 10:41AM',
  },
  {
    key: 'test-id4',
    name: 'Test dashboard 4',
    description: 'Descriptio 1',
    roles: [ROLE_DEVELOPER],
    createdBy: 'Asha Miller',
    createdOn: 'Created on 19/06/2023 10:41AM',
  },
  {
    key: 'test-id5',
    name: 'Test dashboard 5',
    description: 'Descriptio 1',
    roles: [ROLE_ADMIN, ROLE_DEVELOPER],
    createdBy: 'Asha Miller',
    createdOn: '19/06/2023 10:41AM',
  },
];
