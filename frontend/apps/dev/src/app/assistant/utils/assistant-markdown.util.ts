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

/*
 * Assistant replies are model output shaped by case data, so they are untrusted input.
 * Three layers guard the render: images are dropped (a remote src is a beacon an injected
 * prompt could plant), link schemes are allow-listed, and the result still passes through
 * Angular's own sanitizer via [innerHTML].
 *
 * Link hardening mirrors renderWidgetMarkdown in @valtimo/layout. Promote both to one
 * shared util when this moves out of apps/dev.
 */

const marked = new Marked({gfm: true, breaks: true});

const IMAGE_TAG = /<img\b[^>]*>/gi;
const ANCHOR_OPEN_TAG = /<a\s+([^>]*)>/gi;
const HREF_ATTRIBUTE = /href\s*=\s*("[^"]*"|'[^']*')/i;
const HREF_VALUE = /href\s*=\s*("([^"]*)"|'([^']*)')/i;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const ALLOWED_SCHEMES = /^(https?:|mailto:|tel:)/i;

function renderAssistantMarkdown(content: string): string {
  if (!content) return '';

  return hardenLinks(dropImages(marked.parse(content, {async: false})));
}

function dropImages(html: string): string {
  return html.replace(IMAGE_TAG, '');
}

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
  // Browsers ignore whitespace and control characters inside a scheme, so a tab dropped
  // into "java<tab>script:" still has to be judged as "javascript:".
  const value = [...href].filter(char => char > ' ' && char.trim() !== '').join('');

  if (!value) return false;

  // Relative paths and fragments carry no scheme and are safe.
  if (!SCHEME.test(value)) return true;

  return ALLOWED_SCHEMES.test(value);
}

export {renderAssistantMarkdown};
