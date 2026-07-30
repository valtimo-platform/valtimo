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
import {ChangeDetectionStrategy, Component, Input, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {ComboBoxModule, LayerModule, ListItem, NotificationModule} from 'carbon-components-angular';
import {BehaviorSubject, forkJoin, Observable, take} from 'rxjs';
import {PluginConfiguration} from '../../models';
import {PluginManagementService} from '../../services/plugin-management.service';
import {PluginTranslationService} from '../../services/plugin-translation.service';

type PluginMappingStatus = 'available' | 'no-configurations' | 'not-installed';

interface PluginConfigurationPreview {
  pluginConfigurationId: string;
  pluginDefinitionKey: string | null;
  existsInTargetEnvironment: boolean;
}

interface PluginMappingRow {
  pluginDefinitionKey: string | null;
  pluginDefinitionTitle: string;
  sourcePluginConfigurationId: string;
  existsInTargetEnvironment: boolean;
  listItems: ListItem[];
  status: PluginMappingStatus;
}

/**
 * Lets the user point each plugin configuration referenced by an import at a configuration of this
 * environment.
 */
@Component({
  selector: 'valtimo-plugin-configuration-mapping',
  templateUrl: './plugin-configuration-mapping.component.html',
  styleUrls: ['./plugin-configuration-mapping.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    ComboBoxModule,
    LayerModule,
    NotificationModule,
  ],
})
export class PluginConfigurationMappingComponent implements OnInit {
  @Input() public pluginConfigurations: PluginConfigurationPreview[] = [];

  public readonly form: FormGroup = this.formBuilder.group({});

  public readonly rows$ = new BehaviorSubject<PluginMappingRow[]>([]);
  public readonly hasUnidentifiablePlugins$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly pluginManagementService: PluginManagementService,
    private readonly pluginTranslationService: PluginTranslationService,
    private readonly translateService: TranslateService
  ) {}

  public ngOnInit(): void {
    this.loadRows(this.pluginConfigurations);
  }

  /**
   * The mapping of every source plugin configuration to the selected target, or null when no target
   * could be selected.
   */
  public getMappings(): Record<string, string | null> {
    return this.rows$.value.reduce((mappings, row) => {
      const control = this.form.get(row.sourcePluginConfigurationId);
      return {
        ...mappings,
        [row.sourcePluginConfigurationId]:
          row.status === 'available' ? (control?.value ?? null) : null,
      };
    }, {});
  }

  public trackBySourceId(_index: number, row: PluginMappingRow): string {
    return row.sourcePluginConfigurationId;
  }

  /**
   * Works around a carbon-components-angular bug where clearing a single-select
   * cds-combo-box with itemValueKey set writes `[]` to the FormControl instead of `null`.
   */
  public onClear(sourceId: string): void {
    this.form.get(sourceId)?.setValue(null);
  }

  private loadRows(pluginConfigurations: PluginConfigurationPreview[]): void {
    const uniqueById = new Map<string, PluginConfigurationPreview>();
    pluginConfigurations.forEach(configuration => {
      if (!uniqueById.has(configuration.pluginConfigurationId)) {
        uniqueById.set(configuration.pluginConfigurationId, configuration);
      }
    });
    const allConfigurations = Array.from(uniqueById.values());

    // A configuration without a plugin definition key can only be used when its id exists here
    this.hasUnidentifiablePlugins$.next(
      allConfigurations.some(
        configuration =>
          configuration.pluginDefinitionKey === null && !configuration.existsInTargetEnvironment
      )
    );

    const mappableConfigurations = allConfigurations.filter(
      configuration => configuration.pluginDefinitionKey !== null
    );
    if (mappableConfigurations.length === 0) {
      this.rows$.next([]);
      return;
    }

    this.pluginManagementService
      .getPluginDefinitions()
      .pipe(take(1))
      .subscribe(definitions => {
        this.loadConfigurations(mappableConfigurations, new Set(definitions.map(({key}) => key)));
      });
  }

  private loadConfigurations(
    configurations: PluginConfigurationPreview[],
    installedKeys: Set<string>
  ): void {
    const installableKeys = [
      ...new Set(configurations.map(({pluginDefinitionKey}) => pluginDefinitionKey)),
    ].filter(key => !!key && installedKeys.has(key));

    if (installableKeys.length === 0) {
      this.buildRows(configurations, new Map(), installedKeys);
      return;
    }

    const requests = installableKeys.reduce(
      (accumulator, key) => ({
        ...accumulator,
        [key]: this.pluginManagementService
          .getPluginConfigurationsByPluginDefinitionKey(key)
          .pipe(take(1)),
      }),
      {} as Record<string, Observable<PluginConfiguration[]>>
    );

    forkJoin(requests)
      .pipe(take(1))
      .subscribe(results => {
        this.buildRows(configurations, new Map(Object.entries(results)), installedKeys);
      });
  }

  private buildRows(
    configurations: PluginConfigurationPreview[],
    configurationsByKey: Map<string, PluginConfiguration[]>,
    installedKeys: Set<string>
  ): void {
    this.clearForm();

    const rows: PluginMappingRow[] = configurations.map(configuration => {
      const key = configuration.pluginDefinitionKey;
      const available = (key && configurationsByKey.get(key)) || [];
      const defaultSelectionId = configuration.existsInTargetEnvironment
        ? configuration.pluginConfigurationId
        : null;

      let status: PluginMappingStatus;
      if (!key || !installedKeys.has(key)) {
        status = 'not-installed';
      } else if (available.length === 0) {
        status = 'no-configurations';
      } else {
        status = 'available';
      }

      if (status === 'available') {
        this.form.addControl(
          configuration.pluginConfigurationId,
          this.formBuilder.control(defaultSelectionId)
        );
      }

      return {
        pluginDefinitionKey: key,
        pluginDefinitionTitle: this.getPluginTitle(key),
        sourcePluginConfigurationId: configuration.pluginConfigurationId,
        existsInTargetEnvironment: configuration.existsInTargetEnvironment,
        listItems: available.map(({title, id}) => ({
          content: title,
          id,
          selected: id === defaultSelectionId,
        })),
        status,
      };
    });

    this.rows$.next(rows);
  }

  private clearForm(): void {
    Object.keys(this.form.controls).forEach(key => this.form.removeControl(key));
  }

  private getPluginTitle(pluginDefinitionKey: string | null): string {
    if (!pluginDefinitionKey) {
      return this.translateService.instant('pluginConfigurationMapping.unknownPlugin');
    }

    const translated = this.pluginTranslationService.instant('title', pluginDefinitionKey);
    // The translation service falls back to "<key>.title" when there is no translation
    return translated === `${pluginDefinitionKey}.title` ? pluginDefinitionKey : translated;
  }
}
