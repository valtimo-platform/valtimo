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
  computed,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {CommonModule} from '@angular/common';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  ButtonModule,
  DropdownModule,
  ListItem,
  LoadingModule,
  NotificationModule,
} from 'carbon-components-angular';
import {Observable, of, Subject} from 'rxjs';
import {catchError, map, mergeMap} from 'rxjs/operators';
import {
  ExternalPluginContractBindingEntry,
  ExternalPluginContractBindingResponse,
  ExternalPluginContractProvider,
  ExternalPluginDeclaredContract,
  ExternalPluginService,
  getExternalPluginContractTitle,
} from '@valtimo/plugin';
import {PLUGIN_EXTERNAL_CONTRACT_BINDINGS_TEST_IDS} from '../../constants';

type ProviderLookup =
  | {state: 'loading'}
  | {state: 'error'}
  | {state: 'ready'; providers: Array<ExternalPluginContractProvider>};

interface ProviderLookupRequest {
  generation: number;
  contract: string;
}

interface ProviderLookupResult extends ProviderLookupRequest {
  lookup: ProviderLookup;
}

/** A null target leaves the contract unbound. */
interface ContractBindingChoice {
  targetConfigurationId: string | null;
}

interface ContractBindingListItem extends ListItem {
  targetConfigurationId: string | null;
}

interface ContractProviderOption {
  provider: ExternalPluginContractProvider;
  /** Declared operations of the consumer the provider does not offer; non-empty means incompatible. */
  missingOperations: Array<string>;
}

/** A saved binding whose target does not provide the contract, or lacks an operation it calls. */
interface StaleContractBinding {
  targetTitle: string;
  missingOperations: Array<string>;
}

interface ContractBindingRow {
  contract: string;
  title: string | null;
  declaredOperations: Array<string> | null;
  state: ProviderLookup['state'];
  items: Array<ContractBindingListItem>;
  choice: ContractBindingChoice | null;
  stale: StaleContractBinding | null;
  /** Shown while the contract is left unbound. */
  hintKey: string | null;
  invalidTextKey: string | null;
  invalidTextParams: Record<string, string>;
  valid: boolean;
}

const UNBOUND: ContractBindingChoice = {targetConfigurationId: null};

/**
 * One dropdown per contract the plugin declares in `permissions.contracts`, offering every
 * configuration (across all integrations) that provides it, plus "Leave unbound". Providers that
 * lack an operation the plugin declares for the contract are listed but cannot be chosen.
 *
 * Initial choice: the saved binding; else "Leave unbound" when editing or when nothing compatible
 * provides the contract; else the only compatible provider. With several compatible providers, or a
 * saved binding that does not fit, the admin has to choose. Valid once every row has a choice and
 * no lookup is pending or failed; only bound rows are emitted.
 */
@Component({
  standalone: true,
  selector: 'valtimo-plugin-external-contract-bindings',
  templateUrl: './plugin-external-contract-bindings.component.html',
  styleUrls: ['./plugin-external-contract-bindings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    DropdownModule,
    LoadingModule,
    NotificationModule,
  ],
})
export class PluginExternalContractBindingsComponent implements OnChanges {
  @Input() public contracts: Array<ExternalPluginDeclaredContract> = [];
  @Input() public currentBindings: Array<ExternalPluginContractBindingResponse> = [];
  /** The configuration being edited, null while creating one. Never offered as its own provider. */
  @Input() public selfConfigurationId: string | null = null;

  @Output() public bindingsChangeEvent = new EventEmitter<
    Array<ExternalPluginContractBindingEntry>
  >();
  @Output() public validEvent = new EventEmitter<boolean>();

  public readonly $rows = computed<Array<ContractBindingRow>>(() => {
    this._$lang();
    const lookups = this._$lookups();
    const choices = this._$choices();
    return this._$contracts().map(declared =>
      this._buildRow(
        declared,
        lookups[declared.contract] ?? {state: 'loading'},
        choices[declared.contract] ?? null
      )
    );
  });

  protected readonly testIds = PLUGIN_EXTERNAL_CONTRACT_BINDINGS_TEST_IDS;

  private _generation = 0;

  private readonly _$contracts = signal<Array<ExternalPluginDeclaredContract>>([]);
  private readonly _$currentBindings = signal<Array<ExternalPluginContractBindingResponse>>([]);
  private readonly _$selfConfigurationId = signal<string | null>(null);
  private readonly _$lookups = signal<Record<string, ProviderLookup>>({});
  private readonly _$choices = signal<Record<string, ContractBindingChoice>>({});
  private readonly _$lang = signal<string>('');
  private readonly _lookupRequests$ = new Subject<ProviderLookupRequest>();

