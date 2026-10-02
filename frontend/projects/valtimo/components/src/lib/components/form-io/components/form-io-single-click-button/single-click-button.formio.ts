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

import {Components} from 'formiojs';

const BuiltInButton = (Components as any).components['button'];

/**
 * A button component with the exact same schema and behavior as Form.io's
 * built-in Button component, except that only the first click (or Enter press)
 * is handled. All following clicks are ignored, which prevents the underlying
 * action (typically `submit`) from being triggered more than once.
 *
 * The button is released again when Form.io rejects the submit (e.g. because of
 * validation errors), so the user can correct the form and submit again.
 */
class SingleClickButtonComponent extends BuiltInButton {
  private isPressed = false;

  static schema(...extend: any[]) {
    return BuiltInButton.schema(
      {
        type: 'singleClickButton',
      },
      ...extend
    );
  }

  static get builderInfo() {
    return {
      title: 'Submit (single click)',
      group: 'basic',
      icon: 'stop',
      documentation: '/userguide/form-building/form-components#button',
      weight: 111,
      schema: SingleClickButtonComponent.schema(),
    };
  }

  static editForm(...extend: any[]) {
    return BuiltInButton.editForm(...extend);
  }

  attach(element: HTMLElement): Promise<void> {
    // Form.io emits `submitError` whenever a submit is rejected (e.g. validation errors);
    // `error` covers errors raised outside the submit flow.
    ['submitError', 'error'].forEach(eventName =>
      this.on(eventName, () => this.release(), true)
    );

    return super.attach(element);
  }

  private release(): void {
    this.isPressed = false;
  }

  onClick(event: Event): void {
    if (this.isPressed) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    this.isPressed = true;
    super.onClick(event);
  }
}

export function registerSingleClickButtonComponent(): void {
  Components.setComponent('singleClickButton', SingleClickButtonComponent);
}