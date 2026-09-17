/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {Add16} from '@carbon/icons';
import {CarbonListModule, ColumnConfig, ViewType} from '@valtimo/components';
import {TranslateModule} from '@ngx-translate/core';
import {IconModule, IconService, ButtonModule} from 'carbon-components-angular';
import {BehaviorSubject, map} from 'rxjs';
import {CaseDefinitionGroupManagementService} from '../../services';
import {CaseDefinitionGroupResponse} from '../../models';
import {CaseDefinitionGroupCreateModalComponent} from '../case-definition-group-create-modal/case-definition-group-create-modal.component';
import {CommonModule} from '@angular/common';

interface GroupListItem {
  key: string;
  title: string;
  memberCount: number;
}

@Component({
  standalone: true,
  selector: 'valtimo-case-definition-group-list',
  templateUrl: './case-definition-group-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    CarbonListModule,
    TranslateModule,
    IconModule,
    ButtonModule,
    CaseDefinitionGroupCreateModalComponent,
  ],
})
export class CaseDefinitionGroupListComponent implements OnInit {
  public readonly fields: ColumnConfig[] = [
    {key: 'title', label: 'caseManagement.listColumns.name'},
    {key: 'key', label: 'caseManagement.listColumns.key'},
    {key: 'memberCount', label: 'caseManagement.groups.listColumns.memberCount'},
  ];

  private readonly _refresh$ = new BehaviorSubject<void>(undefined);
  public readonly groups$ = new BehaviorSubject<GroupListItem[]>([]);
  public readonly showCreateModal$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly groupService: CaseDefinitionGroupManagementService,
    private readonly router: Router,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Add16]);
  }

  public ngOnInit(): void {
    this._loadGroups();
  }

  public onRowClick(item: GroupListItem): void {
    this.router.navigate(['/case-management/group', item.key]);
  }

  public showCreateModal(): void {
    this.showCreateModal$.next(true);
  }

  public onCloseCreateModal(created: boolean): void {
    this.showCreateModal$.next(false);
    if (created) this._loadGroups();
  }

  private _loadGroups(): void {
    this.groupService
      .getGroups()
      .pipe(
        map((groups: CaseDefinitionGroupResponse[]) =>
          groups.map(g => ({
            key: g.key,
            title: g.title,
            memberCount: g.memberCount,
          }))
        )
      )
      .subscribe(groups => this.groups$.next(groups));
  }
}
