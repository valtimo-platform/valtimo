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
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  DropdownModule,
  ListItem,
  LoadingModule,
  NotificationModule,
} from 'carbon-components-angular';
import {forkJoin, Observable, of, Subscription} from 'rxjs';
import {catchError, map, switchMap} from 'rxjs/operators';
import {
  ExternalPluginContractBindingEntry,
  ExternalPluginContractBindingResponse,
  ExternalPluginContractProvider,
  ExternalPluginDefinition,
  ExternalPluginService,
  getExternalPluginProvidedContracts,
} from '@valtimo/plugin';
import {PLUGIN_EXTERNAL_CONTRACT_BINDINGS_TEST_IDS} from '../../constants';

interface ContractProviderListItem extends ListItem {
  configurationId: string;
}

interface ContractBindingRow {
  contract: string;
  /** Localised title from a provider's manifest; null when no provider names it. */
  title: string | null;
  providers: Array<ExternalPluginContractProvider>;
  items: Array<ContractProviderListItem>;
  selectedConfigurationId: string | null;
}

/**
 * The "Required plugins" section: one dropdown per contract the plugin declares in
 * `permissions.contracts`, listing every configuration (across all integrations) that provides it.
 * Pre-selects the current binding, else the only provider when there is exactly one. Valid once
 * every declared contract is bound — the backend requires an exact match.
 */
@Component({
  standalone: true,
  selector: 'valtimo-plugin-external-contract-bindings',
  templateUrl: './plugin-external-contract-bindings.component.html',
  styleUrls: ['./plugin-external-contract-bindings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, DropdownModule, LoadingModule, NotificationModule],
})
export class PluginExternalContractBindingsComponent implements OnChanges {
  @Input() public contracts: Array<string> = [];
  @Input() public currentBindings: Array<ExternalPluginContractBindingResponse> = [];
  /** The configuration being edited; never offered as its own provider. */
  @Input() public selfConfigurationId: string | null = null;

  @Output() public bindingsChangeEvent = new EventEmitter<
    Array<ExternalPluginContractBindingEntry>
  >();
  @Output() public validEvent = new EventEmitter<boolean>();

  public readonly $loading = signal(false);
  public readonly $rows = signal<Array<ContractBindingRow>>([]);

  protected readonly testIds = PLUGIN_EXTERNAL_CONTRACT_BINDINGS_TEST_IDS;

  private _loadSubscription: Subscription | null = null;

  constructor(
    private readonly _externalPluginService: ExternalPluginService,
    private readonly _translateService: TranslateService
  ) {}

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['contracts'] || changes['currentBindings'] || changes['selfConfigurationId']) {
      this._load();
    }
  }

  public onProviderSelected(contract: string, event: {item?: ContractProviderListItem}): void {
    const configurationId = event?.item?.configurationId ?? null;
    this.$rows.update(rows =>
      rows.map(row =>
        row.contract === contract ? {...row, selectedConfigurationId: configurationId} : row
      )
    );
    this._emit();
  }

  public trackByContract(_index: number, row: ContractBindingRow): string {
    return row.contract;
  }

  private _load(): void {
    this._loadSubscription?.unsubscribe();
    const contracts = [...new Set(this.contracts ?? [])];

    if (contracts.length === 0) {
      this.$loading.set(false);
      this.$rows.set([]);
      this._emit();
      return;
    }

    this.$loading.set(true);
    this.validEvent.emit(false);

    const requests: Array<Observable<Array<ExternalPluginContractProvider>>> = contracts.map(
      contract =>
        this._externalPluginService
          .getContractProviders(contract)
          .pipe(catchError(() => of([] as Array<ExternalPluginContractProvider>)))
    );

    this._loadSubscription = forkJoin(requests)
      .pipe(
        switchMap(providerLists =>
          this._contractTitles(contracts, providerLists).pipe(
            map(titles => ({providerLists, titles}))
          )
        )
      )
      .subscribe(({providerLists, titles}) => {
        this.$rows.set(
          contracts.map((contract, index) =>
            this._buildRow(contract, providerLists[index] ?? [], titles[index])
          )
        );
        this.$loading.set(false);
        this._emit();
      });
  }

  /** Contract titles live in the providers' manifests, which the providers list lacks. */
  private _contractTitles(
    contracts: Array<string>,
    providerLists: Array<Array<ExternalPluginContractProvider>>
  ): Observable<Array<string | null>> {
    const definitionIds = [...new Set(providerLists.flat().map(provider => provider.definitionId))];
    if (definitionIds.length === 0) return of(contracts.map(() => null));

    return forkJoin(
      definitionIds.map(id =>
        this._externalPluginService
          .getDefinition(id)
          .pipe(catchError(() => of(null as ExternalPluginDefinition | null)))
      )
    ).pipe(
      map(definitions => {
        const lang = this._translateService.currentLang;
        const titleByContract = new Map<string, string>();
        definitions.forEach(definition =>
          getExternalPluginProvidedContracts(definition?.manifest, lang).forEach(provided => {
            if (provided.title && !titleByContract.has(provided.contract)) {
              titleByContract.set(provided.contract, provided.title);
            }
          })
        );
        return contracts.map(contract => titleByContract.get(contract) ?? null);
      })
    );
  }

  private _buildRow(
    contract: string,
    allProviders: Array<ExternalPluginContractProvider>,
    title: string | null
  ): ContractBindingRow {
    const providers = allProviders.filter(p => p.configurationId !== this.selfConfigurationId);
    const current = (this.currentBindings ?? []).find(binding => binding.contract === contract);
    const items: Array<ContractProviderListItem> = providers.map(provider => ({
      content: this._providerLabel(provider),
      configurationId: provider.configurationId,
      selected: false,
    }));

    // Keep an existing binding selectable even when its target no longer lists as a provider
    if (current && !providers.some(p => p.configurationId === current.targetConfigurationId)) {
      items.unshift({
        content: current.targetConfigurationTitle ?? current.targetConfigurationId,
        configurationId: current.targetConfigurationId,
        selected: false,
      });
    }

    const selectedConfigurationId =
      current?.targetConfigurationId ??
      (providers.length === 1 ? providers[0].configurationId : null);

    return {
      contract,
      title,
      providers,
      items: items.map(item => ({
        ...item,
        selected: item.configurationId === selectedConfigurationId,
      })),
      selectedConfigurationId,
    };
  }

  private _providerLabel(provider: ExternalPluginContractProvider): string {
    const label = `${provider.configurationTitle} — ${provider.pluginId}@${provider.version} · ${provider.hostName}`;
    return provider.available
      ? label
      : `${label} (${this._translateService.instant('pluginManagement.contracts.unavailable')})`;
  }

  private _emit(): void {
    const rows = this.$rows();
    const bindings = rows
      .filter(row => !!row.selectedConfigurationId)
      .map(row => ({contract: row.contract, targetConfigurationId: row.selectedConfigurationId!}));
    this.bindingsChangeEvent.emit(bindings);
    this.validEvent.emit(!this.$loading() && bindings.length === rows.length);
  }
}
