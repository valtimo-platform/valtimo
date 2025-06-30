import {HttpClient} from '@angular/common/http';
import {Injectable, OnDestroy} from '@angular/core';
import {NavigationEnd, NavigationStart, ResolveEnd, Router} from '@angular/router';
import {ConfigService, MenuConfig, MenuIncludeService, MenuItem} from '@valtimo/shared';
import {UserProviderService} from '@valtimo/security';
import {SseService} from '@valtimo/sse';
import {KeycloakService} from 'keycloak-angular';
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
import {delay, distinctUntilChanged, filter, map, tap} from 'rxjs/operators';
import {CaseMenuService} from './case-menu.service';
import {ObjectMenuService} from './object-menu.service';
import {PendingChangesService} from '../../pending-changes/pending-changes.service';
import {AppendMenuItemsFunction} from '../../../models';
import {isEqual} from 'lodash';

@Injectable({providedIn: 'root'})
export class MenuService implements OnDestroy {
  private readonly _activeParentSequenceNumber$ = new BehaviorSubject<string>('');
  private readonly _menuItems$ = new BehaviorSubject<MenuItem[]>([]);

  private readonly reloadActiveSequence$ = new BehaviorSubject<null>(null);
  private readonly reload$ = new BehaviorSubject<null>(null);

  public includeFunctionObservables: {[key: string]: Observable<boolean>} = {};

  private readonly menuConfig: MenuConfig;
  private readonly disableCaseCount: boolean;
  private readonly enableObjectManagement: boolean;

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

  public get initializedMenuItems$(): Observable<MenuItem[]> {
    return this._menuItems$.pipe(filter(items => Array.isArray(items) && items.length > 0));
  }

  public get activeParentSequenceNumber$(): Observable<string> {
    return this._activeParentSequenceNumber$.asObservable();
  }

  public get closestSequence$(): Observable<string> {
    return combineLatest([
      this.currentRoute$,
      this.menuItems$,
      this.reloadActiveSequence$.pipe(delay(0)),
    ]).pipe(
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
    private readonly keycloakService: KeycloakService,
    private readonly logger: NGXLogger,
    private readonly menuIncludeService: MenuIncludeService,
    private readonly pendingChangesService: PendingChangesService,
    private readonly router: Router,
    private readonly userProviderService: UserProviderService,
    private readonly sseService: SseService,
    private readonly caseMenuService: CaseMenuService,
    private readonly objectMenuService: ObjectMenuService
  ) {
    const config = configService.config;
    this.menuConfig = config?.menu;
    this.disableCaseCount = config?.featureToggles?.disableCaseCount;
    this.enableObjectManagement = config?.featureToggles?.enableObjectManagement ?? true;
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
          switchMap(() =>
            this.caseMenuService.appendCaseSubMenuItems(
              menuItems as MenuItem[],
              this.disableCaseCount,
              this.sseService
            )
          ),
          switchMap(items =>
            this.enableObjectManagement
              ? this.objectMenuService.appendObjectsSubMenuItems(
                  items,
                  this.configService.config.valtimoApi.endpointUri,
                  this.http
                )
              : of(items)
          ),
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
          tap(items => this._menuItems$.next(items))
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