  constructor(
    private readonly _externalPluginService: ExternalPluginService,
    private readonly _translateService: TranslateService,
    private readonly _destroyRef: DestroyRef
  ) {
    this._$lang.set(this._translateService.currentLang ?? '');
    this._translateService.onLangChange
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(({lang}) => this._$lang.set(lang));
    this._lookupRequests$
      .pipe(
        mergeMap(request => this._lookup(request)),
        takeUntilDestroyed(this._destroyRef)
      )
      .subscribe(result => this._onLookupResult(result));
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (!changes['contracts'] && !changes['currentBindings'] && !changes['selfConfigurationId']) {
      return;
    }

    const contracts = this._uniqueContracts(this.contracts ?? []);
    this._generation++;
    this._$contracts.set(contracts);
    this._$currentBindings.set(this.currentBindings ?? []);
    this._$selfConfigurationId.set(this.selfConfigurationId ?? null);
    this._$choices.set({});
    this._$lookups.set(
      Object.fromEntries(contracts.map(({contract}) => [contract, {state: 'loading'}]))
    );
    this._emit();
    contracts.forEach(({contract}) =>
      this._lookupRequests$.next({generation: this._generation, contract})
    );
  }

  public onChoiceSelected(contract: string, event: {item?: ContractBindingListItem}): void {
    if (!event?.item) return;

    const choice: ContractBindingChoice = {targetConfigurationId: event.item.targetConfigurationId};
    this._$choices.update(choices => ({...choices, [contract]: choice}));
    this._emit();
  }

  public onRetry(contract: string): void {
    this._$lookups.update(lookups => ({...lookups, [contract]: {state: 'loading'}}));
    this._$choices.update(choices => {
      const remaining = {...choices};
      delete remaining[contract];
      return remaining;
    });
    this._emit();
    this._lookupRequests$.next({generation: this._generation, contract});
  }

  public trackByContract(_index: number, row: ContractBindingRow): string {
    return row.contract;
  }

  private _uniqueContracts(
    contracts: Array<ExternalPluginDeclaredContract>
  ): Array<ExternalPluginDeclaredContract> {
    const unique = new Map<string, ExternalPluginDeclaredContract>();
    contracts.forEach(declared => {
      if (declared?.contract && !unique.has(declared.contract)) {
        unique.set(declared.contract, declared);
      }
    });
    return [...unique.values()];
  }

  private _lookup(request: ProviderLookupRequest): Observable<ProviderLookupResult> {
    return this._externalPluginService.getContractProviders(request.contract).pipe(
      map((providers): ProviderLookup => ({state: 'ready', providers: providers ?? []})),
      catchError(() => of<ProviderLookup>({state: 'error'})),
      map(lookup => ({...request, lookup}))
    );
  }

  private _onLookupResult({generation, contract, lookup}: ProviderLookupResult): void {
    if (generation !== this._generation) return;

    this._$lookups.update(lookups => ({...lookups, [contract]: lookup}));
    this._emit();
  }

  private _buildRow(
    declared: ExternalPluginDeclaredContract,
    lookup: ProviderLookup,
    explicitChoice: ContractBindingChoice | null
  ): ContractBindingRow {
    const row = {contract: declared.contract, declaredOperations: declared.operations};

    if (lookup.state !== 'ready') {
      return {
        ...row,
        title: null,
        state: lookup.state,
        items: [],
        choice: null,
        stale: null,
        hintKey: null,
        invalidTextKey: null,
        invalidTextParams: {},
        valid: false,
      };
    }

    const options: Array<ContractProviderOption> = lookup.providers
      .filter(provider => provider.configurationId !== this._$selfConfigurationId())
      .map(provider => ({
        provider,
        missingOperations: this._missingOperations(declared, provider),
      }));
    const {choice, stale} = explicitChoice
      ? {choice: explicitChoice, stale: null}
      : this._initialChoice(declared.contract, options);
    const unbound = choice?.targetConfigurationId === null;

    return {
      ...row,
      title: this._contractTitle(declared.contract, lookup.providers),
      state: 'ready',
      items: this._items(options, choice),
      choice,
      stale,
      hintKey: unbound ? this._unboundHintKey(options) : null,
      ...this._invalidText(choice, stale),
      valid: !!choice && !stale,
    };
  }

