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
  OnDestroy,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {UserInterfaceService} from '../../services/user-interface.service';
import {PageHeaderService, PageTitleService} from '../../services';

@Component({
  selector: 'valtimo-page-header',
  templateUrl: './page-header.component.html',
  styleUrls: ['./page-header.component.scss'],
})
export class PageHeaderComponent implements AfterViewInit, OnDestroy {
  @ViewChild('contentVcr', {static: true, read: ViewContainerRef})
  private readonly _contentrVcr!: ViewContainerRef;
  @ViewChild('pageHead', {static: true, read: ElementRef})
  private readonly _pageHead!: ElementRef<HTMLDivElement>;
  public readonly showPageHeader$ = this.userInterfaceService.showPageHeader$;
  public readonly compactMode$ = this.pageHeaderService.compactMode$;
  public readonly pageActionsHasContent$ = this.pageHeaderService.pageActionsHasContent$;
  public readonly pageTitleHidden$ = this.pageTitleService.pageTitleHidden$;

  private _pageHeadResizeObserver!: ResizeObserver;

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
    this._pageHeadResizeObserver?.disconnect();
  }

  private openPageHeadResizeObserver(): void {
    this._pageHeadResizeObserver = new ResizeObserver(entries => {
      const pageHeadEntry = Array.isArray(entries) && entries[0];
      const pageHeadHeight = pageHeadEntry?.contentRect?.height;

      if (pageHeadHeight) this.pageHeaderService.setPageHeadHeight(pageHeadHeight);
    });

    this._pageHeadResizeObserver.observe(this._pageHead.nativeElement);
  }
}
