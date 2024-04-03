/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
import {Injectable} from '@angular/core';
import {NavigationEnd, NavigationStart, ResolveEnd, Router} from '@angular/router';
import {ConfigService, MenuConfig, MenuIncludeService, MenuItem} from '@valtimo/config';
import {DocumentDefinitions, DocumentService} from '@valtimo/document';
import {UserProviderService} from '@valtimo/security';
import {KeycloakService} from 'keycloak-angular';
import {NGXLogger} from 'ngx-logger';
import {BehaviorSubject, combineLatest, Observable, Subject, timer} from 'rxjs';
import {filter, map, take} from 'rxjs/operators';
import {PendingChangesService} from '../pending-changes/pending-changes.service';

@Injectable({
  providedIn: 'root',
})
export class MenuService {
  private readonly _activeParentSequenceNumber$ = new BehaviorSubject<string>('');
  public includeFunctionObservables: {[key: string]: Observable<boolean>} = {};

  private _menuItems$ = new BehaviorSubject<MenuItem[]>([]);
  private menuConfig: MenuConfig;

  private readonly disableCaseCount!: boolean;
  private readonly enableObjectManagement!: boolean;

  get activeParentSequenceNumber$(): Observable<string> {
    return this._activeParentSequenceNumber$.asObservable();
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly documentService: DocumentService,
    private readonly http: HttpClient,
    private readonly keycloakService: KeycloakService,
    private readonly logger: NGXLogger,
    private readonly menuIncludeService: MenuIncludeService,
    private readonly pendingChangesService: PendingChangesService,
    private readonly router: Router,
    private readonly userProviderService: UserProviderService
  ) {
    const config = configService?.config;
    this.menuConfig = config?.menu;
    this.disableCaseCount = config?.featureToggles?.disableCaseCount;
    this.enableObjectManagement = config?.featureToggles?.enableObjectManagement ?? true;
  }

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

  private readonly dossierItemsAppended$ = new BehaviorSubject<boolean>(false);
  private readonly objectsItemsAppended$ = new BehaviorSubject<boolean>(false);

  // Find out which menu item sequence number matches the current url the closest
  public get closestSequence$(): Observable<string> {
    return combineLatest([
      this.dossierItemsAppended$,
      this.objectsItemsAppended$,
      this.currentRoute$,
      this.menuItems$,
    ]).pipe(
      filter(() => !this.pendingChangesService.pendingChanges),
      filter(
        ([dossierItemsAppended, objectsItemsAppended]) =>
          dossierItemsAppended || objectsItemsAppended
      ),
      map(([_1, _2, currentRoute, menuItems]) => {
        let closestSequence = '0';
        let highestDifference = 0;

        // recursive function to check how closely each item matches to the current url
        const checkItemMatch = (
          stringUrl: string,
          sequence: string,
          parentSequence?: string
        ): void => {
          // length of the current full url
          const currentRouteUrlLength = currentRoute.length;
          // length of the current full url with the item's url substracted
          const currentRouteSubstractLength = currentRoute.replace(stringUrl, '').length;
          // the amount of characters that could be substracted
          const difference = currentRouteUrlLength - currentRouteSubstractLength;

          // the larger the amount of characters that could be substracted, the more closely the menu item url matches the current url
          if (difference > highestDifference) {
            highestDifference = difference;
            closestSequence = sequence;

            if (parentSequence) {
              this._activeParentSequenceNumber$.next(parentSequence);
            } else {
              this._activeParentSequenceNumber$.next('');
            }
          }
        };

        // check how closely each menu item (and child menu item) matches the current url using a recursive function
        menuItems.forEach(item => {
          checkItemMatch(item.link?.join('') || '', `${item.sequence}`);

          if (item.children) {
            item.children.forEach(childItem => {
              if (Array.isArray(childItem.link)) {
                checkItemMatch(
                  Array.isArray(item.link)
                    ? [...item.link, ...childItem.link].join('')
                    : childItem.link.join(''),
                  `${item.sequence}${childItem.sequence}`,
                  `${item.sequence}`
                );
              }
            });
          }
        });

        // returns the closest sequence number (each menu item has a sequence number)

        return closestSequence;
      })
    );
  }

  public get menuItems$(): Observable<MenuItem[]> {
    return this._menuItems$.asObservable();
  }

  init(): void {
    this.reload();
    this.logger.debug('Menu initialized');
  }

  public reload(): void {
    const roles = this.keycloakService.getUserRoles(true);
    return this._menuItems$.next(this.loadMenuItems(roles));
  }

  private loadMenuItems(userRoles: Array<string>): MenuItem[] {
    let menuItems: MenuItem[] = [];
    this.menuConfig.menuItems.forEach((menuItem: MenuItem) => {
      if (menuItem.includeFunction !== undefined) {
        this.includeFunctionObservables[menuItem.title] =
          this.menuIncludeService.getIncludeFunction(menuItem.includeFunction);
      }

      menuItem.show = true;

      // check if the top level menu item specifies roles it requires. If so, check if the user roles contain at least one of these roles
      if (
        Array.isArray(menuItem?.roles)
          ? userRoles.find(userRole => menuItem.roles.includes(userRole))
          : true
      ) {
        // check if menu item has children. If so, check if children specify required roles. If so, check if the user roles contain at least one of these roles
        const filteredMenuItemChildren =
          menuItem?.children &&
          menuItem?.children.filter(childMenuItem =>
            Array.isArray(childMenuItem?.roles)
              ? userRoles.find(userRole => childMenuItem.roles.includes(userRole))
              : true
          );

        // if the menu item has children, set the menu item children to filtered menu item children
        const menuItemWithFilteredChildren: MenuItem = {
          ...menuItem,
          ...(menuItem?.children && {children: filteredMenuItemChildren}),
        };

        menuItems.push(menuItemWithFilteredChildren);
      }
    });
    menuItems = this.sortMenuItems(menuItems);
    this.appendDossierSubMenuItems(menuItems).subscribe(
      value => (menuItems = this.applyMenuRoleSecurity(value))
    );

    if (this.enableObjectManagement) {
      this.appendObjectsSubMenuItems(menuItems).subscribe(
        value => (menuItems = this.applyMenuRoleSecurity(value))
      );
    }
    return menuItems;
  }

