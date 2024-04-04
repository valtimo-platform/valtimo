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

import {AfterContentInit, ContentChild, Directive, OnDestroy, TemplateRef} from '@angular/core';
import {combineLatest, Subscription} from 'rxjs';
import {PageHeaderService} from '../../services';

@Directive({selector: '[renderPageHeader]'})
export class RenderPageHeaderDirective implements AfterContentInit, OnDestroy {
  @ContentChild(TemplateRef) templateRef;

  private readonly _subscriptions = new Subscription();
  constructor(private readonly pageHeaderService: PageHeaderService) {}

  public ngAfterContentInit(): void {
    this._subscriptions.add(
      combineLatest([
        this.pageHeaderService.compactMode$,
        this.pageHeaderService.headerViewContainerRef$,
        this.pageHeaderService.contentViewContainerRef$,
      ]).subscribe(([compactMode, headerViewContainerRef, contentViewContainerRef]) => {
        if (!this.templateRef) return;

        headerViewContainerRef.clear();
        contentViewContainerRef.clear();

        if (compactMode) {
          headerViewContainerRef.createEmbeddedView(this.templateRef);
        } else {
          contentViewContainerRef.createEmbeddedView(this.templateRef);
        }
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }
}
