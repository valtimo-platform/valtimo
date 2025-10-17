import {NgModule} from '@angular/core';
import {
  BuildingBlockManagementListComponent,
} from './components/building-bock-management-list/building-block-management-list.component';
import {BuildingBlockManagementRouting} from './building-block-management-routing';

@NgModule({
  declarations: [],
  imports: [
    BuildingBlockManagementRouting,
    BuildingBlockManagementListComponent
  ],
  providers: [],
})
export class BuildingBlockManagementModule {}
