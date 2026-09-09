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

/*
 * Backend DTO mirrors. Hand-written on purpose: the TypeScript generator scans
 * com.ritense.**.web.rest.dto.* on the app's classpath, and backend/assistant is not a
 * dependency of backend/apps/dev yet. Replace these with generated types from
 * @valtimo/shared once the module is wired into the app.
 */

interface PageContextDto {
  page: string;
  resourceType?: string;
  resourceId?: string;
  // AssistantContextBuilder reads versionTag from here for case-definition-editor.
  additionalContext?: Record<string, string>;
}

interface SessionResponseDto {
  id: string;
  title?: string;
  createdAt: string;
  lastActivityAt: string;
}

interface PageDto<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

interface ChatRequestDto {
  message: string;
  sessionId?: string;
  context?: PageContextDto;
}

interface DiffContentDto {
  before: string;
  after: string;
}

interface ChangePreviewDto {
  description: string;
  diff?: DiffContentDto;
  affectedResources?: string[];
}

// Discriminated by Jackson's @JsonTypeInfo(property = "type") on the sealed AssistantAction.
type AssistantActionDto =
  | {type: 'confirmation_required'; preview: ChangePreviewDto; pendingActionId: string}
  | {type: 'highlight'; elements: Array<{selector: string; label: string}>}
  | {type: 'navigate'; route: string; params?: Record<string, string>}
  | {type: 'show_diff'; before: string; after: string; language: string};

interface AssistantResponseDto {
  message: string;
  sessionId: string;
  action?: AssistantActionDto | null;
}

interface AssistantConfigResponseDto {
  enabled: boolean;
  configured: boolean;
}

interface ConfirmActionResponseDto {
  success: boolean;
  result?: unknown;
  error?: string;
}

type AssistantMessageAuthor = 'assistant' | 'user';

type AssistantDegradedReason = 'error' | 'notConfigured';

interface AssistantMessage {
  id: string;
  author: AssistantMessageAuthor;
  // Backend messages carry text; frontend-generated ones carry a key so they follow language switches.
  text?: string;
  textKey?: string;
  timestamp: Date;
  suggestionKeys?: ReadonlyArray<string>;
}

interface AssistantReply {
  sessionId: string;
  text: string;
  pendingActionId: string | null;
  previewDescription: string | null;
  degraded: AssistantDegradedReason | null;
}

export {
  AssistantActionDto,
  AssistantConfigResponseDto,
  AssistantDegradedReason,
  AssistantMessage,
  AssistantMessageAuthor,
  AssistantReply,
  AssistantResponseDto,
  ChatRequestDto,
  ConfirmActionResponseDto,
  PageContextDto,
  PageDto,
  SessionResponseDto,
};
