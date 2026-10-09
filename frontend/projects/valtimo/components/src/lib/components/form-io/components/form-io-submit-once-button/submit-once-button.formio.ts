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

export const SUBMIT_ONCE_BUTTON_TYPE = 'submitOnceButton';

// Host emits on rendered form: submit failed or form moved on
export const SUBMIT_ONCE_RELEASE_EVENT = 'submitOnceRelease';

// Built-in submit button, locked after form submit until submit fails
export class SubmitOnceButton extends BuiltInButton {
  private _submitOnceLocked = false;

  public static schema(...extend: any[]): any {
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

  public static get builderInfo(): any {
    return {
      title: 'Submit once',
      group: 'basic',
      icon: 'paper-plane',
      weight: 115,
      schema: SubmitOnceButton.schema(),
    };
  }

  public static editForm(...extend: any[]): any {
    return BuiltInButton.editForm(
      [{key: 'display', components: [{key: 'action', ignore: true}]}],
      ...extend
    );
  }

  constructor(component: any, options: any, data: any) {
    super(component, options, data);
    this.component.action = 'submit';
  }

  public get defaultSchema(): any {
    return SubmitOnceButton.schema();
  }

  public get shouldDisabled(): boolean {
    return super.shouldDisabled || this._submitOnceLocked;
  }

  public attachButton(): void {
    super.attachButton();
    // Every submit button of form emits this — second Submit once button locks too
    this.on('submitButton', () => this.lockSubmitOnce(), true);
    this.on('submitError', () => this.releaseSubmitOnce(), true);
    this.on('cancelSubmit', () => this.releaseSubmitOnce(), true);
    this.on(SUBMIT_ONCE_RELEASE_EVENT, () => this.releaseSubmitOnce(), true);
  }

  public onClick(event: Event): void {
    if (this._submitOnceLocked) {
      event?.preventDefault();
      event?.stopPropagation();
      return;
    }

    super.onClick(event);
  }

  private lockSubmitOnce(): void {
    this._submitOnceLocked = true;
    this.disabled = true;
    this.setDisabled(this.refs.button, true);
  }

  private releaseSubmitOnce(): void {
    if (!this._submitOnceLocked) return;

    this._submitOnceLocked = false;
    this.loading = false;
    this.disabled = this.shouldDisabled;
    this.setDisabled(this.refs.button, this.disabled);
  }
}

export function registerFormioSubmitOnceButtonComponent(): void {
  Components.setComponent(SUBMIT_ONCE_BUTTON_TYPE, SubmitOnceButton);
}
