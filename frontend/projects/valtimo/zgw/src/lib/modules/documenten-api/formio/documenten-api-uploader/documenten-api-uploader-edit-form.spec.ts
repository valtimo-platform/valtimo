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

import {documentenApiUploaderEditForm} from './documenten-api-uploader-edit-form';

const getDisplayTab = (editForm: any) =>
  editForm.components
    .find(component => component?.key === 'tabs')
    .components.find(tab => tab.key === 'display');

const getDisplayComponents = (editForm: any): any[] => getDisplayTab(editForm).components;

describe('documentenApiUploaderEditForm', () => {
  it('prepends a hidden type field so the builder preserves the component type', () => {
    expect(documentenApiUploaderEditForm().components[0]).toEqual({key: 'type', type: 'hidden'});
  });

  it('exposes the label, required and property name settings', () => {
    const keys = getDisplayComponents(documentenApiUploaderEditForm()).map(c => c.key);

    expect(keys).toContain('label');
    expect(keys).toContain('validate.required');
    expect(keys).toContain('key');
  });

  it('exposes the Documenten API metadata settings', () => {
    const keys = getDisplayComponents(documentenApiUploaderEditForm()).map(c => c.key);

    expect(keys).toContain('customOptions.documentUrlProcessVariable');
    expect(keys).toContain('customOptions.documentType');
    expect(keys).toContain('customOptions.tags');
  });

  it('does not leak textfield settings that do not apply to an upload field', () => {
    const keys = getDisplayComponents(documentenApiUploaderEditForm()).map(c => c.key);

    expect(keys).not.toContain('placeholder');
    expect(keys).not.toContain('inputMask');
  });

  it('orders every setting by an explicit ascending weight', () => {
    const weights = getDisplayComponents(documentenApiUploaderEditForm()).map(c => c.weight);

    expect(weights.every(weight => typeof weight === 'number')).toBeTrue();
    expect(weights).toEqual([...weights].sort((a, b) => a - b));
  });
});
