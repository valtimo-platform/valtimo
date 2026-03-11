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
import {CarbonListModule, ColumnConfig, ViewType} from '@valtimo/components';
import {TeamsApiService, TeamsService} from '../../services';
import {switchMap, tap} from 'rxjs';
import {TranslatePipe} from '@ngx-translate/core';
import {TeamListResponseDto} from '@valtimo/shared';
import {Router} from '@angular/router';
import {ButtonModule, IconModule} from 'carbon-components-angular';
import {TeamsCreateModalComponent} from '../teams-create-modal/teams-create-modal.component';

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
    TeamsCreateModalComponent,
  ],
  providers: [TeamsService],
})
export class TeamsListComponent {
  public readonly $loading = signal<boolean>(true);

  public readonly teams$ = this.teamsService.reload$.pipe(
    tap(() => this.$loading.set(true)),
    switchMap(() => this.teamsApiService.getTeams()),
    tap(() => this.$loading.set(false))
  );

  public readonly FIELDS: ColumnConfig[] = [
    {key: 'title', label: 'teams.listColumns.name'},
    {key: 'userCount', label: 'teams.listColumns.members', viewType: ViewType.NUMBER},
  ];

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
}
