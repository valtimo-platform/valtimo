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
  Input,
  OnDestroy,
  Renderer2,
} from '@angular/core';
import {OverflowMenu} from 'carbon-components-angular';
import {v4 as uuidv4} from 'uuid';

@Directive({selector: '[valtimoCdsOverflowButton]'})
export class ValtimoCdsOverflowButtonDirective implements AfterViewInit, OnDestroy {
  @Input() width = 0;

  private _observer!: MutationObserver;
  private readonly WRAPPER_CLASS = uuidv4();

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private readonly elementRef: ElementRef,
    private readonly renderer: Renderer2,
    private readonly host: OverflowMenu
  ) {}

  public ngAfterViewInit(): void {
    this.openMutationObserver();
    this.setHostInputs();
    this.setStyles();
  }

  public ngOnDestroy(): void {
    this._observer?.disconnect();
  }

  private setStyles(): void {
    const overflowMenuElement = this.elementRef.nativeElement.firstChild;
    const firstChildElement = overflowMenuElement.firstChild;
    this.renderer.setStyle(overflowMenuElement, 'visibility', 'hidden');
    this.renderer.setStyle(overflowMenuElement, 'display', 'flex');
    this.renderer.setStyle(overflowMenuElement, 'width', 'min-content');
    this.renderer.setStyle(overflowMenuElement, 'height', 'min-content');
    this.renderer.setStyle(firstChildElement, 'visibility', 'visible');
  }

  private setHostInputs(): void {
    this.host.wrapperClass = this.WRAPPER_CLASS;
    this.host.flip = true;
  }

  private openMutationObserver(): void {
    this._observer = new MutationObserver(() => {
      const overflowMenuElements = Array.from(
        this.document.getElementsByClassName(this.WRAPPER_CLASS)
      );
      const overFlowMenuElement = overflowMenuElements[0] as HTMLUListElement;

      if (overFlowMenuElement) {
        this.setOverFlowMenuProperties(overFlowMenuElement);
      }
    });

    this._observer.observe(this.document, {
      childList: true,
      subtree: true,
    });
  }

  private setOverFlowMenuProperties(element: HTMLUListElement): void {
    this.renderer.addClass(element, 'hide-after');

    if (this.width) {
      this.renderer.setStyle(element, 'width', `${this.width}px`);
    }
  }
}
