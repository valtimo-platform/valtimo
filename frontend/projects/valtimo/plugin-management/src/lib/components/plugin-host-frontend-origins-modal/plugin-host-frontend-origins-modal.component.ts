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

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ButtonModule, InputModule, LayerModule, ModalModule} from 'carbon-components-angular';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {ExternalPluginHost} from '@valtimo/plugin';

/** A browser origin: `scheme://host[:port]`, no path — the shape the backend stores. */
const ORIGIN_PATTERN = /^https?:\/\/[^/\s]+$/;

/**
 * Runtime edit path for the browser origins allowed to embed a host's plugin screens — the same
 * narrowly-scoped shape as the event-queue modal. The connection fields (base URL, secret, broker)
 * have their own edit modal (#618).
 *
 * Saving an empty list is meaningful, not a mistake: it means no page may frame this host's plugins.
 */
@Component({
  standalone: true,
  selector: 'valtimo-plugin-host-frontend-origins-modal',
  templateUrl: './plugin-host-frontend-origins-modal.component.html',
  styleUrls: ['./plugin-host-frontend-origins-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    ModalModule,
    ButtonModule,
    InputModule,
    LayerModule,
    ValtimoCdsModalDirective,
  ],
})
export class PluginHostFrontendOriginsModalComponent implements OnChanges {
  @Input() public open = false;
  @Input() public host: ExternalPluginHost | null = null;

  @Output() public closeEvent = new EventEmitter<void>();
  @Output() public submitEvent = new EventEmitter<Array<string>>();

  public readonly form = new FormGroup({
    frontendOrigins: new FormArray<FormControl<string>>([]),
  });

  public get originControls(): Array<FormControl<string>> {
    return this.form.controls.frontendOrigins.controls;
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      this._loadHost();
    }
  }

  public addOrigin(): void {
    this.form.controls.frontendOrigins.push(this._originControl(''));
  }

  public removeOrigin(index: number): void {
    this.form.controls.frontendOrigins.removeAt(index);
  }

  public onSubmit(): void {
    if (this.form.invalid) return;
    this.submitEvent.emit(
      this.form.controls.frontendOrigins.controls
        .map(control => control.value.trim())
        .filter(origin => origin.length > 0)
    );
  }

  public onClose(): void {
    this.closeEvent.emit();
  }

  private _loadHost(): void {
    const array = this.form.controls.frontendOrigins;
    array.clear();
    (this.host?.frontendOrigins ?? []).forEach(origin => array.push(this._originControl(origin)));
  }

  private _originControl(value: string): FormControl<string> {
    // Deliberately not `required`: a row the admin added and left blank is dropped on submit
    // rather than blocking the save. `Validators.pattern` passes an empty value, so only a
    // *filled-in* row has to be a well-formed origin.
    return new FormControl<string>(value, {
      nonNullable: true,
      validators: [Validators.pattern(ORIGIN_PATTERN)],
    });
  }
}