  private sortMenuItems(menuItems: MenuItem[]): MenuItem[] {
    return menuItems.sort((a, b) => a.sequence - b.sequence);
  }

  private appendDossierSubMenuItems(menuItems: MenuItem[]): Observable<MenuItem[]> {
    return new Observable(subscriber => {
      this.logger.debug('appendDossierSubMenuItems');
      this.documentService.getAllDefinitions().subscribe(definitions => {
        combineLatest([
          ...definitions.content.map(definition =>
            this.documentService.getCaseSettings(definition?.id?.name)
          ),
        ])
          .pipe(take(1))
          .subscribe(allCaseSettings => {
            const openDocumentCountMap =
              !this.disableCaseCount && this.getOpenDocumentCountMap(definitions);

            const dossierMenuItems: MenuItem[] = definitions.content.map((definition, index) => {
              const caseSettings = allCaseSettings?.find(
                setting => setting.name === definition.id.name
              );

              return {
                link: ['/dossiers/' + definition.id.name],
                title: definition.schema.title,
                iconClass: 'icon mdi mdi-dot-circle',
                sequence: index,
                show: true,
                ...(!this.disableCaseCount &&
                  caseSettings?.canHaveAssignee && {
                    count$: openDocumentCountMap.get(definition.id.name),
                  }),
              } as MenuItem;
            });
            this.logger.debug('found dossierMenuItems', dossierMenuItems);
            const menuItemIndex = menuItems.findIndex(({title}) => title === 'Dossiers');
            if (menuItemIndex > 0) {
              const dossierMenu = menuItems[menuItemIndex];
              this.logger.debug('updating dossierMenu', dossierMenu);
              dossierMenu.children = dossierMenuItems;
              menuItems[menuItemIndex] = dossierMenu;
            }
            subscriber.next(menuItems);
            this.dossierItemsAppended$.next(true);
            this.logger.debug('appendDossierSubMenuItems finished');
          });
      });
    });
  }

  private appendObjectsSubMenuItems(menuItems: MenuItem[]): Observable<MenuItem[]> {
    return new Observable(subscriber => {
      this.logger.debug('appendObjectManagementSubMenuItems');
      this.getAllObjects().subscribe(objects => {
        const visibleObjects = objects.filter(object => object?.showInDataMenu !== false);
        if (visibleObjects?.length > 0) {
          const objectsMenuItems: MenuItem[] = visibleObjects.map(
            (object, index) =>
              ({
                link: ['/objects/' + object.id],
                title: object.title,
                iconClass: 'icon mdi mdi-dot-circle',
                sequence: index,
                show: true,
              }) as MenuItem
          );
          this.logger.debug('found objectsMenuItems', objectsMenuItems);
          const menuItemIndex = menuItems.findIndex(({title}) => title === 'Objects');
          if (menuItemIndex > 0) {
            const objectsMenu = menuItems[menuItemIndex];
            this.logger.debug('updating objectsMenu', objectsMenu);
            objectsMenu.children = objectsMenuItems;
            menuItems[menuItemIndex] = objectsMenu;
          }
          subscriber.next(menuItems);
          this.objectsItemsAppended$.next(true);
          this.logger.debug('appendObjectsSubMenuItems finished');
        }
      });
    });
  }

  private getOpenDocumentCountMap(definitions: DocumentDefinitions): Map<string, Subject<number>> {
    const countMap = new Map<string, Subject<number>>();
    definitions.content.forEach(definition =>
      countMap.set(definition.id.name, new Subject<number>())
    );

    timer(0, 5000).subscribe(() => {
      this.documentService.getOpenDocumentCount().subscribe(openDocumentCountList => {
        openDocumentCountList.forEach(openDocumentCount => {
          const mapEntry = countMap.get(openDocumentCount.documentDefinitionName);

          if (mapEntry) mapEntry.next(openDocumentCount.openDocumentCount);
        });
      });
    });
    return countMap;
  }

  private applyMenuRoleSecurity(menuItems: MenuItem[]): MenuItem[] {
    this.userProviderService.getUserSubject().subscribe(user => {
      if (user.roles != null) {
        this.logger.debug('applyMenuRoleSecurity');
        const userRoles = user.roles;
        menuItems.forEach((menuItem: MenuItem) => {
          const access = this.determineRoleAccess(menuItem, userRoles);
          this.logger.debug('Menu: check role access', menuItem.roles, access);
          if (menuItem.show !== access) {
            this.logger.debug('Menu: Change access', menuItem, access);
            menuItem.show = access;
          }
        });
      }
    });
    return menuItems;
  }

  private determineRoleAccess(menuItem: MenuItem, roles: string[]): boolean {
    return !menuItem.roles || menuItem.roles.some(role => roles.includes(role));
  }

  private getAllObjects(): Observable<any> {
    return this.http.get(
      `${this.configService.config.valtimoApi.endpointUri}v1/object/management/configuration`
    );
  }
}
