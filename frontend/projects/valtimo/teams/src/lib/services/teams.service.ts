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

import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {TeamListResponseDto} from '@valtimo/shared';
import {runAfterCarbonModalClosed} from '@valtimo/components';

@Injectable()
export class TeamsService {
  private readonly _reload$ = new BehaviorSubject<null>(null);
  public readonly reload$ = this._reload$.asObservable();

  private readonly _showCreateEditModal$ = new BehaviorSubject<boolean>(false);
  public readonly showCreateEditModal$ = this._showCreateEditModal$.asObservable();

  private readonly _editingTeam$ = new BehaviorSubject<TeamListResponseDto | null>(null);
  public readonly editingTeam$ = this._editingTeam$.asObservable();

  private readonly _showDeleteModal$ = new BehaviorSubject<boolean>(false);
  public readonly showDeleteModal$ = this._showDeleteModal$.asObservable();

  private readonly _teamToDelete$ = new BehaviorSubject<TeamListResponseDto | null>(null);
  public readonly teamToDelete$ = this._teamToDelete$.asObservable();

  private readonly _loadedTeams$ = new BehaviorSubject<TeamListResponseDto[]>([]);
  public readonly loadedTeams$ = this._loadedTeams$.asObservable();

  public setLoadedTeams(teams: TeamListResponseDto[]): void {
    this._loadedTeams$.next(teams);
  }

  public reload(): void {
    this._reload$.next(null);
  }

  public showCreateModal(): void {
    this._editingTeam$.next(null);
    this._showCreateEditModal$.next(true);
  }

  public showEditModal(team: TeamListResponseDto): void {
    this._editingTeam$.next(team);
    this._showCreateEditModal$.next(true);
  }

  public hideCreateEditModal(): void {
    this._showCreateEditModal$.next(false);
    runAfterCarbonModalClosed(() => this._editingTeam$.next(null));
  }

  public showDeleteConfirmation(team: TeamListResponseDto): void {
    this._teamToDelete$.next(team);
    this._showDeleteModal$.next(true);
  }

  public hideDeleteModal(): void {
    this._showDeleteModal$.next(false);
    this._teamToDelete$.next(null);
  }
}
