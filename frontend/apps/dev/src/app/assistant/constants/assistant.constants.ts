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
  // === USER-FACING PAGES ===

  // Dashboard
  {urlPattern: /^\/$/, page: 'dashboard'},

  // Tasks (task-detail MUST come before case-detail - both match /cases/.../document/...)
  {urlPattern: /^\/tasks(?:[?#]|$)/, page: 'task-list'},
  {
    urlPattern:
      /^\/cases\/(?<caseDefinitionKey>[^/?#]+)\/document\/(?<documentId>[^/?#]+)\/[^/?#]+\/tasks\/(?<taskId>[^/?#]+)/,
    page: 'task-detail',
    resourceType: 'task',
  },

  // Cases (case-inspection before case-detail)
  {
    urlPattern: /^\/cases\/[^/?#]+\/document\/(?<resourceId>[^/?#]+)\/case-inspection/,
    page: 'case-inspection',
    resourceType: 'document',
  },
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

  // Profile & Analysis
  {urlPattern: /^\/profile(?:[?#]|$)/, page: 'profile'},
  {urlPattern: /^\/analysis(?:[?#]|$)/, page: 'analysis'},

  // Objects (detail before list)
  {
    urlPattern: /^\/objects\/(?<objectManagementId>[^/?#]+)\/(?<resourceId>[^/?#]+)/,
    page: 'object-detail',
    resourceType: 'object',
  },
  {
    urlPattern: /^\/objects\/(?<resourceId>[^/?#]+)(?:[?#]|$)/,
    page: 'object-list',
    resourceType: 'objectType',
  },

  // Teams
  {
    urlPattern: /^\/teams\/(?<resourceId>[^/?#]+)/,
    page: 'team-detail',
    resourceType: 'team',
  },
  {urlPattern: /^\/teams(?:[?#]|$)/, page: 'team-list'},

  // IKO (detail before search)
  {
    urlPattern: /^\/iko\/(?<key>[^/?#]+)\/(?<searchKey>[^/?#]+)\/details\/(?<resourceId>[^/?#]+)/,
    page: 'iko-detail',
    resourceType: 'ikoResult',
  },
  {
    urlPattern: /^\/iko\/(?<resourceId>[^/?#]+)(?:[/?#]|$)/,
    page: 'iko-search',
    resourceType: 'ikoConfiguration',
  },

  // === ADMIN PAGES ===

  // Access Control
  {urlPattern: /^\/access-control(?:[?#]|$)/, page: 'access-control-list'},
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

  // Processes
  {urlPattern: /^\/processes(?:[?#]|$)/, page: 'process-list'},
  {
    urlPattern: /^\/processes\/(?!create(?:[?#/]|$))(?<resourceId>[^/?#]+)/,
    page: 'process-definition-detail',
    resourceType: 'processDefinition',
  },

  // Decision Tables (editor before detail, both before list)
  {urlPattern: /^\/decision-tables(?:[?#]|$)/, page: 'decision-table-list'},
  {
    urlPattern: /^\/decision-tables\/edit\/(?<resourceId>[^/?#]+)/,
    page: 'decision-table-editor',
    resourceType: 'decisionTable',
  },
  {
    urlPattern: /^\/decision-tables\/(?<resourceId>[^/?#]+)/,
    page: 'decision-table-detail',
    resourceType: 'decisionTable',
  },

  // Forms
  {urlPattern: /^\/form-management(?:[?#]|$)/, page: 'form-list'},
  {
    urlPattern: /^\/form-management\/(?<resourceId>[^/?#]+)/,
    page: 'form-builder',
    resourceType: 'form',
  },

  // Case Management
  {urlPattern: /^\/case-management(?:[?#]|$)/, page: 'case-management-list'},
  {
    urlPattern: /^\/case-management\/case\/(?<resourceId>[^/?#]+)\/version\/(?<versionTag>[^/?#]+)/,
    page: 'case-definition-editor',
    resourceType: 'caseDefinition',
  },

  // Dashboard Management
  {urlPattern: /^\/dashboard-management(?:[?#]|$)/, page: 'dashboard-management-list'},
  {
    urlPattern: /^\/dashboard-management\/(?<resourceId>[^/?#]+)/,
    page: 'dashboard-management-detail',
    resourceType: 'dashboard',
  },

  // Building Blocks
  {urlPattern: /^\/building-block-management(?:[?#]|$)/, page: 'building-block-list'},
  {
    urlPattern:
      /^\/building-block-management\/building-block\/(?<resourceId>[^/?#]+)\/version\/(?<versionTag>[^/?#]+)/,
    page: 'building-block-detail',
    resourceType: 'buildingBlock',
  },

  // Plugins
  {urlPattern: /^\/plugins(?:[/?#]|$)/, page: 'plugin-list'},

  // Object Management
  {urlPattern: /^\/object-management(?:[?#]|$)/, page: 'object-management-list'},
  {
    urlPattern: /^\/object-management\/object\/(?<resourceId>[^/?#]+)/,
    page: 'object-management-detail',
    resourceType: 'objectType',
  },

  // Other Admin Pages
  {urlPattern: /^\/translation-management(?:[?#]|$)/, page: 'translation-management'},
  {urlPattern: /^\/admin-settings(?:[/?#]|$)/, page: 'admin-settings'},
  {urlPattern: /^\/process-links(?:[?#]|$)/, page: 'process-links'},
  {urlPattern: /^\/logging(?:[?#]|$)/, page: 'logging'},
  {urlPattern: /^\/case-migration(?:[?#]|$)/, page: 'case-migration'},
  {urlPattern: /^\/process-migration(?:[?#]|$)/, page: 'process-migration'},
  {urlPattern: /^\/milestones(?:[/?#]|$)/, page: 'milestones'},
  {urlPattern: /^\/choice-fields(?:[/?#]|$)/, page: 'choice-fields'},
  {urlPattern: /^\/iko-management(?:[/?#]|$)/, page: 'iko-management'},
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
