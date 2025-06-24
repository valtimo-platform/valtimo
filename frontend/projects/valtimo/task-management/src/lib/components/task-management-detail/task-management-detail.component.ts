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
import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, ViewEncapsulation} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {CarbonListModule} from '@valtimo/components';
import {TabsModule} from 'carbon-components-angular';
import {TaskManagementTab} from '../../models';
import {TaskManagementService} from '../../services';
import {TaskManagementColumnsComponent} from '../task-management-columns/task-management-columns.component';
import {TaskManagementSearchFieldsComponent} from '../task-management-search-fields/task-management-search-fields.component';

@Component({
  templateUrl: './task-management-detail.component.html',
  styleUrl: './task-management-detail.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    CarbonListModule,
    TranslateModule,
    TabsModule,
    TaskManagementColumnsComponent,
    TaskManagementSearchFieldsComponent,
  ],
  providers: [TaskManagementService],
})
export class TaskManagementDetailComponent {
  public readonly activeTab$ = this.taskManagementService.activeTab$;

  public readonly TaskManagementTab = TaskManagementTab;

  constructor(private readonly taskManagementService: TaskManagementService) {}

  public setActiveTab(tab: TaskManagementTab): void {
    this.taskManagementService.setActiveTab(tab);
  }
}