  private _initialChoice(
    contract: string,
    options: Array<ContractProviderOption>
  ): {choice: ContractBindingChoice | null; stale: StaleContractBinding | null} {
    const current = this._$currentBindings().find(binding => binding.contract === contract);

    if (current) {
      const bound = options.find(
        option => option.provider.configurationId === current.targetConfigurationId
      );
      if (!bound) {
        const targetTitle = current.targetConfigurationTitle ?? current.targetConfigurationId;
        return {choice: null, stale: {targetTitle, missingOperations: []}};
      }
      if (bound.missingOperations.length > 0) {
        const {configurationTitle, configurationId} = bound.provider;
        return {
          choice: null,
          stale: {
            targetTitle: configurationTitle || configurationId,
            missingOperations: bound.missingOperations,
          },
        };
      }
      return {choice: {targetConfigurationId: current.targetConfigurationId}, stale: null};
    }

    const compatible = options.filter(option => option.missingOperations.length === 0);
    if (this._$selfConfigurationId() || compatible.length === 0) {
      return {choice: UNBOUND, stale: null};
    }
    if (compatible.length === 1) {
      return {choice: {targetConfigurationId: compatible[0].provider.configurationId}, stale: null};
    }
    return {choice: null, stale: null};
  }

  private _missingOperations(
    declared: ExternalPluginDeclaredContract,
    provider: ExternalPluginContractProvider
  ): Array<string> {
    if (!declared.operations) return [];

    const offered = new Set((provider.operations ?? []).map(operation => operation.key));
    return declared.operations.filter(operation => !offered.has(operation));
  }

  private _contractTitle(
    contract: string,
    providers: Array<ExternalPluginContractProvider>
  ): string | null {
    const lang = this._$lang();
    for (const provider of providers) {
      const title = getExternalPluginContractTitle(provider, contract, lang);
      if (title) return title;
    }
    return null;
  }

  private _items(
    options: Array<ContractProviderOption>,
    choice: ContractBindingChoice | null
  ): Array<ContractBindingListItem> {
    const selectedTarget = choice ? choice.targetConfigurationId : undefined;

    return [
      {
        content: this._translateService.instant('pluginManagement.contracts.leaveUnbound'),
        targetConfigurationId: null,
        selected: selectedTarget === null,
      },
      ...options.map(({provider, missingOperations}) => ({
        content: this._providerLabel(provider, missingOperations),
        targetConfigurationId: provider.configurationId,
        selected: selectedTarget === provider.configurationId,
        disabled: missingOperations.length > 0,
      })),
    ];
  }

  private _providerLabel(
    provider: ExternalPluginContractProvider,
    missingOperations: Array<string>
  ): string {
    const host = provider.hostName ? ` · ${provider.hostName}` : '';
    const notes = [
      ...(provider.available
        ? []
        : [this._translateService.instant('pluginManagement.contracts.unavailable')]),
      ...(missingOperations.length > 0
        ? [
            this._translateService.instant('pluginManagement.contracts.missingOperations', {
              operations: missingOperations.join(', '),
            }),
          ]
        : []),
    ];
    const suffix = notes.length > 0 ? ` (${notes.join('; ')})` : '';
    return `${provider.configurationTitle} — ${provider.pluginId}@${provider.version}${host}${suffix}`;
  }

  private _unboundHintKey(options: Array<ContractProviderOption>): string {
    if (options.length === 0) return 'pluginManagement.contracts.noProvider';
    if (options.every(option => option.missingOperations.length > 0)) {
      return 'pluginManagement.contracts.noCompatibleProvider';
    }
    return 'pluginManagement.contracts.unboundHint';
  }

  private _invalidText(
    choice: ContractBindingChoice | null,
    stale: StaleContractBinding | null
  ): Pick<ContractBindingRow, 'invalidTextKey' | 'invalidTextParams'> {
    if (stale?.missingOperations.length) {
      return {
        invalidTextKey: 'pluginManagement.contracts.incompatibleBinding',
        invalidTextParams: {
          title: stale.targetTitle,
          operations: stale.missingOperations.join(', '),
        },
      };
    }
    if (stale) {
      return {
        invalidTextKey: 'pluginManagement.contracts.staleBinding',
        invalidTextParams: {title: stale.targetTitle},
      };
    }
    if (!choice) {
      return {invalidTextKey: 'pluginManagement.contracts.choiceRequired', invalidTextParams: {}};
    }
    return {invalidTextKey: null, invalidTextParams: {}};
  }

  private _emit(): void {
    const rows = this.$rows();
    this.bindingsChangeEvent.emit(
      rows
        .filter(row => !!row.choice?.targetConfigurationId)
        .map(row => ({
          contract: row.contract,
          targetConfigurationId: row.choice!.targetConfigurationId!,
        }))
    );
    this.validEvent.emit(rows.every(row => row.valid));
  }
}
