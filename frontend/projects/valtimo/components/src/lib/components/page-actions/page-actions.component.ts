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

import {
  AfterViewInit,
  Component,
  ElementRef,
  HostBinding,
  OnDestroy,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {SkeletonModule} from 'carbon-components-angular';
import {map, Observable, startWith, switchMap} from 'rxjs';
import {ActivatedRoute, Router} from '@angular/router';
import {PageHeaderService, PageSubtitleService, PageTitleService} from '../../services';

@Component({
  selector: 'valtimo-page-actions',
  templateUrl: './page-actions.component.html',
  styleUrls: ['./page-actions.component.scss'],
  standalone: true,
  imports: [CommonModule, SkeletonModule],
  encapsulation: ViewEncapsulation.None,
})
export class PageActionsComponent implements AfterViewInit, OnDestroy {
  @ViewChild('pageActionsVcr', {static: true, read: ViewContainerRef})
  private readonly _pageActionsVcr!: ViewContainerRef;
  @ViewChild('pageActions')
  private readonly _pageActions!: ElementRef<HTMLDivElement>;
  @ViewChild('subtitleVcr', {static: true, read: ViewContainerRef})
  private readonly _subtitleVcr!: ViewContainerRef;
  @HostBinding('class') class = 'valtimo-page-actions';

  public readonly hasCustomPageSubtitle$: Observable<boolean> = this.router.events.pipe(
    startWith(this.router),
    switchMap(() => this.activatedRoute.firstChild.data),
    map(data => !!data?.customPageSubtitle)
  );
  public readonly hasPageActions$ = this.pageTitleService.hasPageActions$;
  public readonly pageActionsFullWidth$ = this.pageTitleService.pageActionsFullWidth$;
  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  private _pageActionsObserver!: MutationObserver;

  constructor(
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute,
    private readonly pageTitleService: PageTitleService,
    private readonly pageHeaderService: PageHeaderService,
    private readonly pageSubtitleService: PageSubtitleService
  ) {}

  public ngAfterViewInit(): void {
    this.pageTitleService.setPageActionsViewContainerRef(this._pageActionsVcr);
    this.pageSubtitleService.setActionsViewContainerRef(this._subtitleVcr);
    this.openPageActionsMutationObserver();
  }

  public ngOnDestroy(): void {
    this._pageActionsObserver?.disconnect();
  }

  private openPageActionsMutationObserver(): void {
    if (!this._pageActions) return;

    this._pageActionsObserver = new MutationObserver(mutations => {
      const firstMutation = mutations[0];
      const target = firstMutation?.target as HTMLDivElement;
      const children = target?.children;
      const childrenArray = (children && Array.from(children)) || [];

      this.pageHeaderService.setPageActionsHasContent(childrenArray.length > 0);
    });

    this._pageActionsObserver.observe(this._pageActions.nativeElement, {childList: true});

    this.setInitialPageActionsHasChildren();
  }

  private setInitialPageActionsHasChildren(): void {
    const children = this._pageActions.nativeElement.children;
    const childrenArray = (children && Array.from(children)) || [];

    this.pageHeaderService.setPageActionsHasContent(childrenArray.length > 0);
  }
}
