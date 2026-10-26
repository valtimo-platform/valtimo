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

import createDOMPurify, {Config} from 'dompurify';

const SANITIZE_CONFIG: Config = {
  FORBID_TAGS: ['form', 'input', 'button', 'textarea', 'select'],
};

// Use an isolated DOMPurify instance so the anchor hook below does not leak onto
// the shared singleton that formiojs (and other libraries) sanitize with.
const purifier = createDOMPurify(window);

purifier.addHook('afterSanitizeAttributes', node => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export const sanitizeEmailHtml = (html: string): string =>
  purifier.sanitize(html, SANITIZE_CONFIG);
