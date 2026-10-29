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

// Carbon draws a control read-only through a modifier class on its wrapper.
const CARBON_READ_ONLY_MODIFIERS: ReadonlyArray<[string, string]> = [
  ['.cds--checkbox-group', 'cds--checkbox-group--readonly'],
  ['.cds--checkbox-wrapper', 'cds--checkbox-wrapper--readonly'],
  ['.cds--combo-box', 'cds--combo-box--readonly'],
  ['.cds--dropdown', 'cds--dropdown--readonly'],
  ['.cds--multi-select', 'cds--multi-select--readonly'],
  ['.cds--number', 'cds--number--readonly'],
  ['.cds--radio-button-group', 'cds--radio-button-group--readonly'],
  ['.cds--select', 'cds--select--readonly'],
  ['.cds--slider-container', 'cds--slider-container--readonly'],
  ['.cds--text-area__wrapper', 'cds--text-area__wrapper--readonly'],
  ['.cds--text-input-wrapper', 'cds--text-input-wrapper--readonly'],
  ['.cds--time-picker', 'cds--time-picker--readonly'],
  ['.cds--toggle', 'cds--toggle--readonly'],
];

// Fields used without their Carbon wrapper need their parent to carry the modifier instead.
const CARBON_UNWRAPPED_FIELDS: ReadonlyArray<[string, string, string]> = [
  ['.cds--text-area', '.cds--text-area__wrapper', 'cds--text-area__wrapper--readonly'],
  ['.cds--text-input', '.cds--text-input-wrapper', 'cds--text-input-wrapper--readonly'],
];

// Carbon buttons change the content, so read-only content leaves them out instead of disabling them.
const EDIT_ACTIONS = '.cds--btn:not(.cds--text-input--password__visibility__toggle)';

type StyleProperty = 'display' | 'pointerEvents';

interface OriginalState {
  addedClasses: string[];
  attributes: Map<string, string | null>;
  readOnly: boolean | null;
  styles: Map<StyleProperty, string>;
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

  private readonly _blockActivation = (event: Event): void => {
    if (!this._readOnly) return;

    event.preventDefault();
    event.stopPropagation();
  };

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  public ngOnInit(): void {
    this._observer = new MutationObserver(() => this.apply());
    this._observer.observe(this.elementRef.nativeElement, {childList: true, subtree: true});
    this.elementRef.nativeElement.addEventListener('click', this._blockActivation, true);
    this.apply();
  }

  public ngOnDestroy(): void {
    this._observer?.disconnect();
    this.elementRef.nativeElement.removeEventListener('click', this._blockActivation, true);
    this._originalStates.clear();
  }

  private apply(): void {
    const host = this.elementRef?.nativeElement;

    if (!host) return;

    if (!this._readOnly) {
      this.restore();
      return;
    }

    Array.from(host.children).forEach(child =>
      this.setStyle(child as HTMLElement, 'pointerEvents', 'none')
    );

    host
      .querySelectorAll<HTMLElement>(FOCUSABLE)
      .forEach(element => this.setAttribute(element, 'tabindex', '-1'));

    host.querySelectorAll('input').forEach(input => {
      if (READ_ONLY_INPUT_TYPES.includes(input.type)) this.setReadOnly(input);
    });

    host.querySelectorAll('textarea').forEach(textarea => this.setReadOnly(textarea));

    host
      .querySelectorAll<HTMLElement>('[contenteditable="true"]')
      .forEach(editor => this.setAttribute(editor, 'contenteditable', 'false'));

    host
      .querySelectorAll<HTMLElement>('[role="combobox"], [role="listbox"]')
      .forEach(element => this.setAttribute(element, 'aria-readonly', 'true'));

    host
      .querySelectorAll<HTMLElement>('[role="button"]')
      .forEach(element => this.setAttribute(element, 'aria-disabled', 'true'));

    host
      .querySelectorAll<HTMLElement>(EDIT_ACTIONS)
      .forEach(action => this.setStyle(action, 'display', 'none'));

    this.applyCarbonReadOnlyStyling(host);
  }

  private applyCarbonReadOnlyStyling(host: HTMLElement): void {
    CARBON_READ_ONLY_MODIFIERS.forEach(([selector, modifier]) =>
      host
        .querySelectorAll<HTMLElement>(selector)
        .forEach(wrapper => this.addClass(wrapper, modifier))
    );

    CARBON_UNWRAPPED_FIELDS.forEach(([field, wrapper, modifier]) =>
      host.querySelectorAll<HTMLElement>(field).forEach(control => {
        const parent = control.parentElement;

        if (!parent || control.closest(wrapper)) return;

        this.addClass(parent, modifier);
      })
    );
  }

  private addClass(element: HTMLElement, className: string): void {
    if (element.classList.contains(className)) return;

    element.classList.add(className);
    this.stateOf(element).addedClasses.push(className);
  }

  private setAttribute(element: HTMLElement, name: string, value: string): void {
    const attributes = this.stateOf(element).attributes;

    if (!attributes.has(name)) attributes.set(name, element.getAttribute(name));

    element.setAttribute(name, value);
  }

  private setReadOnly(control: HTMLInputElement | HTMLTextAreaElement): void {
    const state = this.stateOf(control);

    if (state.readOnly === null) state.readOnly = control.readOnly;

    control.readOnly = true;
  }

  private setStyle(element: HTMLElement, property: StyleProperty, value: string): void {
    const styles = this.stateOf(element).styles;

    if (!styles.has(property)) styles.set(property, element.style[property]);

    element.style[property] = value;
  }

  private stateOf(element: HTMLElement): OriginalState {
    const state = this._originalStates.get(element) ?? {
      addedClasses: [],
      attributes: new Map<string, string | null>(),
      readOnly: null,
      styles: new Map<StyleProperty, string>(),
    };

    this._originalStates.set(element, state);

    return state;
  }

  private restore(): void {
    this._originalStates.forEach((original, element) => {
      original.attributes.forEach((value, name) => {
        if (value === null) {
          element.removeAttribute(name);
        } else {
          element.setAttribute(name, value);
        }
      });

      original.styles.forEach((value, property) => (element.style[property] = value));

      original.addedClasses.forEach(className => element.classList.remove(className));

      if (original.readOnly !== null) {
        (element as HTMLInputElement | HTMLTextAreaElement).readOnly = original.readOnly;
      }
    });

    this._originalStates.clear();
  }
}
