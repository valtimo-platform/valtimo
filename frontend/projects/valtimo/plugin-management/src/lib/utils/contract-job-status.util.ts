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

import {ExternalPluginContractJobStatus} from '@valtimo/plugin';

/** Carbon tag colour per contract job status; open states neutral, terminal states signal outcome. */
function contractJobStatusTagType(status: ExternalPluginContractJobStatus | string): string {
  switch (status) {
    case 'PENDING':
      return 'cool-gray';
    case 'ACCEPTED':
      return 'blue';
    case 'COMPLETED':
      return 'cyan';
    case 'DELIVERED':
      return 'green';
    case 'EXPIRED':
      return 'warm-gray';
    case 'FAILED':
    case 'UNDELIVERABLE':
      return 'red';
    default:
      return 'gray';
  }
}

export {contractJobStatusTagType};
