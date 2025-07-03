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

import {Component, OnDestroy} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ActivatedRoute, Router} from '@angular/router';
import {combineLatest, filter, map, Observable, of, switchMap} from 'rxjs';
import {PageTitleService} from '@valtimo/components';
import {ButtonModule, IconModule, IconService, InputModule} from 'carbon-components-angular';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {Search16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {IkoApiService} from '../../services';
import {IkoDataRequestUser} from '../../models';
import {IkoListComponent} from '../iko-list/iko-list.component';

@Component({
  selector: 'valtimo-iko-search',
  standalone: true,
  templateUrl: './iko-search.component.html',
  styleUrls: ['./iko-search.component.scss'],
  imports: [
    CommonModule,
    InputModule,
    ButtonModule,
    IconModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    IkoListComponent,
  ],
})
export class IkoSearchComponent implements OnDestroy {
  public readonly formValues: Record<string, string> = {};

  private readonly _key$ = this.route.params.pipe(
    map(params => params?.key),
    filter(key => !!key)
  );

  public readonly dataRequests$: Observable<IkoDataRequestUser[]> = this._key$.pipe(
    switchMap(key =>
      combineLatest([
        of(key),
        this.ikoApiService.cachedMenuItems$,
        this.ikoApiService.getIkoDataRequests(key),
      ])
    ),
    map(([key, menuItems, dataRequests]) => {
      const currentMenuItem = menuItems.find(item => item.key === key);

      if (currentMenuItem && currentMenuItem?.title)
        this.pageTitleService.setCustomPageTitle(currentMenuItem.title, true);

      return dataRequests;
    })
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly pageTitleService: PageTitleService,
    private readonly iconService: IconService,
    private readonly ikoApiService: IkoApiService
  ) {
    this.iconService.register(Search16);
  }

  public ngOnDestroy(): void {
    this.pageTitleService.enableReset();
  }

  public hasAnyInput(params: {key: string}[]): boolean {
    return params.some(param => !!this.formValues[param.key]);
  }

  public isQueryGroup(param: any): param is {group: true; fields: any[]} {
    return param && param.group === true && Array.isArray(param.fields);
  }

  public searchGroup(paramKey: string, params: {key: string}[]): void {
    const queryParams: Record<string, string> = {};
    for (const param of params) {
      const value = this.formValues[param.key];
      if (value) {
        queryParams[param.key] = value;
      }
    }

    this.router.navigate([`${paramKey}`], {relativeTo: this.route, queryParams});
  }
}
