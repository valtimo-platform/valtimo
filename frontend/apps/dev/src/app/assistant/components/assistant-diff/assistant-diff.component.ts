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

import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {FormioForm} from '@formio/angular';
import {TranslateModule} from '@ngx-translate/core';
import {FormIoModule} from '@valtimo/components';
import {ASSISTANT_TEST_IDS} from '../../constants';
import {isAbsent, toFormioForm} from '../../utils';

/*
 * Shows the two sides of a change next to each other. A form definition is rendered as the
 * form itself, read-only, which is far easier to judge than a list of component names;
 * anything else falls back to monospaced text.
 */
@Component({
  standalone: true,
  selector: 'valtimo-assistant-diff',
  templateUrl: './assistant-diff.component.html',
  styleUrls: ['./assistant-diff.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormIoModule, TranslateModule],
})
export class AssistantDiffComponent {
  @Input() public set before(value: string | undefined) {
    this._before = value;
    this.beforeForm = toFormioForm(value);
    this.beforeAbsent = isAbsent(value);
  }

  @Input() public set after(value: string | undefined) {
    this._after = value;
    this.afterForm = toFormioForm(value);
    this.afterAbsent = isAbsent(value);
  }

  public beforeForm: FormioForm | null = null;
  public afterForm: FormioForm | null = null;
  public beforeAbsent = false;
  public afterAbsent = false;

  protected readonly testIds = ASSISTANT_TEST_IDS;

  private _before?: string;
  private _after?: string;

  public get beforeText(): string {
    return this._before ?? '';
  }

  public get afterText(): string {
    return this._after ?? '';
  }

  // Only render forms side by side when both sides agree on being a form (or absent), so a
  // form is never compared against a block of text.
  public get showForms(): boolean {
    return (
      (!!this.beforeForm || this.beforeAbsent) &&
      (!!this.afterForm || this.afterAbsent) &&
      (!!this.beforeForm || !!this.afterForm)
    );
  }
}
