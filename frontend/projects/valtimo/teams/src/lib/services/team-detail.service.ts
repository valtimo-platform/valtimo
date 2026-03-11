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

import {Injectable, OnDestroy} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  Observable,
  Subscription,
  switchMap,
  tap,
  map,
} from 'rxjs';
import {TeamResponseDto, TeamUserResponseDto} from '@valtimo/shared';
import {TeamsApiService} from './teams-api.service';
import {DEFAULT_PAGINATION, PageTitleService, Pagination} from '@valtimo/components';

@Injectable()
export class TeamDetailService implements OnDestroy {
  private readonly _loadingTeam$ = new BehaviorSubject<boolean>(true);
  public get loadingTeam$(): Observable<boolean> {
    return this._loadingTeam$.asObservable();
  }

  private readonly _routeSubject$ = new BehaviorSubject<ActivatedRoute | null>(null);
  private get _route$() {
    return this._routeSubject$.pipe(filter(route => route !== null));
  }

  public get teamKey$(): Observable<string> {
    return this._route$.pipe(
      switchMap(route =>
        route.paramMap.pipe(
          map(params => params.get('teamKey')!),
          filter(key => !!key),
          tap(key => (this._teamKey = key))
        )
      )
    );
  }

  private _teamKey!: string;
  public get teamKey(): string {
    return this._teamKey;
  }

  private readonly _team$ = new BehaviorSubject<TeamResponseDto | null>(null);
  public get team$(): Observable<TeamResponseDto> {
    return this._team$.pipe(filter(team => team !== null));
  }

  private readonly _reload$ = new BehaviorSubject<null>(null);

  private readonly _loadingMembers$ = new BehaviorSubject<boolean>(true);
  public get loadingMembers$(): Observable<boolean> {
    return this._loadingMembers$.asObservable();
  }

  private readonly _members$ = new BehaviorSubject<TeamUserResponseDto[]>([]);
  public get members$(): Observable<TeamUserResponseDto[]> {
    return this._members$.asObservable();
  }

  public readonly membersPagination$ = new BehaviorSubject<Pagination>({...DEFAULT_PAGINATION});

  private readonly _membersPaginationParams$ = this.membersPagination$.pipe(
    map(p => ({page: p.page, size: p.size})),
    distinctUntilChanged((a, b) => a.page === b.page && a.size === b.size)
  );

  private readonly _reloadMembers$ = new BehaviorSubject<null>(null);

  private readonly _showEditTeamModal$ = new BehaviorSubject<boolean>(false);
  public readonly showEditTeamModal$ = this._showEditTeamModal$.asObservable();

  private readonly _showDeleteTeamModal$ = new BehaviorSubject<boolean>(false);
  public readonly showDeleteTeamModal$ = this._showDeleteTeamModal$.asObservable();

  private readonly _showRemoveMemberModal$ = new BehaviorSubject<boolean>(false);
  public readonly showRemoveMemberModal$ = this._showRemoveMemberModal$.asObservable();

  private readonly _memberToRemove$ = new BehaviorSubject<TeamUserResponseDto | null>(null);
  public readonly memberToRemove$ = this._memberToRemove$.asObservable();

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly teamsApiService: TeamsApiService,
    private readonly pageTitleService: PageTitleService,
    private readonly router: Router
  ) {}

  public setRoute(route: ActivatedRoute): void {
    this._routeSubject$.next(route);

    this._subscriptions.add(
      this.teamKey$
        .pipe(
          switchMap(key =>
            this._reload$.pipe(
              tap(() => this._loadingTeam$.next(true)),
              switchMap(() => this.teamsApiService.getTeam(key))
            )
          ),
          tap(team => {
            this._team$.next(team);
            this.pageTitleService.setCustomPageTitle(team.title);
            this._loadingTeam$.next(false);
          })
        )
        .subscribe()
    );

    this._subscriptions.add(
      this.teamKey$
        .pipe(
          switchMap(key =>
            combineLatest([this._reloadMembers$, this._membersPaginationParams$]).pipe(
              tap(() => this._loadingMembers$.next(true)),
              switchMap(([_, params]) =>
                this.teamsApiService.getTeamUsers(key, {
                  page: params.page - 1,
                  size: params.size,
                })
              )
            )
          ),
          tap(page => {
            this.membersPagination$.next({
              ...this.membersPagination$.getValue(),
              collectionSize: page.totalElements,
            });
            this._members$.next(page.content);
            this._loadingMembers$.next(false);
          })
        )
        .subscribe()
    );
  }

  public reload(): void {
    this._reload$.next(null);
  }

  public reloadMembers(): void {
    this._reloadMembers$.next(null);
  }

  public showEditTeamModal(): void {
    this._showEditTeamModal$.next(true);
  }

  public hideEditTeamModal(): void {
    this._showEditTeamModal$.next(false);
  }

  public showDeleteTeamModal(): void {
    this._showDeleteTeamModal$.next(true);
  }

  public hideDeleteTeamModal(): void {
    this._showDeleteTeamModal$.next(false);
  }

  public showRemoveMemberConfirmation(member: TeamUserResponseDto): void {
    this._memberToRemove$.next(member);
    this._showRemoveMemberModal$.next(true);
  }

  public hideRemoveMemberModal(): void {
    this._showRemoveMemberModal$.next(false);
    this._memberToRemove$.next(null);
  }

  public navigateToTeamsList(): void {
    this.router.navigate(['/teams']);
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }
}
