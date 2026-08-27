/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

import {Directive, ElementRef, Input, OnDestroy, OnInit} from '@angular/core';

const READ_ONLY_INPUT_TYPES = ['email', 'number', 'password', 'search', 'tel', 'text', 'url'];

const FOCUSABLE =
  'a[href], area[href], button, input, select, textarea, iframe, [tabindex], [contenteditable]';

interface OriginalState {
  tabindex: string | null;
  contenteditable: string | null;
  ariaDisabled: string | null;
  pointerEvents: string;
  readOnly: boolean | null;
  disabled: boolean | null;
}

@Directive({
  standalone: true,
  selector: '[valtimoReadOnlyContent]',
})
export class ReadOnlyContentDirective implements OnInit, OnDestroy {
  @Input('valtimoReadOnlyContent') public set readOnly(readOnly: boolean) {
    this._readOnly = !!readOnly;
    this.apply();
  }

  private _readOnly = false;
  private _observer: MutationObserver | null = null;
  private readonly _originalStates = new Map<HTMLElement, OriginalState>();

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  public ngOnInit(): void {
    this._observer = new MutationObserver(() => this.apply());
    this._observer.observe(this.elementRef.nativeElement, {childList: true, subtree: true});
    this.apply();
  }

  public ngOnDestroy(): void {
    this._observer?.disconnect();
    this._originalStates.clear();
  }

  private apply(): void {
    const host = this.elementRef?.nativeElement;

    if (!host) return;

    if (!this._readOnly) {
      this.restore();
      return;
    }

    Array.from(host.children).forEach(child => {
      this.remember(child as HTMLElement).style.pointerEvents = 'none';
    });

    host.querySelectorAll<HTMLElement>(FOCUSABLE).forEach(element => {
      this.remember(element).setAttribute('tabindex', '-1');
    });

    host.querySelectorAll('input').forEach(input => {
      if (READ_ONLY_INPUT_TYPES.includes(input.type)) {
        this.remember(input).readOnly = true;
      } else {
        this.remember(input).disabled = true;
      }
    });

    host
      .querySelectorAll('textarea')
      .forEach(textarea => (this.remember(textarea).readOnly = true));

    host
      .querySelectorAll<HTMLSelectElement | HTMLButtonElement>('select, button')
      .forEach(control => (this.remember(control).disabled = true));

    host
      .querySelectorAll<HTMLElement>('[contenteditable="true"]')
      .forEach(editor => this.remember(editor).setAttribute('contenteditable', 'false'));

    host
      .querySelectorAll<HTMLElement>('[role="button"], [role="combobox"], [role="listbox"]')
      .forEach(element => this.remember(element).setAttribute('aria-disabled', 'true'));
  }

  private remember<T extends HTMLElement>(element: T): T {
    if (!this._originalStates.has(element)) {
      const control = element as Partial<HTMLInputElement>;

      this._originalStates.set(element, {
        tabindex: element.getAttribute('tabindex'),
        contenteditable: element.getAttribute('contenteditable'),
        ariaDisabled: element.getAttribute('aria-disabled'),
        pointerEvents: element.style.pointerEvents,
        readOnly: 'readOnly' in element ? !!control.readOnly : null,
        disabled: 'disabled' in element ? !!control.disabled : null,
      });
    }

    return element;
  }

  private restore(): void {
    this._originalStates.forEach((original, element) => {
      this.restoreAttribute(element, 'tabindex', original.tabindex);
      this.restoreAttribute(element, 'contenteditable', original.contenteditable);
      this.restoreAttribute(element, 'aria-disabled', original.ariaDisabled);

      element.style.pointerEvents = original.pointerEvents;

      const control = element as Partial<HTMLInputElement>;

      if (original.readOnly !== null) control.readOnly = original.readOnly;
      if (original.disabled !== null) control.disabled = original.disabled;
    });

    this._originalStates.clear();
  }

  private restoreAttribute(element: HTMLElement, name: string, value: string | null): void {
    if (value === null) {
      element.removeAttribute(name);
    } else {
      element.setAttribute(name, value);
    }
  }
}
