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
import {ActivatedRoute} from '@angular/router';
import {combineLatest, filter, map, Observable, tap} from 'rxjs';
import {IkoMenuItem, IkoMenuService, PageTitleService} from '@valtimo/components';
import {ButtonModule, IconModule, InputModule} from 'carbon-components-angular';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';

@Component({
  selector: 'valtimo-iko-search',
  standalone: true,
  templateUrl: './iko-search.component.html',
  styleUrls: ['./iko-search.component.scss'],
  imports: [CommonModule, InputModule, ButtonModule, IconModule, FormsModule, ReactiveFormsModule],
})
export class IkoSearchComponent implements OnDestroy {
  private readonly _profileUrl$ = this.route.params.pipe(
    map(params => params?.profileUrl),
    filter(url => !!url),
    map(url => this.ikoMenuService.base64ToValue(url))
  );

  public readonly ikoMenuItem$: Observable<IkoMenuItem> = combineLatest([
    this._profileUrl$,
    this.ikoMenuService.cachedMenuItems$,
  ]).pipe(
    map(([profileUrl, cachedMenuItems]) =>
      cachedMenuItems.find(item => item.profile.url === profileUrl)
    ),
    tap(menuItem => {
      if (!menuItem.title) return;
      this.pageTitleService.setCustomPageTitle(menuItem.title, true);
    })
  );

  public readonly formValues: Record<string, string> = {};

  constructor(
    private readonly route: ActivatedRoute,
    private readonly ikoMenuService: IkoMenuService,
    private readonly pageTitleService: PageTitleService
  ) {}

  public ngOnDestroy(): void {
    this.pageTitleService.enableReset();
  }
}
