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

import {DOCUMENT} from '@angular/common';
import {
  AfterViewInit,
  Directive,
  ElementRef,
  Inject,
  OnDestroy,
  Renderer2,
  RendererStyleFlags2,
} from '@angular/core';

@Directive({selector: '[valtimoCdsModal]'})
export class ValtimoCdsModalDirective implements AfterViewInit, OnDestroy {
  private _mutationObserver: MutationObserver;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private readonly elementRef: ElementRef,
    private readonly renderer: Renderer2
  ) {
    this._mutationObserver = new MutationObserver((mutations: MutationRecord[]) => {
      mutations.forEach((mutation: MutationRecord) => this.attributeMutation(mutation));
    });
  }

  ngAfterViewInit(): void {
    this._mutationObserver.observe(this.elementRef.nativeElement, {
      attributes: true,
    });
  }

  ngOnDestroy(): void {
    this._mutationObserver.disconnect();
  }

  private attributeMutation = (mutation: MutationRecord): void => {
    const OPEN_ATTRIBUTE_NAME = 'ng-reflect-open';

    if (mutation.attributeName === OPEN_ATTRIBUTE_NAME) {
      const open: 'true' | 'false' =
        this.elementRef.nativeElement.getAttribute(OPEN_ATTRIBUTE_NAME);

      if (typeof open === 'string') {
        if (open === 'true') {
          this.setStyle();
        } else if (open === 'false') {
          this.removeStyle();
        }
      }
    }
  };

  private setStyle(): void {
    this.renderer.setStyle(this.document.body, 'overflow', 'hidden', RendererStyleFlags2.Important);
    this.renderer.setStyle(
      this.document.documentElement,
      'overflow',
      'hidden',
      RendererStyleFlags2.Important
    );
  }

  private removeStyle(): void {
    this.renderer.removeStyle(this.document.body, 'overflow');
    this.renderer.removeStyle(this.document.documentElement, 'overflow');
  }
}
