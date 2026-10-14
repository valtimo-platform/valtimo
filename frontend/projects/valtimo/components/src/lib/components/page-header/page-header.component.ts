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

import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {filter, map, Subscription} from 'rxjs';
import {UserInterfaceService} from '../../services/user-interface.service';
import {PageHeaderService, PageTitleService} from '../../services';
import {fromResizeObserver} from '../../utils/observer.utils';

@Component({
  selector: 'valtimo-page-header',
  templateUrl: './page-header.component.html',
  styleUrls: ['./page-header.component.scss'],
  standalone: false,
})
export class PageHeaderComponent implements AfterViewInit, OnDestroy {
  @ViewChild('contentVcr', {static: true, read: ViewContainerRef})
  private readonly _contentrVcr!: ViewContainerRef;
  @ViewChild('pageHead', {static: true, read: ElementRef})
  private readonly _pageHead!: ElementRef<HTMLDivElement>;
  public readonly showPageHeader$ = this.userInterfaceService.showPageHeader$;
  public readonly compactMode$ = this.pageHeaderService.compactMode$;
  public readonly smallTitle$ = this.pageHeaderService.smallTitle$;
  public readonly titleAsBreadcrumb$ = this.pageHeaderService.titleAsBreadcrumb$;
  public readonly pageActionsHasContent$ = this.pageHeaderService.pageActionsHasContent$;
  public readonly pageTitleHidden$ = this.pageTitleService.pageTitleHidden$;
  public readonly pageActionsWrap$ = this.pageTitleService.pageActionsWrap$;
  public readonly pageActionsMinWidth$ = this.pageTitleService.pageActionsMinWidth$;

  private _pageHeadHeightSubscription: Subscription | null = null;

  constructor(
    private readonly userInterfaceService: UserInterfaceService,
    private readonly pageHeaderService: PageHeaderService,
    private readonly pageTitleService: PageTitleService
  ) {}

  public ngAfterViewInit(): void {
    this.pageHeaderService.setContentViewContainerRef(this._contentrVcr);
    this.openPageHeadResizeObserver();
  }

  public ngOnDestroy(): void {
    this._pageHeadHeightSubscription?.unsubscribe();
  }

  private openPageHeadResizeObserver(): void {
    // Width-only resizes emit too: FitPage re-fits when content above it reflows.
    this._pageHeadHeightSubscription = fromResizeObserver(this._pageHead.nativeElement)
      .pipe(
        map(entries => entries[entries.length - 1]?.contentRect.height),
        filter((height): height is number => !!height)
      )
      .subscribe(height => this.pageHeaderService.setPageHeadHeight(height));
  }
}
