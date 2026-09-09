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

interface AssistantPageContext {
  // Named group `resourceId` becomes PageContext.resourceId; every other named group
  // goes into additionalContext. Order matters — the first match wins.
  urlPattern: RegExp;
  // Must match a branch of the backend's AssistantContextBuilder to get enriched context.
  page: string;
  resourceType?: string;
  teaserMessageKey?: string;
  greetingKey?: string;
  suggestionKeys?: ReadonlyArray<string>;
}

const ASSISTANT_PAGE_CONTEXTS: ReadonlyArray<AssistantPageContext> = [
  {
    urlPattern: /^\/cases\/[^/?#]+\/document\/(?<resourceId>[^/?#]+)/,
    page: 'case-detail',
    resourceType: 'document',
  },
  {
    urlPattern: /^\/cases\/(?<resourceId>[^/?#]+)(?:[?#]|$)/,
    page: 'case-list',
    resourceType: 'caseDefinition',
  },
  {
    urlPattern: /^\/case-management\/case\/(?<resourceId>[^/?#]+)\/version\/(?<versionTag>[^/?#]+)/,
    page: 'case-definition-editor',
    resourceType: 'caseDefinition',
  },
  {
    urlPattern: /^\/processes\/(?!create(?:[?#/]|$))(?<resourceId>[^/?#]+)/,
    page: 'process-definition-detail',
    resourceType: 'processDefinition',
  },
  {
    urlPattern: /^\/form-management\/(?<resourceId>[^/?#]+)/,
    page: 'form-builder',
    resourceType: 'form',
  },
  {
    urlPattern: /^\/access-control\/(?<resourceId>[^/?#]+)/,
    page: 'access-control-detail',
    resourceType: 'role',
    teaserMessageKey: 'assistant.teaser.accessControl',
    greetingKey: 'assistant.greeting.accessControl',
    suggestionKeys: [
      'assistant.suggestions.add',
      'assistant.suggestions.remove',
      'assistant.suggestions.edit',
    ],
  },
];

const ASSISTANT_GENERIC_GREETING_KEY = 'assistant.greeting.generic';

// The generic greeting asks an open question, so these carry the scope instead.
const ASSISTANT_GENERIC_SUGGESTION_KEYS: ReadonlyArray<string> = [
  'assistant.suggestions.viewCaseDefinition',
  'assistant.suggestions.explainProcess',
  'assistant.suggestions.findCase',
];

export {
  AssistantPageContext,
  ASSISTANT_GENERIC_GREETING_KEY,
  ASSISTANT_GENERIC_SUGGESTION_KEYS,
  ASSISTANT_PAGE_CONTEXTS,
};
