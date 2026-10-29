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
  NotificationModule,
  ProgressIndicatorModule,
} from 'carbon-components-angular';
import {CARBON_CONSTANTS, ValtimoCdsModalDirective} from '@valtimo/components';
import {
  ExternalPluginDefinition,
  ExternalPluginIframeComponent,
  ExternalPluginEndpoint,
  ExternalPluginService,
  getExternalPluginDisplayName,
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
    NotificationModule,
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

  public readonly $loading = signal(false);
  public readonly $propertiesInvalid = signal(false);
  public readonly $configBundleUrl = signal<string | null>(null);
  public readonly $prefillConfiguration = signal<{
    title: string;
    configuration: Record<string, unknown>;
  } | null>(null);

  public readonly $endpoints = signal<Array<ExternalPluginEndpoint>>([]);
  public readonly $eventSubscriptions = signal<Array<string>>([]);
  public readonly $capabilities = signal<Array<string>>([]);
  public readonly $egress = signal<Array<string>>([]);
  /**
   * Destinations derived from this configuration's own `x-egress-target` values. Taken from the saved
   * configuration rather than recomputed locally, so the list matches what GZAC pushed to the host.
   */
  public readonly $derivedEgress = signal<Array<string>>([]);
  public readonly $permissionsValid = signal(false);
  public readonly $hasPermissionsStep = signal(false);
  public readonly $definitionName = signal<string>('');
  public readonly $awaitingHost = signal(false);

  public currentStepIndex = 0;
  public progressSteps: Array<{label: string; complete: boolean}> = [];

  private _iframeConfigTitle: string = '';
  private _iframeConfigData: Record<string, unknown> | null = null;
  private readonly _$configurationSchema = signal<unknown | null>(null);
  private readonly _$iframeValid = signal(false);
  private readonly _$definition = signal<ExternalPluginDefinition | null>(null);

  private readonly _subscriptions = new Subscription();
  private _propertiesValueSubscription: Subscription | null = null;

  constructor(
    private readonly _externalPluginService: ExternalPluginService,
    private readonly _translateService: TranslateService
  ) {
    this._buildProgressSteps();
    this._subscriptions.add(
      this._translateService.onLangChange.subscribe(() => {
        this._buildProgressSteps();
        this._updateDefinitionName();
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this._propertiesValueSubscription?.unsubscribe();
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

    if (this.$configBundleUrl()) {
      this._saveFromIframe();
      return;
    }

    if (this._form.invalid || this.$propertiesInvalid()) return;

    let properties: Record<string, unknown>;
    try {
      properties = JSON.parse(this._form.value.properties ?? '{}');
    } catch {
      this.$propertiesInvalid.set(true);
      return;
    }

    this.$loading.set(true);

    // Permissions are accepted at activation and are immutable afterwards, so they are not sent
    // on update — the backend leaves the granted endpoints unchanged when they are omitted.
    this._externalPluginService
      .updateConfiguration(this.configuration.id, {
        title: this._form.value.title ?? '',
        properties,
      })
      .subscribe({
        next: () => {
          this.$loading.set(false);
          this.savedEvent.emit();
        },
        error: () => {
          this.$loading.set(false);
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
    this.$permissionsValid.set(valid);
  }

  public get configValid(): boolean {
    if (this.$awaitingHost()) return false;
    if (this.$configBundleUrl()) {
      return this._$iframeValid();
    }
    return this._form.valid && !this.$propertiesInvalid();
  }

  private _saveFromIframe(): void {
    if (!this.configuration?.id) return;

    const prefill = this.$prefillConfiguration();
    const title = this._iframeConfigTitle || prefill?.title || this.configuration.title;
    const properties = this._iframeConfigData ?? prefill?.configuration ?? {};

    this.$loading.set(true);

    this._externalPluginService
      .updateConfiguration(this.configuration.id, {
        title,
        properties,
      })
      .subscribe({
        next: () => {
          this.$loading.set(false);
          this.savedEvent.emit();
        },
        error: () => {
          this.$loading.set(false);
        },
      });
  }

  private _initForm(): void {
    this.currentStepIndex = 0;
    this._form.reset({
      title: this.configuration?.title ?? '',
      properties: '{}',
    });
    this.$propertiesInvalid.set(false);
    this._$configurationSchema.set(null);
    this.$configBundleUrl.set(null);
    this.$prefillConfiguration.set(null);
    this._$iframeValid.set(false);
    this._iframeConfigTitle = '';
    this._iframeConfigData = null;
    this.$endpoints.set([]);
    this.$eventSubscriptions.set([]);
    this.$capabilities.set([]);
    this.$egress.set([]);
    this.$derivedEgress.set([]);
    this.$permissionsValid.set(false);
    this.$hasPermissionsStep.set(false);
    this._$definition.set(null);
    this.$definitionName.set('');
    this.$awaitingHost.set(false);

    const configId = this.configuration?.id;
    const definitionId = this.configuration?.externalDefinitionId;

    if (configId && definitionId) {
      this.$loading.set(true);
      forkJoin([
        this._externalPluginService.getConfiguration(configId),
        this._externalPluginService.getDefinition(definitionId),
      ]).subscribe({
        next: ([configDetail, definition]) => {
          this._setDefinition(definition);
          this._$configurationSchema.set(definition.configurationSchema);
          this._resolveConfigBundleUrl(definition);

          if (this.$configBundleUrl()) {
            this.$prefillConfiguration.set({
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
          const capabilities = definition.manifest?.permissions?.capabilities ?? [];
          // Egress comes off the configuration, not the manifest: the manifest-declared grants are
          // what was accepted at activation, and the derived ones follow the values actually stored.
          const egress = configDetail.grantedEgress?.map(entry => entry.target) ?? [];
          const derivedEgress = configDetail.derivedEgress ?? [];
          this.$endpoints.set(endpoints);
          this.$eventSubscriptions.set(eventSubscriptions);
          this.$capabilities.set(capabilities);
          this.$egress.set(egress);
          this.$derivedEgress.set(derivedEgress);
          this.$hasPermissionsStep.set(
            endpoints.length > 0 ||
              eventSubscriptions.length > 0 ||
              capabilities.length > 0 ||
              egress.length > 0 ||
              derivedEgress.length > 0
          );
          this.$permissionsValid.set(true);

          this._buildProgressSteps();
          this.$loading.set(false);
        },
        error: () => {
          this.$loading.set(false);
        },
      });
    } else if (definitionId) {
      this.$loading.set(true);
      this._externalPluginService.getDefinition(definitionId).subscribe({
        next: definition => {
          this._setDefinition(definition);
          this._$configurationSchema.set(definition.configurationSchema);
          this._resolveConfigBundleUrl(definition);

          const endpoints = definition.manifest?.permissions?.endpoints ?? [];
          const eventSubscriptions = definition.manifest?.eventSubscriptions ?? [];
          const capabilities = definition.manifest?.permissions?.capabilities ?? [];
          const egress = definition.manifest?.permissions?.egress ?? [];
          this.$endpoints.set(endpoints);
          this.$eventSubscriptions.set(eventSubscriptions);
          this.$capabilities.set(capabilities);
          this.$egress.set(egress);
          this.$hasPermissionsStep.set(
            endpoints.length > 0 ||
              eventSubscriptions.length > 0 ||
              capabilities.length > 0 ||
              egress.length > 0
          );
          this.$permissionsValid.set(true);

          this._buildProgressSteps();
          this.$loading.set(false);
        },
        error: () => {
          this.$loading.set(false);
        },
      });
    } else {
      this._buildProgressSteps();
    }

    // `_initForm` runs on every modal open: tear down the previous subscription first so they do
    // not accumulate over repeated opens.
    this._propertiesValueSubscription?.unsubscribe();
    this._propertiesValueSubscription =
      this._form.get('properties')?.valueChanges.subscribe(value => {
        try {
          JSON.parse(value ?? '{}');
          this.$propertiesInvalid.set(false);
        } catch {
          this.$propertiesInvalid.set(true);
        }
      }) ?? null;
  }

  private _setDefinition(definition: ExternalPluginDefinition): void {
    this._$definition.set(definition);
    this.$awaitingHost.set(definition.awaitingDiscovery);
    this._updateDefinitionName();
  }

  private _updateDefinitionName(): void {
    const definition = this._$definition();
    this.$definitionName.set(
      definition ? getExternalPluginDisplayName(definition, this._translateService.currentLang) : ''
    );
  }

  private _resolveConfigBundleUrl(definition: ExternalPluginDefinition): void {
    const configBundle = definition.manifest?.frontendBundles?.find(b => b.type === 'config');
    if (configBundle) {
      this.$configBundleUrl.set(`${definition.baseUrl}/${definition.version}${configBundle.path}`);
    }
  }

  /**
   * Carbon's progress indicator recomputes step completion only inside its `current` setter, so a
   * rebuilt steps array (language change, permissions step appearing) must carry the `complete`
   * flags itself — with an unchanged current step the rebuild would otherwise wipe the checkmarks.
   */
  private _buildProgressSteps(): void {
    const labels = [this._translateService.instant('pluginManagement.editSteps.step0')];

    if (this.$hasPermissionsStep()) {
      labels.push(this._translateService.instant('pluginManagement.editSteps.step1'));
    }

    this.progressSteps = labels.map((label, index) => ({
      label,
      complete: index < this.currentStepIndex,
    }));
  }

  private _resetForm(): void {
    this.currentStepIndex = 0;
    this._form.reset({title: '', properties: '{}'});
    this.$propertiesInvalid.set(false);
    this._$configurationSchema.set(null);
    this.$configBundleUrl.set(null);
    this.$prefillConfiguration.set(null);
    this._$iframeValid.set(false);
    this._iframeConfigTitle = '';
    this._iframeConfigData = null;
    this.$endpoints.set([]);
    this.$eventSubscriptions.set([]);
    this.$capabilities.set([]);
    this.$permissionsValid.set(false);
    this.$hasPermissionsStep.set(false);
    this._$definition.set(null);
    this.$definitionName.set('');
    this.$awaitingHost.set(false);
    this._buildProgressSteps();
  }
}
