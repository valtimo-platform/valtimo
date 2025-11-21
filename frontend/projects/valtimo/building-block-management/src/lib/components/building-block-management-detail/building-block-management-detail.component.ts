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
import {Component, OnDestroy, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CarbonListModule, PageTitleService, RenderInPageHeaderDirective} from '@valtimo/components';
import {ButtonModule, IconModule, TabsModule} from 'carbon-components-angular';
import {ActivatedRoute} from '@angular/router';
import {BuildingBlockManagementDetailService} from '../../services';
import {TranslatePipe} from '@ngx-translate/core';
import {BUILDING_BLOCK_MANAGEMENT_TABS} from '../../constants';
import {BuildingBlockManagementGeneralComponent} from '../building-block-management-general/building-block-management-general.component';
import {BuildingBlockManagementDocumentComponent} from '../building-block-management-document/building-block-management-document.component';
import {BuildingBlockManagementTabKey} from '../../models';
import {take} from 'rxjs';
import {BuildingBlockManagementProcessesComponent} from '../building-block-management-processes/building-block-management-processes.component';
import {BuildingBlockManagementVersionSelectorComponent} from '../building-block-management-version-selector/building-block-management-version-selector.component';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-detail',
  templateUrl: './building-block-management-detail.component.html',
  styleUrls: ['./building-block-management-detail.component.scss'],
  imports: [
    CommonModule,
    CarbonListModule,
    ButtonModule,
    IconModule,
    TabsModule,
    TranslatePipe,
    BuildingBlockManagementGeneralComponent,
    BuildingBlockManagementDocumentComponent,
    BuildingBlockManagementProcessesComponent,
    RenderInPageHeaderDirective,
    BuildingBlockManagementVersionSelectorComponent,
  ],
  providers: [BuildingBlockManagementDetailService],
})
export class BuildingBlockManagementDetailComponent implements OnInit, OnDestroy {
  public readonly BUILDING_BLOCK_MANAGEMENT_TABS = BUILDING_BLOCK_MANAGEMENT_TABS;
  public readonly activeTabKey$ = this.buildingBlockManagementDetailService.activeTabKey$;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly buildingBlockManagementDetailService: BuildingBlockManagementDetailService,
    private readonly pageTitleService: PageTitleService
  ) {
    this.buildingBlockManagementDetailService.setRoute(this.route);
  }

  public ngOnInit() {
    this.pageTitleService.disableReset();
  }

  public ngOnDestroy() {
    this.pageTitleService.enableReset();
  }

  public switchTab(tabKey: BuildingBlockManagementTabKey): void {
    this.activeTabKey$.pipe(take(1)).subscribe(activeTabKey => {
      if (activeTabKey === tabKey) return;
      this.buildingBlockManagementDetailService.navigateToTab(tabKey);
    });
  }
}
