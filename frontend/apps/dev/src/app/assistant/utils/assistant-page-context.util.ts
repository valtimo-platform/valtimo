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

import {ASSISTANT_PAGE_CONTEXTS, AssistantPageContext} from '../constants';
import {PageContextDto} from '../models';

interface ResolvedAssistantPageContext {
  definition: AssistantPageContext;
  resourceId?: string;
  additionalContext?: Record<string, string>;
}

function resolveAssistantPageContext(url: string): ResolvedAssistantPageContext | null {
  for (const definition of ASSISTANT_PAGE_CONTEXTS) {
    // Test the match, not the groups: a pattern without named groups (every list page)
    // matches with `groups` undefined, and checking groups skipped all of them.
    const match = url.match(definition.urlPattern);

    if (!match) continue;

    const {resourceId, ...rest} = match.groups ?? {};

    return {
      definition,
      resourceId,
      ...(Object.keys(rest).length && {additionalContext: rest}),
    };
  }

  return null;
}

function toPageContextDto(url: string): PageContextDto {
  const resolved = resolveAssistantPageContext(url);

  // Unmapped pages still send the raw url — the backend falls back to a generic context.
  if (!resolved) return {page: url};

  return {
    page: resolved.definition.page,
    resourceType: resolved.definition.resourceType,
    resourceId: resolved.resourceId,
    additionalContext: resolved.additionalContext,
  };
}

export {ResolvedAssistantPageContext, resolveAssistantPageContext, toPageContextDto};
