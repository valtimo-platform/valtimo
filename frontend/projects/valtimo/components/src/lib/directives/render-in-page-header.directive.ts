/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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

import {AfterContentInit, ContentChild, Directive, TemplateRef} from '@angular/core';
import {take} from 'rxjs';
import {PageTitleService} from '../components/page-title/page-title.service';

@Directive({selector: '[renderInPageHeader]'})
export class RenderInPageHeaderDirective implements AfterContentInit {
  @ContentChild(TemplateRef) templateRef;
  constructor(private readonly pageTitleService: PageTitleService) {}

  ngAfterContentInit(): void {
    this.pageTitleService.pageActionsViewContainerRef$.pipe(take(1)).subscribe(pageActionsVcr => {
      if (this.templateRef) {
        pageActionsVcr.clear();
        pageActionsVcr.createEmbeddedView(this.templateRef);
        this.pageTitleService.setHasPageActions(true);
      }
    });
  }
}
