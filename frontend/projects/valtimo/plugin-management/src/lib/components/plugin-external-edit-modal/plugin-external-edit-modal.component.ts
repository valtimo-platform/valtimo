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
import {HttpErrorResponse} from '@angular/common/http';
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
  ExternalPluginConfigurationUpdateRequest,
  ExternalPluginContractBindingEntry,
  ExternalPluginContractBindingResponse,
  ExternalPluginDeclaredContract,
  ExternalPluginDefinition,
  ExternalPluginIframeComponent,
  ExternalPluginEndpoint,
  ExternalPluginProvidedContract,
  ExternalPluginService,
  getExternalPluginDeclaredContracts,
  getExternalPluginDisplayName,
  getExternalPluginProvidedContracts,
} from '@valtimo/plugin';
import {PluginExternalPropertiesEditorComponent} from '../plugin-external-properties-editor/plugin-external-properties-editor.component';
import {UnifiedPluginConfigurationRow} from '../../models';
import {forkJoin, Subscription} from 'rxjs';
import {PluginExternalPermissionsComponent} from '../plugin-external-permissions/plugin-external-permissions.component';
import {PluginExternalContractBindingsComponent} from '../plugin-external-contract-bindings/plugin-external-contract-bindings.component';
import {PluginExternalProvidedContractsComponent} from '../plugin-external-provided-contracts/plugin-external-provided-contracts.component';
import {PLUGIN_EXTERNAL_EDIT_MODAL_TEST_IDS} from '../../constants';
import {externalPluginErrorDetail} from '../../utils';

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
    PluginExternalContractBindingsComponent,
    PluginExternalPropertiesEditorComponent,
    PluginExternalProvidedContractsComponent,
  ],
})
export class PluginExternalEditModalComponent implements OnChanges, OnDestroy {
  @Input() public open = false;
  @Input() public configuration: UnifiedPluginConfigurationRow | null = null;

  @Output() public closeEvent = new EventEmitter<void>();
  @Output() public savedEvent = new EventEmitter<void>();
  @Output() public deleteEvent = new EventEmitter<string>();

  public currentStepIndex = 0;
  public progressSteps: Array<{label: string; complete: boolean}> = [];

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
  public readonly $declaredContracts = signal<Array<ExternalPluginDeclaredContract>>([]);
  public readonly $providedContracts = signal<Array<ExternalPluginProvidedContract>>([]);
  public readonly $currentBindings = signal<Array<ExternalPluginContractBindingResponse>>([]);
  public readonly $contractBindingsValid = signal(true);
  public readonly $permissionsValid = signal(false);
  /** Only for permission content or declared contracts; provided contracts alone add no step. */
  public readonly $hasPermissionsStep = signal(false);
  public readonly $definitionName = signal<string>('');
  public readonly $awaitingHost = signal(false);
  /** Why GZAC refused the last save, e.g. contract bindings that would form a cycle. */
  public readonly $saveError = signal<string | null>(null);

  protected readonly testIds = PLUGIN_EXTERNAL_EDIT_MODAL_TEST_IDS;

  private _iframeConfigTitle: string = '';
  private _iframeConfigData: Record<string, unknown> | null = null;
  private _contractBindings: Array<ExternalPluginContractBindingEntry> = [];
  private _propertiesValueSubscription: Subscription | null = null;

  private readonly _$configurationSchema = signal<unknown | null>(null);
  public readonly $configurationSchema = this._$configurationSchema.asReadonly();
  private readonly _$iframeValid = signal(false);
  private readonly _$definition = signal<ExternalPluginDefinition | null>(null);
  private readonly _subscriptions = new Subscription();

  public get configValid(): boolean {
    if (this.$awaitingHost()) return false;
    if (this.$configBundleUrl()) {
      return this._$iframeValid();
    }
    return this._form.valid && !this.$propertiesInvalid();
  }

  public get canSave(): boolean {
    if (this.$loading() || !this.configValid) return false;
    if (!this.$hasPermissionsStep()) return true;
    return this.$permissionsValid() && this.$contractBindingsValid();
  }

