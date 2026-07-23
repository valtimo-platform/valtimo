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

import {SelectItem} from '@valtimo/components';

// The short (simple) name of a fully-qualified type, e.g. "CaseDefinition" for
// "com.ritense.case_.domain.definition.CaseDefinition".
function shortTypeName(fullyQualifiedName: string): string {
  if (!fullyQualifiedName) return '';
  return fullyQualifiedName.substring(fullyQualifiedName.lastIndexOf('.') + 1);
}

// A select item labelled "ShortName (fully.qualified.Name)", keeping the fully-qualified name as the
// stored id. Used for the resource-type, related-resource and value-type dropdowns so the readable
// name is shown while the exact technical type is what gets persisted.
function fqnSelectItem(fullyQualifiedName: string): SelectItem {
  return {
    id: fullyQualifiedName,
    text: `${shortTypeName(fullyQualifiedName)} (${fullyQualifiedName})`,
  };
}

export {fqnSelectItem, shortTypeName};
