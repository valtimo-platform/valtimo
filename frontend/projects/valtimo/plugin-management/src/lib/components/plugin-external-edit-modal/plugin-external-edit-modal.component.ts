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
  OnDestroy,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {
  ButtonModule,
  LoadingModule,
  ModalModule,
  ProgressIndicatorModule,
} from 'carbon-components-angular';
import {CARBON_CONSTANTS, ValtimoCdsModalDirective} from '@valtimo/components';
import {
  ExternalPluginDefinition,
  ExternalPluginIframeComponent,
  ExternalPluginEndpoint,
  ExternalPluginService,
} from '@valtimo/plugin';
import {UnifiedPluginConfigurationRow} from '../../models';
import {forkJoin, Subscription} from 'rxjs';
import {PluginExternalPermissionsComponent} from '../plugin-external-permissions/plugin-external-permissions.component';

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
    ProgressIndicatorModule,
    ValtimoCdsModalDirective,
    ExternalPluginIframeComponent,
    PluginExternalPermissionsComponent,
  ],
})
export class PluginExternalEditModalComponent implements OnChanges, OnDestroy {
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
  public readonly _$configBundleUrl = signal<string | null>(null);
  public readonly _$prefillConfiguration = signal<{
    title: string;
    configuration: Record<string, unknown>;
  } | null>(null);
  public readonly _$iframeValid = signal(false);

  public readonly _$endpoints = signal<Array<ExternalPluginEndpoint>>([]);
  public readonly _$eventSubscriptions = signal<Array<string>>([]);
  public readonly _$permissionsValid = signal(false);
  public readonly _$hasPermissionsStep = signal(false);
  public readonly _$definitionName = signal<string>('');

  public currentStepIndex = 0;
  public progressSteps: Array<{label: string}> = [];

