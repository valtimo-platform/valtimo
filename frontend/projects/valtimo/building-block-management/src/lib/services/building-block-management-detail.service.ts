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

import {Injectable, OnDestroy} from '@angular/core';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  Subscription,
  switchMap,
  tap,
} from 'rxjs';
import {ActivatedRoute, Router} from '@angular/router';
import {BuildingBlockManagementApiService} from './building-block-management-api.service';
import {BuildingBlockDefinitionDto} from '@valtimo/shared';
import {PageTitleService} from '@valtimo/components';
import {BuildingBlockManagementTabKey} from '../models';

@Injectable()
export class BuildingBlockManagementDetailService implements OnDestroy {
  private readonly _loadingDefinition$ = new BehaviorSubject<boolean>(true);
  public get loadingDefinition$(): Observable<boolean> {
    return this._loadingDefinition$.asObservable();
  }
  private readonly _routeSubject$ = new BehaviorSubject<ActivatedRoute | null>(null);
  private get _route$() {
    return this._routeSubject$.pipe(filter(route => route !== null));
  }
  public get buildingBlockDefinitionKey$(): Observable<string> {
    return this._route$.pipe(
      switchMap(route =>
        route.paramMap.pipe(
          map(params => params.get('buildingBlockDefinitionKey')!),
          filter(key => !!key)
        )
      )
    );
  }
  public get buildingBlockVersionTag$(): Observable<string> {
    return this._route$.pipe(
      switchMap(route =>
        route.paramMap.pipe(
          map(params => params.get('buildingBlockVersionTag')!),
          filter(version => !!version)
        )
      )
    );
  }
  public get activeTabKey$(): Observable<BuildingBlockManagementTabKey> {
    return this._route$.pipe(
      switchMap(route =>
        route.paramMap.pipe(
          map(params => params.get('tabKey') as BuildingBlockManagementTabKey),
          filter(key => !!key)
        )
      )
    );
  }

  private readonly _buildingBlockDefinition$ =
    new BehaviorSubject<BuildingBlockDefinitionDto | null>(null);
  public get buildingBlockDefinition$(): Observable<BuildingBlockDefinitionDto> {
    return this._buildingBlockDefinition$.pipe(filter(definition => definition !== null));
  }

  constructor(
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService,
    private readonly pageTitleService: PageTitleService,
    private readonly router: Router
  ) {
    this._subscriptions.add(
      combineLatest([this.buildingBlockDefinitionKey$, this.buildingBlockVersionTag$])
        .pipe(
          tap(() => this._loadingDefinition$.next(true)),
          switchMap(([key, version]) =>
            this.buildingBlockManagementApiService.getBuildingBlockDefinition(key, version)
          ),
          tap(res => {
            this._buildingBlockDefinition$.next(res);
            this.pageTitleService.setCustomPageTitle(res.title);
            this._loadingDefinition$.next(false);
          })
        )
        .subscribe()
    );
  }

  public setRoute(route: ActivatedRoute): void {
    this._routeSubject$.next(route);
  }

  private readonly _subscriptions = new Subscription();

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public navigateToTab(tabKey: BuildingBlockManagementTabKey): void {
    this.buildingBlockDefinition$.subscribe(definition => {
      this.router.navigate([
        '/building-block-management',
        'building-block',
        definition.key,
        'version',
        definition.versionTag,
        tabKey,
      ]);
    });
  }
}
