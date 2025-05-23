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
  EmbeddedViewRef,
  Inject,
  OnDestroy,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {CommonModule, DOCUMENT} from '@angular/common';

@Component({
  selector: 'valtimo-render-in-body',
  template: `<ng-template #content><ng-content></ng-content></ng-template>`,
  standalone: true,
  imports: [CommonModule],
})
export class RenderInBodyComponent implements AfterViewInit, OnDestroy {
  @ViewChild('content', {read: TemplateRef, static: true})
  private readonly _contentTemplate!: TemplateRef<any>;

  private _viewRef!: EmbeddedViewRef<any>;

  constructor(
    private readonly viewContainerRef: ViewContainerRef,
    @Inject(DOCUMENT) private readonly document: Document
  ) {}

  public ngAfterViewInit(): void {
    this._viewRef = this.viewContainerRef.createEmbeddedView(this._contentTemplate);
    this._viewRef.detectChanges();

    this._viewRef.rootNodes.forEach(node => this.document.body.appendChild(node));
  }

  public ngOnDestroy(): void {
    this._viewRef?.rootNodes.forEach(node => {
      if (node instanceof Node && node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });

    this._viewRef?.destroy();
  }
}