  private _iframeConfigTitle: string = '';
  private _iframeConfigData: Record<string, unknown> | null = null;

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly _externalPluginService: ExternalPluginService,
    private readonly _translateService: TranslateService
  ) {
    this._buildProgressSteps();
    this._subscriptions.add(
      this._translateService.onLangChange.subscribe(() => this._buildProgressSteps())
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open && this.configuration) {
      this._initForm();
    }
  }

  public goToNextStep(): void {
    if (this.currentStepIndex < this.progressSteps.length - 1) {
      this.currentStepIndex++;
    }
  }

  public onSave(): void {
    if (!this.configuration?.id) return;

    if (this._$configBundleUrl()) {
      this._saveFromIframe();
      return;
    }

    if (this._form.invalid || this._$propertiesInvalid()) return;

    let properties: Record<string, unknown>;
    try {
      properties = JSON.parse(this._form.value.properties ?? '{}');
    } catch {
      this._$propertiesInvalid.set(true);
      return;
    }

    this._$loading.set(true);

    // Permissions are accepted at activation and are immutable afterwards, so they are not sent
    // on update — the backend leaves the granted endpoints unchanged when they are omitted.
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
    setTimeout(() => {
      this._resetForm();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }

  public onIframeConfigurationChanged(event: {
    valid: boolean;
    title: string;
    data: Record<string, unknown>;
  }): void {
    this._iframeConfigTitle = event.title;
    this._iframeConfigData = event.data;
    this._$iframeValid.set(event.valid);
  }

  public onPermissionsValid(valid: boolean): void {
    this._$permissionsValid.set(valid);
  }

  public get configValid(): boolean {
    if (this._$configBundleUrl()) {
      return this._$iframeValid();
    }
    return this._form.valid && !this._$propertiesInvalid();
  }

  private _saveFromIframe(): void {
    if (!this.configuration?.id) return;

    const prefill = this._$prefillConfiguration();
    const title = this._iframeConfigTitle || prefill?.title || this.configuration.title;
    const properties = this._iframeConfigData ?? prefill?.configuration ?? {};

    this._$loading.set(true);

    this._externalPluginService
      .updateConfiguration(this.configuration.id, {
        title,
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

  private _initForm(): void {
    this.currentStepIndex = 0;
    this._form.reset({
      title: this.configuration?.title ?? '',
      properties: '{}',
    });
    this._$propertiesInvalid.set(false);
    this._$configurationSchema.set(null);
    this._$configBundleUrl.set(null);
    this._$prefillConfiguration.set(null);
    this._$iframeValid.set(false);
    this._iframeConfigData = null;
    this._$endpoints.set([]);
    this._$eventSubscriptions.set([]);
    this._$permissionsValid.set(false);
    this._$hasPermissionsStep.set(false);
    this._$definitionName.set('');

    const configId = this.configuration?.id;
    const definitionId = this.configuration?.externalDefinitionId;

    if (configId && definitionId) {
      this._$loading.set(true);
      forkJoin([
        this._externalPluginService.getConfiguration(configId),
        this._externalPluginService.getDefinition(definitionId),
      ]).subscribe({
        next: ([configDetail, definition]) => {
          this._$definitionName.set(definition.name ?? definition.pluginId);
          this._$configurationSchema.set(definition.configurationSchema);
          this._resolveConfigBundleUrl(definition);

          if (this._$configBundleUrl()) {
            this._$prefillConfiguration.set({
              title: configDetail.title,
              configuration: configDetail.properties ?? {},
            });
          } else {
            this._form.patchValue({
              title: configDetail.title,
              properties: JSON.stringify(configDetail.properties ?? {}, null, 2),
            });
          }

          const endpoints = definition.manifest?.permissions?.endpoints ?? [];
          const eventSubscriptions = definition.manifest?.eventSubscriptions ?? [];
          this._$endpoints.set(endpoints);
          this._$eventSubscriptions.set(eventSubscriptions);
          this._$hasPermissionsStep.set(endpoints.length > 0 || eventSubscriptions.length > 0);
          // Permissions are read-only when editing, so the step never blocks saving.
          this._$permissionsValid.set(true);

          this._buildProgressSteps();
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
          this._$definitionName.set(definition.name ?? definition.pluginId);
          this._$configurationSchema.set(definition.configurationSchema);
          this._resolveConfigBundleUrl(definition);

          const endpoints = definition.manifest?.permissions?.endpoints ?? [];
          const eventSubscriptions = definition.manifest?.eventSubscriptions ?? [];
          this._$endpoints.set(endpoints);
          this._$eventSubscriptions.set(eventSubscriptions);
          this._$hasPermissionsStep.set(endpoints.length > 0 || eventSubscriptions.length > 0);
          this._$permissionsValid.set(true);

          this._buildProgressSteps();
          this._$loading.set(false);
        },
        error: () => {
          this._$loading.set(false);
        },
      });
    } else {
      this._buildProgressSteps();
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

  private _resolveConfigBundleUrl(definition: ExternalPluginDefinition): void {
    const configBundle = definition.manifest?.frontendBundles?.find(b => b.type === 'config');
    if (configBundle) {
      this._$configBundleUrl.set(
        `${definition.baseUrl}/${definition.version}${configBundle.path}`
      );
    }
  }

  private _buildProgressSteps(): void {
    const steps = [
      {label: this._translateService.instant('pluginManagement.editSteps.step0')},
    ];

    if (this._$hasPermissionsStep()) {
      steps.push({
        label: this._translateService.instant('pluginManagement.editSteps.step1'),
      });
    }

    this.progressSteps = steps;
  }

  private _resetForm(): void {
    this.currentStepIndex = 0;
    this._form.reset({title: '', properties: '{}'});
    this._$propertiesInvalid.set(false);
    this._$configurationSchema.set(null);
    this._$configBundleUrl.set(null);
    this._$prefillConfiguration.set(null);
    this._$iframeValid.set(false);
    this._iframeConfigData = null;
    this._$endpoints.set([]);
    this._$eventSubscriptions.set([]);
    this._$permissionsValid.set(false);
    this._$hasPermissionsStep.set(false);
    this._$definitionName.set('');
    this._buildProgressSteps();
  }
}
