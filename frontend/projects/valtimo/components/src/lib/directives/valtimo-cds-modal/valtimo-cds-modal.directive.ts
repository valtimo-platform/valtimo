/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * You may not use this file except in compliance with the License.
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
  Input,
  OnDestroy,
  Renderer2,
  RendererStyleFlags2,
} from '@angular/core';

@Directive({
  selector: '[valtimoCdsModal]',
})
export class ValtimoCdsModalDirective implements AfterViewInit, OnDestroy {
  @Input() public readonly enableOverflow = false;

  private _mutationObserver: MutationObserver;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private readonly elementRef: ElementRef,
    private readonly renderer: Renderer2
  ) {}

  public ngAfterViewInit(): void {
    this._mutationObserver = new MutationObserver((mutations: MutationRecord[]) => {
      this.handleMutations(mutations);
    });

    this._mutationObserver.observe(this.elementRef.nativeElement, {
      attributes: true,
      childList: true,
      subtree: true,
    });

    const open = this.elementRef.nativeElement.getAttribute('ng-reflect-open');

    if (open === 'true') {
      this.applyDocumentOverflowHidden();
    }

    this.applyOverflowToModalElements();
  }

  public ngOnDestroy(): void {
    this._mutationObserver.disconnect();
  }

  private handleMutations(mutations: MutationRecord[]): void {
    const OPEN_ATTRIBUTE_NAME = 'ng-reflect-open';

    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === OPEN_ATTRIBUTE_NAME) {
        const open = this.elementRef.nativeElement.getAttribute(OPEN_ATTRIBUTE_NAME);
        if (open === 'true') {
          this.applyDocumentOverflowHidden();
        } else if (open === 'false') {
          this.removeDocumentOverflowHidden();
        }
      }
    }

    this.applyOverflowToModalElements();
  }

  private applyDocumentOverflowHidden(): void {
    this.renderer.setStyle(this.document.body, 'overflow', 'hidden', RendererStyleFlags2.Important);
    this.renderer.setStyle(
      this.document.documentElement,
      'overflow',
      'hidden',
      RendererStyleFlags2.Important
    );
    this.preventModalCloseButtonTooltip();
  }

  private removeDocumentOverflowHidden(): void {
    this.renderer.removeStyle(this.document.body, 'overflow');
    this.renderer.removeStyle(this.document.documentElement, 'overflow');
  }

  private applyOverflowToModalElements(): void {
    if (this.enableOverflow) {
      const modalElements = this.document.querySelectorAll('.cds--modal, .cds--modal-content');
      modalElements.forEach((el: Element) => {
        this.renderer.setStyle(el, 'overflow', 'visible');
      });
    }
  }

  private preventModalCloseButtonTooltip(): void {
    const modalElement = this.elementRef.nativeElement as HTMLElement;
    const closeButton = modalElement.querySelector('.cds--modal-close') as HTMLElement;

    let attempts = 0;
    const maxAttempts = 100;

    const blurIfFocused = () => {
      if (!closeButton || attempts >= maxAttempts) {
        return;
      }

      if (this.document.activeElement === closeButton) {
        closeButton.blur();
      } else {
        attempts++;
        requestAnimationFrame(blurIfFocused);
      }
    };

    requestAnimationFrame(blurIfFocused);
  }
}
