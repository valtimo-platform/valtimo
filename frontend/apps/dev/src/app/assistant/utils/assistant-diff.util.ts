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

import {FormioForm} from '@formio/angular';

/*
 * ChangePreview.diff carries plain strings and says nothing about what is inside them: a
 * form definition, BPMN xml or a couple of lines of text. So the side is inspected here.
 *
 * Replace this sniffing with a real discriminator as soon as the backend labels the payload
 * (for example ChangePreview.format = 'formio' | 'bpmn' | 'text').
 */

// The backend writes these when one side of the change does not exist yet.
const ABSENT_MARKERS = ['(new form)', '(deleted)', '(empty)', '(none)'];

function isAbsent(side: string | undefined): boolean {
  return !side?.trim() || ABSENT_MARKERS.includes(side.trim().toLowerCase());
}

function toFormioForm(side: string | undefined): FormioForm | null {
  if (!side) return null;

  try {
    const parsed = JSON.parse(side);

    // A Form.io definition is recognisable by its components array; anything else is text.
    return Array.isArray(parsed?.components) ? (parsed as FormioForm) : null;
  } catch {
    return null;
  }
}

export {isAbsent, toFormioForm};
