import {NgModule} from '@angular/core';
import {CaseCountDataSourceModule} from './case-count';
import {CaseCountsDataSourceModule} from './case-counts';
import {CaseGroupByDataSourceModule} from './case-group-by';

@NgModule({
  imports: [CaseCountDataSourceModule, CaseCountsDataSourceModule, CaseGroupByDataSourceModule],
})
export class DataSourcesModule {}
