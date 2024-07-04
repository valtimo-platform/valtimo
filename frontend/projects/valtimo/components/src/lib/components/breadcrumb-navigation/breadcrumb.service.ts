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

import {Injectable} from '@angular/core';
import {BehaviorSubject, combineLatest, Observable, startWith} from 'rxjs';
import {BreadcrumbItem} from 'carbon-components-angular';
import {map} from 'rxjs/operators';
import {ActivatedRoute, Params, Router, UrlSerializer} from '@angular/router';
import {ConfigService} from '@valtimo/config';
import {MenuService} from '../menu/menu.service';
import {TranslateService} from '@ngx-translate/core';

@Injectable({
  providedIn: 'root',
})
export class BreadcrumbService {
  private _cachedQueryParams: {[routeMatchString: string]: Params} = {};
  private readonly _manualSecondBreadcrumb$ = new BehaviorSubject<BreadcrumbItem | null>(null);
  private readonly _breadcrumbItems$: Observable<Array<BreadcrumbItem>> = combineLatest([
    this.menuService.activeParentSequenceNumber$,
    this.menuService.menuItems$,
    this._manualSecondBreadcrumb$,
    this.translateService.stream('key'),
    this.router.events.pipe(startWith(this.router)),
  ]).pipe(
    map(([activeParentSequenceNumber, menuItems, manualSecondBreadcrumb]) => {
      const activeParentBreadcrumbTitle = menuItems.find(
        menuItem => `${menuItem.sequence}` === activeParentSequenceNumber
      )?.title;
      const activeParentBreadcrumbTitleTranslation =
        activeParentBreadcrumbTitle && this.translateService.instant(activeParentBreadcrumbTitle);
      const activeParentBreadcrumbItem = {
        content: activeParentBreadcrumbTitleTranslation,
      };
      const secondBreadCrumb = this.getSecondBreadcrumb();

      return [
        ...(activeParentSequenceNumber ? [activeParentBreadcrumbItem] : []),
        ...(manualSecondBreadcrumb ? [manualSecondBreadcrumb] : []),
        ...(secondBreadCrumb && !manualSecondBreadcrumb ? [secondBreadCrumb] : []),
      ];
    }),
    map(breadCrumbItems => this.matchCachedQueryParams(breadCrumbItems))
  );

  get breadcrumbItems$(): Observable<Array<BreadcrumbItem>> {
    return this._breadcrumbItems$;
  }

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly configService: ConfigService,
    private readonly menuService: MenuService,
    private readonly translateService: TranslateService,
    private readonly serializer: UrlSerializer
  ) {}

  setSecondBreadcrumb(breadcrumb: BreadcrumbItem): void {
    this._manualSecondBreadcrumb$.next(breadcrumb);
  }

  clearSecondBreadcrumb(): void {
    this._manualSecondBreadcrumb$.next(null);
  }

  cacheQueryParams(routeMatchString: string, params: Params): void {
    if (routeMatchString && typeof params === 'object' && Object.keys(params).length > 0) {
      this._cachedQueryParams = {...this._cachedQueryParams, [routeMatchString]: params};
    }
  }

  private getSecondBreadcrumb(): BreadcrumbItem | false {
    const url = this.router.url;
    const urlWithoutParams = url.includes('?') ? url.split('?')[0] : url;
    const splitUrl = urlWithoutParams.split('/');
    const filteredSplitUrl = splitUrl.filter(urlPart => !!urlPart);

    if (filteredSplitUrl.length > 1) {
      const route = filteredSplitUrl[0];
      const routeString = `/${route}`;
      const content = this.router.config.find(routeConfig => routeConfig.path === route)?.data
        ?.title;

      if (route && content) {
        return {
          route: [routeString],
          content: this.translateService.instant(content),
          href: `${routeString}`,
        };
      }
    }

    return false;
  }

  private matchCachedQueryParams(breadcrumbItems: Array<BreadcrumbItem>): Array<BreadcrumbItem> {
    let hasCachedParams = false;

    const mappedItems = breadcrumbItems.map(breadCrumbItem => {
      const cachedParamKey = Object.keys(this._cachedQueryParams).find(cachedQueryParamKey =>
        this.routeStringToPlain(breadCrumbItem.href).includes(
          this.routeStringToPlain(cachedQueryParamKey)
        )
      );
      const cachedParams = cachedParamKey && this._cachedQueryParams[cachedParamKey];

      if (cachedParams) {
        const tree = this.router.createUrlTree(breadCrumbItem.route, {queryParams: cachedParams});
        const serializedUrl = this.serializer.serialize(tree);
        hasCachedParams = true;
        return {...breadCrumbItem, routeExtras: {queryParams: cachedParams}, href: serializedUrl};
      }

      return breadCrumbItem;
    });

    if (hasCachedParams) {
      this._cachedQueryParams = {};
    }

    return mappedItems;
  }

  private routeStringToPlain(routeString: string): string {
    return routeString?.replace('/', '').toLowerCase() || '';
  }
}
