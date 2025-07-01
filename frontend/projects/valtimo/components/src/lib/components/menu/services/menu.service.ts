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

import {HttpClient} from '@angular/common/http';
import {Injectable, OnDestroy} from '@angular/core';
import {NavigationEnd, NavigationStart, ResolveEnd, Router} from '@angular/router';
import {ConfigService, MenuConfig, MenuIncludeService, MenuItem} from '@valtimo/shared';
import {UserProviderService} from '@valtimo/security';
import {NGXLogger} from 'ngx-logger';
import {
  BehaviorSubject,
  combineLatest,
  Observable,
  of,
  OperatorFunction,
  Subscription,
  switchMap,
} from 'rxjs';
import {distinctUntilChanged, filter, map, tap} from 'rxjs/operators';
import {PendingChangesService} from '../../pending-changes/pending-changes.service';
import {AppendMenuItemsFunction} from '../../../models';
import {isEqual} from 'lodash';
import {KeycloakService} from 'keycloak-angular';

@Injectable({providedIn: 'root'})
export class MenuService implements OnDestroy {
  private readonly _activeParentSequenceNumber$ = new BehaviorSubject<string>('');
  private readonly _menuItems$ = new BehaviorSubject<MenuItem[]>([]);

  private readonly reloadActiveSequence$ = new BehaviorSubject<null>(null);
  private readonly reload$ = new BehaviorSubject<null>(null);

  public includeFunctionObservables: {[key: string]: Observable<boolean>} = {};

  private readonly menuConfig: MenuConfig;

  private readonly currentRoute$ = this.router.events.pipe(
    filter(
      event =>
        event instanceof NavigationEnd ||
        event instanceof NavigationStart ||
        event instanceof ResolveEnd
    ),
    map(event => (event as NavigationEnd)?.url),
    filter(url => !!url)
  );

  public get menuItems$(): Observable<MenuItem[]> {
    return this._menuItems$.pipe(distinctUntilChanged((prev, curr) => isEqual(prev, curr)));
  }

  public get menuItemsLoaded$(): Observable<boolean> {
    return this._menuItems$.pipe(map(items => Array.isArray(items) && items.length > 0));
  }

  public get activeParentSequenceNumber$(): Observable<string> {
    return this._activeParentSequenceNumber$.asObservable();
  }

  public get closestSequence$(): Observable<string> {
    return combineLatest([this.currentRoute$, this.menuItems$]).pipe(
      filter(() => !this.pendingChangesService.pendingChanges),
      map(([currentRoute, menuItems]) => {
        let closestSequence = '0';
        let highestDiff = 0;

        const normalize = (value: string): string =>
          ('/' + decodeURIComponent(value).toLowerCase().replace(/^\/+/, '')).replace(/\/+$/, '');

        const normalizedCurrent = normalize(currentRoute);

        const checkItemMatch = (rawUrl: string, seq: string, parentSeq?: string): void => {
          const normalizedUrl = normalize(rawUrl);
          const diff =
            normalizedCurrent.length - normalizedCurrent.replace(normalizedUrl, '').length;

          if (diff > highestDiff) {
            highestDiff = diff;
            closestSequence = seq;
            this._activeParentSequenceNumber$.next(parentSeq || '');
          }
        };

        menuItems.forEach(item => {
          const topLink = Array.isArray(item.link) ? item.link.join('/') : '';
          checkItemMatch(topLink, `${item.sequence}`);

          item.children?.forEach(child => {
            if (Array.isArray(child.link)) {
              const fullLink = [...(item.link || []), ...child.link].join('/');
              checkItemMatch(fullLink, `${item.sequence}${child.sequence}`, `${item.sequence}`);
            }
          });
        });

        return closestSequence;
      }),
      distinctUntilChanged()
    );
  }

  private readonly _subscriptions = new Subscription();

  private readonly _appendMenuItemFunctions$ = new BehaviorSubject<AppendMenuItemsFunction[]>([]);

  constructor(
    private readonly configService: ConfigService,
    private readonly http: HttpClient,
    private readonly logger: NGXLogger,
    private readonly menuIncludeService: MenuIncludeService,
    private readonly pendingChangesService: PendingChangesService,
    private readonly router: Router,
    private readonly userProviderService: UserProviderService,
    private readonly keycloakService: KeycloakService
  ) {
    const config = configService.config;
    this.menuConfig = config?.menu;
  }

  public init(): void {
    this.initReload();
    this.logger.debug('Menu initialized');
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public reload(): void {
    this.reloadActiveSequence$.next(null);
    this.reload$.next(null);
  }

  private loadMenuItems(userRoles: string[]): MenuItem[] {
    let menuItems: MenuItem[] = [];

    this.menuConfig.menuItems.forEach(menuItem => {
      if (menuItem.includeFunction) {
        this.includeFunctionObservables[menuItem.title] =
          this.menuIncludeService.getIncludeFunction(menuItem.includeFunction);
      }

      menuItem.show = true;

      if (!menuItem.roles || menuItem.roles.some(role => userRoles.includes(role))) {
        const filteredChildren = menuItem.children?.filter(
          child => !child.roles || child.roles.some(role => userRoles.includes(role))
        );
        menuItems.push({...menuItem, ...(filteredChildren && {children: filteredChildren})});
      }
    });

    return menuItems.sort((a, b) => a.sequence - b.sequence);
  }

  private applyMenuRoleSecurity(menuItems: MenuItem[]): MenuItem[] {
    this.userProviderService.getUserSubject().subscribe(user => {
      const roles = user?.roles || [];
      menuItems.forEach(item => {
        item.show = !item.roles || item.roles.some(role => roles.includes(role));
      });
    });
    return menuItems;
  }

  public initReload(): void {
    const roles = this.keycloakService.getUserRoles(true);
    const existingMenuItemsValue = this._menuItems$.getValue();
    const existingMenuItems =
      Array.isArray(existingMenuItemsValue) && existingMenuItemsValue.length > 0;
    const menuItems = existingMenuItems || this.loadMenuItems(roles);

    this._subscriptions.add(
      this.reload$
        .pipe(
          switchMap(() => of(menuItems as MenuItem[])),
          switchMap(items => combineLatest([of(items), this._appendMenuItemFunctions$])),
          switchMap(([items, appendMenuItemsFunctions]) => {
            const sourceObs = of(items);

            if (!Array.isArray(appendMenuItemsFunctions) || appendMenuItemsFunctions.length === 0) {
              return sourceObs;
            }

            const operators = appendMenuItemsFunctions.map(fn => switchMap(fn)) as [
              OperatorFunction<MenuItem[], MenuItem[]>,
              ...OperatorFunction<MenuItem[], MenuItem[]>[],
            ];

            // @ts-ignore
            return sourceObs.pipe(...operators);
          }),
          map(items => this.applyMenuRoleSecurity(items)),
          tap(items => {
            if (!isEqual(this._menuItems$.getValue(), items)) this._menuItems$.next(items);
          })
        )
        .subscribe()
    );
  }

  public registerAppendMenuItemsFunction(functionValue: AppendMenuItemsFunction): void {
    this._appendMenuItemFunctions$.next([
      ...this._appendMenuItemFunctions$.getValue(),
      functionValue,
    ]);
  }
}
