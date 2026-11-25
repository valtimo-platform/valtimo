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

export const PLUGIN_CONTRACT_JOBS_PAGE_TEST_IDS = {
  statusFilter: 'pluginContractJobsStatusFilter',
  configurationFilter: 'pluginContractJobsConfigurationFilter',
  refreshButton: 'pluginContractJobsRefreshButton',
} as const;

export const PLUGIN_CONTRACT_JOB_DETAIL_MODAL_TEST_IDS = {
  closeButton: 'pluginContractJobDetailModalCloseButton',
  cancelButton: 'pluginContractJobDetailModalCancelButton',
  redeliverButton: 'pluginContractJobDetailModalRedeliverButton',
  loadError: 'pluginContractJobDetailModalLoadError',
  retryButton: 'pluginContractJobDetailModalRetryButton',
  actionError: 'pluginContractJobDetailModalActionError',
  showPayloadsButton: 'pluginContractJobDetailModalShowPayloadsButton',
  payloadError: 'pluginContractJobDetailModalPayloadError',
  requestPayload: 'pluginContractJobDetailModalRequestPayload',
  resultPayload: 'pluginContractJobDetailModalResultPayload',
} as const;
