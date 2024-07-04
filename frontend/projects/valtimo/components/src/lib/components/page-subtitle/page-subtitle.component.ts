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

import {Component, ViewEncapsulation} from '@angular/core';
import {CommonModule} from '@angular/common';
import {SkeletonModule} from 'carbon-components-angular';
import {map, Observable, startWith, switchMap} from 'rxjs';
import {ActivatedRoute, Router} from '@angular/router';
import {PageHeaderService, PageTitleService} from '../../services';
import {RenderPageSubtitleDirectiveModule} from '../../directives/render-page-subtitle/render-page-subtitle-directive.module';
import {RenderPageHeaderDirectiveModule} from '../../directives/render-page-header/render-page-header-directive.module';

@Component({
  selector: 'valtimo-page-subtitle',
  templateUrl: './page-subtitle.component.html',
  styleUrls: ['./page-subtitle.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    SkeletonModule,
    RenderPageSubtitleDirectiveModule,
    RenderPageHeaderDirectiveModule,
  ],
  encapsulation: ViewEncapsulation.None,
})
export class PageSubtitleComponent {
  public readonly hasCustomPageSubtitle$: Observable<boolean> = this.router.events.pipe(
    startWith(this.router),
    switchMap(() => this.activatedRoute.firstChild.data),
    map(data => !!data?.customPageSubtitle)
  );
  public readonly hasPageActions$ = this.pageTitleService.hasPageActions$;
  public readonly pageActionsFullWidth$ = this.pageTitleService.pageActionsFullWidth$;
  public readonly customPageSubtitleSet$ = this.pageTitleService.customPageSubtitleSet$;
  public readonly customPageSubtitle$ = this.pageTitleService.customPageSubtitle$;
  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  constructor(
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute,
    private readonly pageTitleService: PageTitleService,
    private readonly pageHeaderService: PageHeaderService
  ) {}
}
