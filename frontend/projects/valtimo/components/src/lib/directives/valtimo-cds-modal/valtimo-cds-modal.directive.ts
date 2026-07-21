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
  standalone: true,
})
export class ValtimoCdsModalDirective implements AfterViewInit, OnDestroy {
  @Input() public readonly minContentHeight = 0;

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
      characterData: true,
    });

    const open = this.elementRef.nativeElement.getAttribute('ng-reflect-open');
    if (open === 'true') {
      this.applyDocumentOverflowHidden();
    }

    this.applyStyleToModalElements();

    setTimeout(() => this.applyStyleToModalElements(), 0);

    // Capture phase so this runs before Carbon's bubbling keydown HostListener, allowing us to
    // preempt it. Listening on the document (not the host) makes ESC work regardless of focus.
    this.document.addEventListener('keydown', this._onDocumentKeydown, true);
  }

  public ngOnDestroy(): void {
    this._mutationObserver?.disconnect();
    this.removeDocumentOverflowHidden();
    this.document.removeEventListener('keydown', this._onDocumentKeydown, true);
  }

  /**
   * Closes the modal on ESC via the same path as the close (X) button.
   *
   * Carbon's built-in ESC handler mutates the modal's `open` field directly (bypassing the `[open]`
   * binding) and calls `modalService.destroy()`, which can desync state or destroy an unrelated
   * imperatively-created modal. Instead we preempt it and simulate a click on the close button,
   * which fires the modal's own `(closeSelect)` handler.
   */
  private readonly _onDocumentKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') {
      return;
    }

    const visibleModals = this.document.querySelectorAll('.cds--modal.is-visible');
    if (visibleModals.length === 0) {
      return;
    }

    // Only the directive owning the top-most (last rendered) visible modal reacts. Matching the modal
    // that directly owns the overlay (not merely an ancestor) ensures the correct handler acts when
    // modals are nested/stacked, so ESC closes only the top modal.
    const topModal = visibleModals[visibleModals.length - 1];
    if (topModal.closest('cds-modal') !== this.elementRef.nativeElement) {
      return;
    }

    event.stopImmediatePropagation();
    event.preventDefault();

    // Click this modal's own close (X) button — skipping close buttons of nested modals — so ESC
    // runs exactly the same handling as the close button. Does nothing if there is no close button.
    const closeButton = Array.from(
      this.elementRef.nativeElement.querySelectorAll('.cds--modal-close') as NodeListOf<HTMLElement>
    ).find(button => button.closest('cds-modal') === this.elementRef.nativeElement);
    closeButton?.click();
  };

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

    this.applyStyleToModalElements();
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

  private applyStyleToModalElements(): void {
    if (this.minContentHeight <= 0) return;

    const contentElements = this.elementRef.nativeElement.querySelectorAll('.cds--modal-content');

    for (const element of contentElements) {
      this.renderer.setStyle(
        element,
        'min-height',
        `min(${this.minContentHeight}px, calc(90dvh - 13rem))`,
        RendererStyleFlags2.Important
      );
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
