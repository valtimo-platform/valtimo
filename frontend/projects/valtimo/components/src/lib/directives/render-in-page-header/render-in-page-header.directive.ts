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
  AfterContentInit,
  ContentChild,
  Directive,
  Input,
  OnDestroy,
  OnInit,
  TemplateRef,
} from '@angular/core';
import {Subscription, take} from 'rxjs';
import {PageHeaderService, PageTitleService} from '../../services';

@Directive({selector: '[renderInPageHeader]'})
export class RenderInPageHeaderDirective implements OnInit, AfterContentInit, OnDestroy {
  @ContentChild(TemplateRef) templateRef;
  @Input() fullWidth = false;

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly pageTitleService: PageTitleService,
    private readonly pageHeaderService: PageHeaderService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this.pageHeaderService.compactMode$.subscribe(() => {
        this.renderTemplateRef();
      })
    );
  }

  public ngAfterContentInit(): void {
    this.renderTemplateRef();
  }

  public ngOnDestroy() {
    this._subscriptions.unsubscribe();
  }

  private renderTemplateRef(): void {
    this.pageTitleService.pageActionsViewContainerRef$.pipe(take(1)).subscribe(pageActionsVcr => {
      if (this.templateRef) {
        pageActionsVcr.clear();
        pageActionsVcr.createEmbeddedView(this.templateRef);
        this.pageTitleService.setHasPageActions(true);
        this.pageTitleService.setPageActionsFullWidth(this.fullWidth);
      }
    });
  }
}
