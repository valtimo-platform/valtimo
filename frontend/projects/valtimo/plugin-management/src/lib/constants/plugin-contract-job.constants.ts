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

import {ModalButtonType} from 'carbon-components-angular';
import {ContractJobActionConfirmation} from '../models/plugin-contract-job.model';

const DEFAULT_PAGE_SIZE = 10;

/** Opens the detail modal of this job; set while the modal is open, so the URL can be shared. */
const JOB_ID_QUERY_PARAM = 'jobId';

const confirmation = (
  key: string,
  actionKey: string,
  confirmButtonType: ModalButtonType
): ContractJobActionConfirmation => ({
  titleKey: `pluginManagement.contractJobs.${key}.title`,
  contentKey: `pluginManagement.contractJobs.${key}.content`,
  confirmKey: `pluginManagement.contractJobs.actions.${actionKey}`,
  confirmButtonType,
});

const CONFIRMATIONS = {
  cancelJob: confirmation('confirmCancelJob', 'cancelJob', ModalButtonType.danger),
  stopDelivery: confirmation('confirmStopDelivery', 'stopDelivery', ModalButtonType.danger),
  redeliver: confirmation('confirmRedeliver', 'redeliver', ModalButtonType.primary),
} as const;

export {DEFAULT_PAGE_SIZE, JOB_ID_QUERY_PARAM, CONFIRMATIONS};
