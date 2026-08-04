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
import {Marked} from 'marked';

/**
 * `breaks: true` because the content is authored in a plain textarea, where a single newline is
 * meant as a line break rather than as a paragraph continuation.
 */
const marked = new Marked({gfm: true, breaks: true});

const ANCHOR_OPEN_TAG = /<a\s+([^>]*)>/gi;
const HREF_ATTRIBUTE = /href\s*=\s*("[^"]*"|'[^']*')/i;
const HREF_VALUE = /href\s*=\s*("([^"]*)"|'([^']*)')/i;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const ALLOWED_SCHEMES = /^(https?:|mailto:|tel:)/i;

/**
 * Renders markdown to an HTML string.
 *
 * The result is meant to be bound with a plain `[innerHTML]` binding, so that Angular's
 * DomSanitizer removes anything unsafe (scripts, event handler attributes, `javascript:` URLs).
 * That sanitizer is the guarantee; the hardening below is a second line of defence so that this
 * function does not hand out dangerous markup on its own.
 */
export function renderWidgetMarkdown(content: string): string {
  if (!content) return '';

  return hardenLinks(marked.parse(content, {async: false}));
}

/**
 * Rewrites the anchors in the generated HTML so that they:
 * - open in a new tab, because a link in a text widget typically points somewhere outside the case
 *   (an intranet page, for example). `rel="noopener noreferrer"` keeps the opened page from
 *   reaching back into this window.
 * - carry no href with a dangerous scheme. marked passes `javascript:` URLs straight through, so
 *   they are dropped here; the link text stays visible but is no longer clickable.
 */
function hardenLinks(html: string): string {
  return html.replace(ANCHOR_OPEN_TAG, (_match, attributes: string) => {
    const safeAttributes = (
      isSafeHref(readHref(attributes)) ? attributes : attributes.replace(HREF_ATTRIBUTE, '')
    ).trim();

    return safeAttributes
      ? `<a target="_blank" rel="noopener noreferrer" ${safeAttributes}>`
      : '<a target="_blank" rel="noopener noreferrer">';
  });
}

function readHref(attributes: string): string {
  const match = HREF_VALUE.exec(attributes);

  return match?.[2] ?? match?.[3] ?? '';
}

function isSafeHref(href: string): boolean {
  // Browsers ignore whitespace and control characters inside a scheme, so `java\tscript:` has to be
  // judged as `javascript:`.
  const value = href.replace(/[\s\u0000-\u001f]/g, '');

  if (!value) return false;

  // Relative paths and fragments carry no scheme and are safe.
  if (!SCHEME.test(value)) return true;

  return ALLOWED_SCHEMES.test(value);
}
