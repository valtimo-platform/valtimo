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

import {ListItem, ModalButtonType} from 'carbon-components-angular';
import {ExternalPluginContractJobSummary} from '@valtimo/plugin';

type ContractJobAction = 'cancel' | 'redeliver';

type PayloadState = 'hidden' | 'loading' | 'shown' | 'error';

interface ContractJobActionConfirmation {
  titleKey: string;
  contentKey: string;
  confirmKey: string;
  confirmButtonType: ModalButtonType;
}

interface ContractJobRow extends ExternalPluginContractJobSummary {
  statusTagType: string;
  /** `errorCode`, followed by the provider's own code when it reported one. */
  errorLabel: string;
}

interface FilterListItem extends ListItem {
  value: string;
}

export {
  ContractJobAction,
  PayloadState,
  ContractJobActionConfirmation,
  ContractJobRow,
  FilterListItem,
};
