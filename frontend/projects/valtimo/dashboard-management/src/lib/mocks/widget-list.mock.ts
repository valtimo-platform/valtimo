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

import {DashboardWidget} from '../models';

const widgetListMock: Array<DashboardWidget> = [
  {
    title: 'test',
    key: 'test',
    displayType: 'test',
    dataSourceKey: 'test',
    dataSourceProperties: {
      test: 'test',
    },
    order: 0,
  },
  {
    title: 'test2',
    key: 'test2',
    displayType: 'test2',
    dataSourceKey: 'test2',
    dataSourceProperties: {
      test: 'test2',
    },
    order: 1,
  },
];

const widgetDataSourcesMock = ['test 1', 'test 2'];

const widgetChartTypesMock = ['test 1', 'test 2'];

export {widgetListMock, widgetDataSourcesMock, widgetChartTypesMock};
