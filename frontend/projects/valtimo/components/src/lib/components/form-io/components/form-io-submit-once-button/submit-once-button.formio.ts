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

const SUBMIT_ONCE_BUTTON_TYPE = 'submitOnceButton';

// Emitted on the rendered form by the host when a submit did not go through, or the form moved on.
const SUBMIT_ONCE_RELEASE_EVENT = 'submitOnceRelease';

// The built-in submit button, locked after its first click until the submit fails.
class SubmitOnceButton extends BuiltInButton {
  private submitOnceLocked = false;

  static schema(...extend: any[]): any {
    return BuiltInButton.schema(
      {
        type: SUBMIT_ONCE_BUTTON_TYPE,
        label: 'Submit',
        key: 'submit',
        action: 'submit',
      },
      ...extend
    );
  }

  static get builderInfo(): any {
    return {
      title: 'Submit once',
      group: 'basic',
      icon: 'paper-plane',
      weight: 115,
      schema: SubmitOnceButton.schema(),
    };
  }

  static editForm(...extend: any[]): any {
    return BuiltInButton.editForm(
      [{key: 'display', components: [{key: 'action', ignore: true}]}],
      ...extend
    );
  }

  constructor(component: any, options: any, data: any) {
    super(component, options, data);
    this.component.action = 'submit';
  }

  get defaultSchema(): any {
    return SubmitOnceButton.schema();
  }

  get shouldDisabled(): boolean {
    return super.shouldDisabled || this.submitOnceLocked;
  }

  attachButton(): void {
    super.attachButton();
    this.on('submitError', () => this.releaseSubmitOnce(), true);
    this.on('cancelSubmit', () => this.releaseSubmitOnce(), true);
    this.on(SUBMIT_ONCE_RELEASE_EVENT, () => this.releaseSubmitOnce(), true);
  }

  onClick(event: Event): void {
    if (this.submitOnceLocked) {
      event?.preventDefault();
      event?.stopPropagation();
      return;
    }

    if (!this.disabled && this.options.attachMode !== 'builder') {
      this.submitOnceLocked = true;
    }

    super.onClick(event);
  }

  private releaseSubmitOnce(): void {
    if (!this.submitOnceLocked) return;

    this.submitOnceLocked = false;
    this.loading = false;
    this.disabled = this.shouldDisabled;
    this.setDisabled(this.refs.button, this.disabled);
  }
}

function registerFormioSubmitOnceButtonComponent(): void {
  Components.setComponent(SUBMIT_ONCE_BUTTON_TYPE, SubmitOnceButton);
}

export {
  SUBMIT_ONCE_BUTTON_TYPE,
  SUBMIT_ONCE_RELEASE_EVENT,
  SubmitOnceButton,
  registerFormioSubmitOnceButtonComponent,
};
