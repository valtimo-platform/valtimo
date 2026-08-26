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

// Input types that support the readonly attribute. The remaining ones - checkboxes and radios
// above all - have to be disabled instead, or they can still be toggled through their label.
const READ_ONLY_INPUT_TYPES = ['email', 'number', 'password', 'search', 'tel', 'text', 'url'];

const FOCUSABLE =
  'a[href], area[href], button, input, select, textarea, iframe, [tabindex], [contenteditable]';

/**
 * Makes the content of the host read-only, and keeps doing so while that content changes. Used for
 * the process link modal, whose configuration step is rendered by components that are contributed
 * by plugins and cannot be asked for a read-only mode of their own.
 *
 * Two things happen, and both are needed. Marking the individual controls as readonly or disabled
 * is what makes them *look* unavailable and what a screen reader announces. Taking the host out of
 * reach of the mouse and the tab order is what actually *guarantees* it: composite widgets such as
 * the Carbon combo box open their menu from a plain div, which has no disabled state to set, and
 * a plugin can contribute any widget at all.
 */
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

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  public ngOnInit(): void {
    this._observer = new MutationObserver(() => this.apply());
    this._observer.observe(this.elementRef.nativeElement, {childList: true, subtree: true});
    this.apply();
  }

  public ngOnDestroy(): void {
    this._observer?.disconnect();
  }

  private apply(): void {
    const host = this.elementRef?.nativeElement;

    if (!host) return;

    if (!this._readOnly) {
      this.setContentPointerEvents('');
      return;
    }

    // Nothing inside can be clicked, which covers both the widgets that have no disabled state of
    // their own and the ones whose disabled state Angular rebinds on every change detection run.
    // Applied to the children rather than to the host, so that the host itself keeps receiving the
    // wheel events that scroll a long configuration. Deliberately not `inert`, which would also
    // hide the configuration from screen readers.
    this.setContentPointerEvents('none');

    // ...and nothing inside can be tabbed to either
    host.querySelectorAll<HTMLElement>(FOCUSABLE).forEach(element => {
      element.setAttribute('tabindex', '-1');
    });

    host.querySelectorAll('input').forEach(input => {
      if (READ_ONLY_INPUT_TYPES.includes(input.type)) {
        input.readOnly = true;
      } else {
        input.disabled = true;
      }
    });

    host.querySelectorAll('textarea').forEach(textarea => (textarea.readOnly = true));

    host
      .querySelectorAll<HTMLSelectElement | HTMLButtonElement>('select, button')
      .forEach(control => (control.disabled = true));

    host
      .querySelectorAll('[contenteditable="true"]')
      .forEach(editor => editor.setAttribute('contenteditable', 'false'));

    // Carbon renders the clear and expand affordances of a combo box as divs, which have no
    // disabled state of their own
    host
      .querySelectorAll<HTMLElement>('[role="button"], [role="combobox"], [role="listbox"]')
      .forEach(element => element.setAttribute('aria-disabled', 'true'));
  }

  private setContentPointerEvents(value: string): void {
    Array.from(this.elementRef.nativeElement.children).forEach(child => {
      (child as HTMLElement).style.pointerEvents = value;
    });
  }
}
