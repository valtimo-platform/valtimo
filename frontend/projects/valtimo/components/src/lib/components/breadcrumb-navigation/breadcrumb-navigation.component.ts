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

import {Component, HostBinding, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {combineLatest, map, Observable, Subscription} from 'rxjs';
import {BreadcrumbItem} from 'carbon-components-angular';
import {BreadcrumbService} from './breadcrumb.service';
import {PageHeaderService, PageTitleService} from '../../services';

@Component({
  selector: 'valtimo-breadcrumb-navigation',
  templateUrl: './breadcrumb-navigation.component.html',
  styleUrls: ['./breadcrumb-navigation.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class BreadcrumbNavigationComponent implements OnInit, OnDestroy {
  @HostBinding('class.valtimo-breadcrumb-navigation--compact') isCompact!: boolean;

  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  public readonly breadcrumbItems$: Observable<Array<BreadcrumbItem>> = combineLatest([
    this.breadcrumbService.breadcrumbItems$,
    this.compactMode$,
    this.pageTitleService.pageTitleHidden$,
  ]).pipe(
    map(([breadCrumbItems, compactMode, pageTitleHidden]) => [
      ...(compactMode && !pageTitleHidden ? [{content: ''}] : []),
      ...breadCrumbItems,
    ])
  );

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly breadcrumbService: BreadcrumbService,
    private readonly pageHeaderService: PageHeaderService,
    private readonly pageTitleService: PageTitleService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this.pageHeaderService.compactMode$.subscribe(compactMode => {
        this.isCompact = compactMode;
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }
}
