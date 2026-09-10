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

import {AssistantDegradedReason, AssistantReply, AssistantResponseDto} from '../models';

/*
 * The pending action now arrives as a typed action, so no text parsing is needed for it.
 * What is left here is the last backend gap: chat failures and an unconfigured model come
 * back as ordinary messages with HTTP 200, so they can only be told apart by their text.
 */

const NOT_CONFIGURED_PATTERN = /assistant is not configured/i;
const ERROR_PATTERN = /encountered an error processing your request/i;

function toAssistantReply(dto: AssistantResponseDto): AssistantReply {
  const message = dto.message ?? '';
  const action = dto.action ?? null;
  const confirmation = action?.type === 'confirmation_required' ? action : null;

  return {
    sessionId: dto.sessionId,
    text: message,
    pendingAction: confirmation
      ? {
          id: confirmation.pendingActionId,
          description: confirmation.preview?.description ?? '',
          diff: confirmation.preview?.diff,
          affectedResources: confirmation.preview?.affectedResources,
        }
      : null,
    degraded: detectDegradedReason(message),
  };
}

function detectDegradedReason(message: string): AssistantDegradedReason | null {
  if (NOT_CONFIGURED_PATTERN.test(message)) return 'notConfigured';

  if (ERROR_PATTERN.test(message)) return 'error';

  return null;
}

export {toAssistantReply};
