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
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  Inject,
  OnDestroy,
  OnInit,
  Optional,
  signal,
} from '@angular/core';
import {AbstractControl, FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {InputLabelModule, MdiIconSelectorComponent} from '@valtimo/components';
import {
  ComboBoxModule,
  DropdownModule,
  InputModule,
  LayerModule,
  ListItem,
} from 'carbon-components-angular';
import {Subscription} from 'rxjs';
import {
  EXTERNAL_PLUGIN_WIDGET_CONFIG_TOKEN,
  ExternalPluginWidgetConfigOption,
  ExternalPluginWidgetConfigProvider,
} from '../../../../constants';
import {WidgetExternalPluginContent} from '../../../../models';
import {WidgetWizardService} from '../../../../services';

@Component({
  templateUrl: './widget-management-external-plugin.component.html',
  styleUrls: ['./widget-management-external-plugin.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    InputModule,
    ReactiveFormsModule,
    ComboBoxModule,
    DropdownModule,
    LayerModule,
    MdiIconSelectorComponent,
    InputLabelModule,
  ],
})
export class WidgetManagementExternalPluginComponent implements OnInit, OnDestroy {
  public readonly form = this.fb.group({
    widgetTitle: this.fb.control(this.widgetWizardService.$widgetTitle(), Validators.required),
    widgetIcon: this.fb.control(this.widgetWizardService.$widgetIcon()),
  });

  public get widgetTitle(): AbstractControl<string | null, string | null> | null {
    return this.form.get('widgetTitle');
  }

  public get widgetIcon(): AbstractControl<string | null, string | null> | null {
    return this.form.get('widgetIcon');
  }

  public readonly $tokenAvailable = signal<boolean>(!!this.configProvider);

  public readonly $configOptions = signal<ExternalPluginWidgetConfigOption[]>([]);

  private readonly _$selectedConfigId = signal<string | null>(null);
  private readonly _$selectedBundleKey = signal<string | null>(null);

  public readonly $configItems = computed<ListItem[]>(() =>
    this.$configOptions().map(option => ({
      content: option.label,
      configId: option.configId,
      selected: option.configId === this._$selectedConfigId(),
    }))
  );

  private readonly _$selectedConfig = computed<ExternalPluginWidgetConfigOption | null>(
    () =>
      this.$configOptions().find(option => option.configId === this._$selectedConfigId()) ?? null
  );

  public readonly $showBundleSelect = computed<boolean>(
    () => (this._$selectedConfig()?.bundles.length ?? 0) > 1
  );

  public readonly $bundleItems = computed<ListItem[]>(() =>
    (this._$selectedConfig()?.bundles ?? []).map(bundle => ({
      content: bundle.title,
      bundleKey: bundle.key,
      selected: bundle.key === this._$selectedBundleKey(),
    }))
  );

  private readonly _subscriptions = new Subscription();

  constructor(
    @Optional()
    @Inject(EXTERNAL_PLUGIN_WIDGET_CONFIG_TOKEN)
    private readonly configProvider: ExternalPluginWidgetConfigProvider,
    private readonly fb: FormBuilder,
    private readonly widgetWizardService: WidgetWizardService
  ) {
    effect(() =>
      this.widgetWizardService.$widgetContentValid.set(
        !!this._$selectedConfigId() && (!this.$showBundleSelect() || !!this._$selectedBundleKey())
      )
    );
  }

  public ngOnInit(): void {
    this.openTitleSubscription();
    this.openIconSubscription();
    this.loadConfigOptions();
    this.prefill();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onConfigSelected(item: (ListItem & {configId?: string}) | null): void {
    const configId = item?.configId ?? null;
    this._$selectedConfigId.set(configId);
    this._$selectedBundleKey.set(null);

    const config = this._$selectedConfig();
    // A single-bundle configuration needs no second choice — resolve it now (a null bundle key means
    // the plugin ships one key-less bundle, which the resolver selects on its own).
    if (config && config.bundles.length === 1) {
      this._$selectedBundleKey.set(config.bundles[0].key);
    }
    this.updateContent();
  }

  public onBundleSelected(item: (ListItem & {bundleKey?: string | null}) | null): void {
    this._$selectedBundleKey.set(item?.bundleKey ?? null);
    this.updateContent();
  }

  private updateContent(): void {
    const configurationId = this._$selectedConfigId();
    if (!configurationId) {
      this.widgetWizardService.$widgetContent.set(null);
      return;
    }
    const bundleKey = this._$selectedBundleKey();
    this.widgetWizardService.$widgetContent.set({
      configurationId,
      ...(bundleKey ? {bundleKey} : {}),
    } as WidgetExternalPluginContent);
  }

  private loadConfigOptions(): void {
    if (!this.configProvider) return;
    this._subscriptions.add(
      this.configProvider.getConfigOptions().subscribe(options => this.$configOptions.set(options))
    );
  }

  private openTitleSubscription(): void {
    this._subscriptions.add(
      this.widgetTitle?.valueChanges.subscribe(title =>
        this.widgetWizardService.$widgetTitle.set(title)
      )
    );
  }

  private openIconSubscription(): void {
    this._subscriptions.add(
      this.widgetIcon?.valueChanges.subscribe(icon =>
        this.widgetWizardService.$widgetIcon.set(icon)
      )
    );
  }

  private prefill(): void {
    const content = this.widgetWizardService.$widgetContent() as WidgetExternalPluginContent | null;
    if (!content?.configurationId) return;
    this._$selectedConfigId.set(content.configurationId);
    this._$selectedBundleKey.set(content.bundleKey ?? null);
  }
}
