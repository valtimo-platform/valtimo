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
  signal,
  SimpleChanges,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ButtonModule, LoadingModule, ModalModule} from 'carbon-components-angular';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {ExternalPluginService} from '@valtimo/plugin';
import {UnifiedPluginConfigurationRow} from '../../models';
import {forkJoin} from 'rxjs';

@Component({
  standalone: true,
  selector: 'valtimo-plugin-external-edit-modal',
  templateUrl: './plugin-external-edit-modal.component.html',
  styleUrls: ['./plugin-external-edit-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    ModalModule,
    ButtonModule,
    LoadingModule,
    ValtimoCdsModalDirective,
  ],
})
export class PluginExternalEditModalComponent implements OnChanges {
  @Input() public open = false;
  @Input() public configuration: UnifiedPluginConfigurationRow | null = null;

  @Output() public closeEvent = new EventEmitter<void>();
  @Output() public savedEvent = new EventEmitter<void>();
  @Output() public deleteEvent = new EventEmitter<string>();

  public readonly _form = new FormGroup({
    title: new FormControl('', Validators.required),
    properties: new FormControl('{}'),
  });

  public readonly _$loading = signal(false);
  public readonly _$propertiesInvalid = signal(false);
  public readonly _$configurationSchema = signal<unknown | null>(null);

  constructor(private readonly _externalPluginService: ExternalPluginService) {}

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open && this.configuration) {
      this._initForm();
    }
  }

  public onSave(): void {
    if (this._form.invalid || this._$propertiesInvalid() || !this.configuration?.id) return;

    let properties: Record<string, unknown>;
    try {
      properties = JSON.parse(this._form.value.properties ?? '{}');
    } catch {
      this._$propertiesInvalid.set(true);
      return;
    }

    this._$loading.set(true);

    this._externalPluginService
      .updateConfiguration(this.configuration.id, {
        title: this._form.value.title ?? '',
        properties,
      })
      .subscribe({
        next: () => {
          this._$loading.set(false);
          this.savedEvent.emit();
        },
        error: () => {
          this._$loading.set(false);
        },
      });
  }

  public onDelete(): void {
    if (!this.configuration?.id) return;
    this.deleteEvent.emit(this.configuration.id);
  }

  public onClose(): void {
    this.closeEvent.emit();
    this._resetForm();
  }

  private _initForm(): void {
    this._form.reset({
      title: this.configuration?.title ?? '',
      properties: '{}',
    });
    this._$propertiesInvalid.set(false);
    this._$configurationSchema.set(null);

    const configId = this.configuration?.id;
    const definitionId = this.configuration?.externalDefinitionId;

    if (configId && definitionId) {
      this._$loading.set(true);
      forkJoin([
        this._externalPluginService.getConfiguration(configId),
        this._externalPluginService.getDefinition(definitionId),
      ]).subscribe({
        next: ([configDetail, definition]) => {
          this._$configurationSchema.set(definition.configurationSchema);
          this._form.patchValue({
            title: configDetail.title,
            properties: JSON.stringify(configDetail.properties ?? {}, null, 2),
          });
          this._$loading.set(false);
        },
        error: () => {
          this._$loading.set(false);
        },
      });
    } else if (definitionId) {
      this._$loading.set(true);
      this._externalPluginService.getDefinition(definitionId).subscribe({
        next: definition => {
          this._$configurationSchema.set(definition.configurationSchema);
          this._$loading.set(false);
        },
        error: () => {
          this._$loading.set(false);
        },
      });
    }

    this._form.get('properties')?.valueChanges.subscribe(value => {
      try {
        JSON.parse(value ?? '{}');
        this._$propertiesInvalid.set(false);
      } catch {
        this._$propertiesInvalid.set(true);
      }
    });
  }

  private _resetForm(): void {
    this._form.reset({title: '', properties: '{}'});
    this._$propertiesInvalid.set(false);
    this._$configurationSchema.set(null);
  }
}
