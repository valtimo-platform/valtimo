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

import {NEVER} from 'rxjs';

/** A collaborator whose streams never emit and whose methods return such a stream. */
export const silentStub = (overrides: {[key: string]: unknown} = {}): any =>
  new Proxy(overrides, {
    get: (target, key) => {
      if (key in target) return target[key as string];
      if (typeof key !== 'string' || key === 'then' || key.startsWith('ng')) return undefined;
      return key.endsWith('$') ? NEVER : () => NEVER;
    },
  });
