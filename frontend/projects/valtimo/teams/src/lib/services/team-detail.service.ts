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
import {ActivatedRoute} from '@angular/router';
import {BehaviorSubject, filter, Observable, Subscription, switchMap, tap, map} from 'rxjs';
import {TeamResponseDto} from '@valtimo/shared';
import {TeamsApiService} from './teams-api.service';

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

  private readonly _subscriptions = new Subscription();

  constructor(private readonly teamsApiService: TeamsApiService) {}

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
            this._loadingTeam$.next(false);
          })
        )
        .subscribe()
    );
  }

  public reload(): void {
    this._reload$.next(null);
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }
}
