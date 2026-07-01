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

import {Injector} from '@angular/core';
import {FormioCustomComponentInfo, registerCustomFormioComponent} from '../../../../modules';
import {ObjectManagementSelectComponent} from './object-management-select.component';
import {objectManagementSelectEditForm} from './object-management-select-edit-form';

const COMPONENT_OPTIONS: FormioCustomComponentInfo = {
  type: 'object-management-select',
  selector: 'valtimo-object-management-select',
  title: 'Object Management Select',
  group: 'advanced',
  icon: 'table',
  fieldOptions: ['label', 'validate'],
  editForm: objectManagementSelectEditForm,
  emptyValue: [],
  schema: {
    label: 'Object Management Select',
    hideLabel: false,
    tableView: false,
    validate: {
      // Built-in minLength/maxLength only work for strings; this handles arrays.
      // Returns error message string directly (formio's t() doesn't resolve custom translation keys).
      // Uses errors.custom from form definition if set, otherwise default message.
      // Empty array skipped here - let required validator handle that case.
      custom:
        'var arr = input || []; ' +
        'if (arr.length === 0) { valid = true; } else { ' +
        'var min = component.validate?.minLength; ' +
        'var max = component.validate?.maxLength; ' +
        'var isValid = (min == null || arr.length >= min) && (max == null || arr.length <= max); ' +
        'var msg = component.errors?.custom || (component.label + " does not meet selection requirements"); ' +
        'valid = isValid ? true : msg; }',
    },
  },
};

export function registerObjectManagementSelectFormioComponent(injector: Injector): void {
  if (!customElements.get(COMPONENT_OPTIONS.selector)) {
    registerCustomFormioComponent(COMPONENT_OPTIONS, ObjectManagementSelectComponent, injector);
  }
}
