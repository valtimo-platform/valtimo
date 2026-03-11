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

import {Component, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  ActionItem,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  DEFAULT_PAGINATION,
  Pagination,
  ViewType,
} from '@valtimo/components';
import {PermissionService} from '@valtimo/access-control';
import {TeamsApiService, TeamsService} from '../../services';
import {BehaviorSubject, combineLatest, distinctUntilChanged, map, switchMap, tap} from 'rxjs';
import {TranslatePipe} from '@ngx-translate/core';
import {TeamListResponseDto} from '@valtimo/shared';
import {Router} from '@angular/router';
import {ButtonModule, IconModule} from 'carbon-components-angular';
import {TeamsCreateEditModalComponent} from '../teams-create-edit-modal/teams-create-edit-modal.component';
import {
  CAN_CREATE_TEAM_PERMISSION,
  CAN_DELETE_TEAM_PERMISSION,
  CAN_MODIFY_TEAM_PERMISSION,
} from '../../permissions';

@Component({
  standalone: true,
  selector: 'valtimo-teams-list',
  templateUrl: './teams-list.component.html',
  styleUrls: ['./teams-list.component.scss'],
  imports: [
    CommonModule,
    CarbonListModule,
    TranslatePipe,
    ButtonModule,
    IconModule,
    TeamsCreateEditModalComponent,
    ConfirmationModalModule,
  ],
  providers: [TeamsService],
})
export class TeamsListComponent {
  public readonly $loading = signal<boolean>(true);

  public readonly canCreateTeam$ = this.permissionService.requestPermission(
    CAN_CREATE_TEAM_PERMISSION
  );

  public readonly canModifyTeam$ = this.permissionService.requestPermission(
    CAN_MODIFY_TEAM_PERMISSION
  );

  public readonly canDeleteTeam$ = this.permissionService.requestPermission(
    CAN_DELETE_TEAM_PERMISSION
  );

  public readonly actionItems$ = combineLatest([
    this.canModifyTeam$,
    this.canDeleteTeam$,
  ]).pipe(
    map(([canModify, canDelete]): ActionItem[] => [
      {
        label: 'interface.edit',
        callback: this.onEditTeam.bind(this),
        disabledCallback: () => !canModify,
      },
      {
        label: 'interface.delete',
        callback: this.onDeleteTeam.bind(this),
        type: 'danger',
        disabledCallback: () => !canDelete,
      },
    ])
  );

  public readonly pagination$ = new BehaviorSubject<Pagination>({...DEFAULT_PAGINATION});

  private readonly paginationParams$ = this.pagination$.pipe(
    map(p => ({page: p.page, size: p.size})),
    distinctUntilChanged((a, b) => a.page === b.page && a.size === b.size)
  );

  public readonly teams$ = combineLatest([this.teamsService.reload$, this.paginationParams$]).pipe(
    tap(() => this.$loading.set(true)),
    switchMap(([_, params]) =>
      this.teamsApiService.getTeams({page: params.page - 1, size: params.size})
    ),
    map(page => {
      this.pagination$.next({
        ...this.pagination$.getValue(),
        collectionSize: page.totalElements,
      });
      return page.content;
    }),
    tap(() => this.$loading.set(false))
  );

  public readonly FIELDS: ColumnConfig[] = [
    {key: 'title', label: 'teams.listColumns.name'},
    {key: 'userCount', label: 'teams.listColumns.members', viewType: ViewType.NUMBER},
  ];

  public readonly showDeleteModal$ = this.teamsService.showDeleteModal$;
  public readonly teamToDelete$ = this.teamsService.teamToDelete$;

  constructor(
    private readonly teamsApiService: TeamsApiService,
    private readonly teamsService: TeamsService,
    private readonly permissionService: PermissionService,
    private readonly router: Router
  ) {}

  public onRowClick(team: TeamListResponseDto): void {
    this.router.navigate(['/teams', team.key]);
  }

  public showCreateModal(): void {
    this.teamsService.showCreateModal();
  }

  public onEditTeam(team: TeamListResponseDto): void {
    this.teamsService.showEditModal(team);
  }

  public onDeleteTeam(team: TeamListResponseDto): void {
    this.teamsService.showDeleteConfirmation(team);
  }

  public onDeleteConfirm(team: TeamListResponseDto): void {
    this.teamsApiService.deleteTeam(team.key).subscribe(() => {
      this.teamsService.reload();
    });
  }

  public onPaginationClicked(page: number): void {
    this.pagination$.next({...this.pagination$.getValue(), page});
  }

  public onPaginationSet(size: number): void {
    const {collectionSize, page} = this.pagination$.getValue();
    const resetPage =
      Math.ceil(+collectionSize / size) <= +page && +collectionSize > 0;
    this.pagination$.next({
      ...this.pagination$.getValue(),
      size,
      ...(resetPage && {page: 1}),
    });
  }
}
