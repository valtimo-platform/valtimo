import {NgModule} from '@angular/core';
import {CaseCountDataSourceModule} from './case-count';
import {CaseCountsDataSourceModule} from './case-counts';
import {CaseGroupByDataSourceModule} from './case-group-by';
import {TaskCountDataSourceModule} from './task-count';

@NgModule({
  imports: [
    CaseCountDataSourceModule,
    CaseCountsDataSourceModule,
    CaseGroupByDataSourceModule,
    TaskCountDataSourceModule,
  ],
})
export class DataSourcesModule {}
