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

import {Component, EventEmitter, Input, Output} from '@angular/core';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {FormioCustomComponent} from '../../../../modules';

@Component({
  selector: 'valtimo-mail-preview',
  template: `
    <div style="text-align:center">
      <p style="font-size:24px;color:#e0e0e0">E-MAILVOORBEELD</p>
      <p class="mail-preview-key">{{ variableKey }}</p>
    </div>
    <div [innerHTML]="safeValue"></div>
  `,
  styles: [`
    .mail-preview-key { display: none; font-size: 12px; color: #b0b0b0; }
    :host-context(.builder-component) .mail-preview-key { display: block; }
  `],
  standalone: false,
})
export class FormIoMailPreviewComponent implements FormioCustomComponent<string> {
  @Input() public disabled = false;
  @Input() public variableKey = '';
  @Output() public readonly valueChange = new EventEmitter<string>();

  public safeValue: SafeHtml = '';

  private _value = '';

  @Input() public set value(v: string) {
    this._value = v;
    this.safeValue = this.sanitizer.bypassSecurityTrustHtml(v ?? '');
  }

  public get value(): string {
    return this._value;
  }

  constructor(private readonly sanitizer: DomSanitizer) {}
}
