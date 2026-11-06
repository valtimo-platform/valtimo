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

// Keys get a unique suffix per run — finalized versions can't be removed
export const REFERENCE_UPDATE = {
  sendEmailKeyPrefix: 'e2e-bb-send-email',
  draftContainerKeyPrefix: 'e2e-bb-reference-update-draft',
  notifyKeyPrefix: 'e2e-bb-reference-update-notify',
  outerKeyPrefix: 'e2e-bb-reference-update-outer',
  sourceVersionTag: '1.0.0',
  targetVersionTag: '1.0.1',
  containerVersionTag: '1.0.0',
  /** Patch differs between source and target, so new drafts bump the patch. */
  newDraftVersionTag: '1.0.1',
  sendEmailActivityId: 'callSendEmail',
  notifyActivityId: 'callNotify',
  /** Required by the target version only, so the Differences step asks for an input path. */
  requiredTargetField: 'subject',
  unprefixedInputPath: 'subject',
  validInputPath: 'doc:/subject',
} as const;
