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

import {Component, OnDestroy, OnInit, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ActivatedRoute} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import {
  ActionItem,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  OverflowMenuComponent,
  OverflowMenuOptionComponent,
  PageTitleService,
  RenderInPageHeaderDirective,
} from '@valtimo/components';
import {PermissionService} from '@valtimo/access-control';
import {TeamUserResponseDto} from '@valtimo/shared';
import {ButtonModule, DialogModule, IconModule} from 'carbon-components-angular';
import {combineLatest, map} from 'rxjs';
import {TeamsApiService, TeamDetailService} from '../../services';
import {TeamDetailEditModalComponent} from '../team-detail-edit-modal/team-detail-edit-modal.component';
import {TeamDetailAddMemberComponent} from '../team-detail-add-member-modal/team-detail-add-member-modal.component';
import {
  CAN_ASSIGN_TEAM_PERMISSION,
  CAN_DELETE_TEAM_PERMISSION,
  CAN_MODIFY_TEAM_PERMISSION,
  CAN_VIEW_USERS_PERMISSION,
} from '../../permissions';

@Component({
  standalone: true,
  selector: 'valtimo-team-detail',
  templateUrl: './team-detail.component.html',
  styleUrls: ['./team-detail.component.scss'],
  imports: [
    CommonModule,
    CarbonListModule,
    TranslatePipe,
    ButtonModule,
    IconModule,
    DialogModule,
    RenderInPageHeaderDirective,
    OverflowMenuComponent,
    OverflowMenuOptionComponent,
    ConfirmationModalModule,
    TeamDetailEditModalComponent,
    TeamDetailAddMemberComponent,
  ],
  providers: [TeamDetailService],
})
export class TeamDetailComponent implements OnInit, OnDestroy {
  public readonly $loadingMembers = signal<boolean>(true);

  public readonly members$ = this.teamDetailService.members$;
  public readonly membersPagination$ = this.teamDetailService.membersPagination$;
  public readonly showRemoveMemberModal$ = this.teamDetailService.showRemoveMemberModal$;
  public readonly memberToRemove$ = this.teamDetailService.memberToRemove$;
  public readonly showDeleteTeamModal$ = this.teamDetailService.showDeleteTeamModal$;
  public readonly team$ = this.teamDetailService.team$;

  public readonly canModifyTeam$ = this.permissionService.requestPermission(
    CAN_MODIFY_TEAM_PERMISSION
  );

  public readonly canDeleteTeam$ = this.permissionService.requestPermission(
    CAN_DELETE_TEAM_PERMISSION
  );

  public readonly canAssignTeam$ = this.permissionService.requestPermission(
    CAN_ASSIGN_TEAM_PERMISSION
  );

  public readonly canViewUsers$ = this.permissionService.requestPermission(
    CAN_VIEW_USERS_PERMISSION
  );

  public readonly canAddMember$ = combineLatest([this.canAssignTeam$, this.canViewUsers$]).pipe(
    map(([canAssign, canViewUsers]) => canAssign && canViewUsers)
  );

  public readonly memberActionItems$ = this.canAssignTeam$.pipe(
    map((canAssign): ActionItem[] => [
      {
        label: 'teams.detail.removeMember',
        callback: this.onRemoveMember.bind(this),
        type: 'danger',
        disabledCallback: () => !canAssign,
      },
    ])
  );

  public readonly MEMBER_FIELDS: ColumnConfig[] = [
    {key: 'fullName', label: 'teams.detail.memberColumns.name'},
    {key: 'email', label: 'teams.detail.memberColumns.email'},
    {key: 'roles', label: 'teams.detail.memberColumns.role'},
  ];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly teamDetailService: TeamDetailService,
    private readonly teamsApiService: TeamsApiService,
    private readonly pageTitleService: PageTitleService,
    private readonly permissionService: PermissionService
  ) {
    this.teamDetailService.setRoute(this.route);

    this.teamDetailService.loadingMembers$.subscribe(loading => {
      this.$loadingMembers.set(loading);
    });
  }

  public ngOnInit(): void {
    this.pageTitleService.disableReset();
  }

  public ngOnDestroy(): void {
    this.pageTitleService.enableReset();
  }

  public onEditTeam(): void {
    this.teamDetailService.showEditTeamModal();
  }

  public onDeleteTeam(): void {
    this.teamDetailService.showDeleteTeamModal();
  }

  public onDeleteTeamConfirm(): void {
    this.teamsApiService.deleteTeam(this.teamDetailService.teamKey).subscribe(() => {
      this.teamDetailService.navigateToTeamsList();
    });
  }

  public onRemoveMember(member: TeamUserResponseDto): void {
    this.teamDetailService.showRemoveMemberConfirmation(member);
  }

  public onRemoveMemberConfirm(member: TeamUserResponseDto): void {
    this.teamsApiService
      .removeTeamUser(this.teamDetailService.teamKey, member.username)
      .subscribe(() => {
        this.teamDetailService.reloadMembers();
      });
  }

  public onPaginationClicked(page: number): void {
    this.teamDetailService.membersPagination$.next({
      ...this.teamDetailService.membersPagination$.getValue(),
      page,
    });
  }

  public onPaginationSet(size: number): void {
    const {collectionSize, page} = this.teamDetailService.membersPagination$.getValue();
    const resetPage =
      Math.ceil(+collectionSize / size) <= +page && +collectionSize > 0;
    this.teamDetailService.membersPagination$.next({
      ...this.teamDetailService.membersPagination$.getValue(),
      size,
      ...(resetPage && {page: 1}),
    });
  }
}
