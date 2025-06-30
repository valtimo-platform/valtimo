import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {IKO_TOKEN} from '@valtimo/shared';
import {IkoRoutingModule} from './iko-routing.module';
import {IkoSearchComponent} from './components/iko-search/iko-search.component';
import {IkoMenuService} from './services/iko-menu.service';
import {MenuService} from '@valtimo/components';

@NgModule({
  imports: [CommonModule, IkoRoutingModule, IkoSearchComponent],
  providers: [
    IkoMenuService,
    {
      provide: IKO_TOKEN,
      useValue: true,
    },
  ],
})
export class IkoModule {
  constructor(
    private readonly ikoMenuService: IkoMenuService,
    private readonly menuService: MenuService
  ) {
    this.menuService.registerAppendMenuItemsFunction(this.ikoMenuService.appendIkoMenuItems);
  }
}
