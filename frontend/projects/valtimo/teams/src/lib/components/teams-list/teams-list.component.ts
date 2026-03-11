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
  ViewType,
} from '@valtimo/components';
import {TeamsApiService, TeamsService} from '../../services';
import {map, switchMap, tap} from 'rxjs';
import {TranslatePipe} from '@ngx-translate/core';
import {TeamListResponseDto} from '@valtimo/shared';
import {Router} from '@angular/router';
import {ButtonModule, IconModule} from 'carbon-components-angular';
import {TeamsCreateEditModalComponent} from '../teams-create-edit-modal/teams-create-edit-modal.component';

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

  public readonly teams$ = this.teamsService.reload$.pipe(
    tap(() => this.$loading.set(true)),
    switchMap(() => this.teamsApiService.getTeams()),
    map(teams => [...teams].sort((a, b) => a.title.localeCompare(b.title))),
    tap(() => this.$loading.set(false))
  );

  public readonly FIELDS: ColumnConfig[] = [
    {key: 'title', label: 'teams.listColumns.name'},
    {key: 'userCount', label: 'teams.listColumns.members', viewType: ViewType.NUMBER},
  ];

  public readonly ACTION_ITEMS: ActionItem[] = [
    {label: 'interface.edit', callback: this.onEditTeam.bind(this)},
    {label: 'interface.delete', callback: this.onDeleteTeam.bind(this), type: 'danger'},
  ];

  public readonly showDeleteModal$ = this.teamsService.showDeleteModal$;
  public readonly teamToDelete$ = this.teamsService.teamToDelete$;

  constructor(
    private readonly teamsApiService: TeamsApiService,
    private readonly teamsService: TeamsService,
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
}
