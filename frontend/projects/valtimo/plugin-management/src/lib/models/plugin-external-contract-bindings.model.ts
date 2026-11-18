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

import {ListItem} from 'carbon-components-angular';
import {ExternalPluginContractProvider} from '@valtimo/plugin';

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

export {
  ProviderLookup,
  ProviderLookupRequest,
  ProviderLookupResult,
  ContractBindingChoice,
  ContractBindingListItem,
  ContractProviderOption,
  StaleContractBinding,
  ContractBindingRow,
};