  constructor(
    private readonly _externalPluginService: ExternalPluginService,
    private readonly _translateService: TranslateService
  ) {
    this._buildProgressSteps();
    this._subscriptions.add(
      this._translateService.onLangChange.subscribe(() => {
        this._buildProgressSteps();
        this._updateDefinitionName();
        this._updateProvidedContracts();
      })
    );
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open && this.configuration) {
      this._initForm();
    }
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this._propertiesValueSubscription?.unsubscribe();
  }

  public goToNextStep(): void {
    if (!this.configValid) return;
    if (this.currentStepIndex < this.progressSteps.length - 1) {
      this.currentStepIndex++;
    }
  }

  public onSave(): void {
    if (!this.configuration?.id || !this.canSave) return;

    if (this.$configBundleUrl()) {
      this._saveFromIframe();
      return;
    }

    let properties: Record<string, unknown>;
    try {
      properties = JSON.parse(this._form.value.properties ?? '{}');
    } catch {
      this.$propertiesInvalid.set(true);
      return;
    }

    // Permissions are accepted at activation and are immutable afterwards, so they are not sent
    // on update — the backend leaves the granted endpoints unchanged when they are omitted.
    this._update({
      title: this._form.value.title ?? '',
      properties,
      ...this._changedContractBindings(),
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

  public onContractBindingsChange(bindings: Array<ExternalPluginContractBindingEntry>): void {
    this._contractBindings = bindings;
  }

  public onContractBindingsValid(valid: boolean): void {
    this.$contractBindingsValid.set(valid);
  }

  private _saveFromIframe(): void {
    if (!this.configuration?.id || !this._$iframeValid()) return;

    const prefill = this.$prefillConfiguration();
    this._update({
      title: this._iframeConfigTitle || prefill?.title || this.configuration.title,
      properties: this._iframeConfigData ?? prefill?.configuration ?? {},
      ...this._changedContractBindings(),
    });
  }

  private _update(request: ExternalPluginConfigurationUpdateRequest): void {
    if (!this.configuration?.id) return;

    this.$loading.set(true);
    this.$saveError.set(null);

    this._externalPluginService.updateConfiguration(this.configuration.id, request).subscribe({
      next: () => {
        this.$loading.set(false);
        this.savedEvent.emit();
      },
      error: (response: HttpErrorResponse) => {
        this.$loading.set(false);
        // Other statuses reach the admin through the global error toast
        if (response?.status === 400 || response?.status === 409) {
          this.$saveError.set(
            externalPluginErrorDetail(response) ??
              this._translateService.instant('pluginManagement.saveRejected')
          );
        }
      },
    });
  }

  /** Rebinding is the only grant-adjacent change the edit flow sends; absent means unchanged. */
  private _changedContractBindings(): {
    contractBindings?: Array<ExternalPluginContractBindingEntry>;
  } {
    const current = new Map(
      this.$currentBindings().map(binding => [binding.contract, binding.targetConfigurationId])
    );
    const changed =
      this._contractBindings.length !== current.size ||
      this._contractBindings.some(
        binding => current.get(binding.contract) !== binding.targetConfigurationId
      );
    return changed && this.$declaredContracts().length > 0
      ? {contractBindings: this._contractBindings}
      : {};
  }

  private _applyContracts(
    definition: ExternalPluginDefinition,
    currentBindings: Array<ExternalPluginContractBindingResponse>
  ): void {
    const declaredContracts = getExternalPluginDeclaredContracts(definition.manifest);
    this.$currentBindings.set(currentBindings);
    this._contractBindings = currentBindings.map(({contract, targetConfigurationId}) => ({
      contract,
      targetConfigurationId,
    }));
    this.$contractBindingsValid.set(declaredContracts.length === 0);
    this.$declaredContracts.set(declaredContracts);
    this._updateProvidedContracts();
  }

  private _initForm(): void {
    this.currentStepIndex = 0;
    this._form.reset({
      title: this.configuration?.title ?? '',
      properties: '{}',
    });
    this._resetState();

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

          // Egress comes off the configuration, not the manifest: the manifest-declared grants are
          // what was accepted at activation, and the derived ones follow the values actually stored.
          this._applyPermissions(
            definition,
            configDetail.grantedEgress?.map(entry => entry.target) ?? [],
            configDetail.derivedEgress ?? []
          );
          this._applyContracts(definition, configDetail.contractBindings ?? []);
          this._finishLoading();
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
          this._applyPermissions(definition, definition.manifest?.permissions?.egress ?? [], []);
          this._applyContracts(definition, []);
          this._finishLoading();
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

  private _applyPermissions(
    definition: ExternalPluginDefinition,
    egress: Array<string>,
    derivedEgress: Array<string>
  ): void {
    this.$endpoints.set(definition.manifest?.permissions?.endpoints ?? []);
    this.$eventSubscriptions.set(definition.manifest?.eventSubscriptions ?? []);
    this.$capabilities.set(definition.manifest?.permissions?.capabilities ?? []);
    this.$egress.set(egress);
    this.$derivedEgress.set(derivedEgress);
  }

  private _finishLoading(): void {
    this.$hasPermissionsStep.set(
      this.$endpoints().length > 0 ||
        this.$eventSubscriptions().length > 0 ||
        this.$capabilities().length > 0 ||
        this.$egress().length > 0 ||
        this.$derivedEgress().length > 0 ||
        this.$declaredContracts().length > 0
    );
    this.$permissionsValid.set(true);
    this._buildProgressSteps();
    this.$loading.set(false);
  }

  private _updateProvidedContracts(): void {
    this.$providedContracts.set(
      getExternalPluginProvidedContracts(
        this._$definition()?.manifest,
        this._translateService.currentLang
      )
    );
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
    this._resetState();
    this._buildProgressSteps();
  }

  private _resetState(): void {
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
    this.$declaredContracts.set([]);
    this.$providedContracts.set([]);
    this.$currentBindings.set([]);
    this.$contractBindingsValid.set(true);
    this._contractBindings = [];
    this.$permissionsValid.set(false);
    this.$hasPermissionsStep.set(false);
    this._$definition.set(null);
    this.$definitionName.set('');
    this.$awaitingHost.set(false);
    this.$saveError.set(null);
  }
}
