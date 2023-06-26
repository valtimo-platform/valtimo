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
