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
