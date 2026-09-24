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

import {Components} from '@formio/js';
import {buildCustomComponentEditForm, CUSTOM_COMPONENT_TABS} from './form-io-edit-form.utils';
import {formIoUploaderEditForm} from './components/form-io-uploader/form-io-uploader-edit-form';
import {formIoCurrentUserEditForm} from './components/form-io-current-user/form-io-current-user-edit-form';

const getTabs = (editForm: any) =>
  editForm.components.find(component => component?.key === 'tabs');

const getDisplayTabKeys = (editForm: any): string[] =>
  getTabs(editForm)
    .components.find(tab => tab.key === 'display')
    .components.map(component => component.key);

describe('buildCustomComponentEditForm', () => {
  const displayComponents = [{type: 'textfield', input: true, key: 'label', label: 'Label'}];

  it('prepends a hidden type field so the builder preserves the custom component type', () => {
    const editForm = buildCustomComponentEditForm(displayComponents);

    expect(editForm.components[0]).toEqual({key: 'type', type: 'hidden'});
  });

  it('replaces the display tab components rather than appending to the textfield defaults', () => {
    const editForm = buildCustomComponentEditForm(displayComponents);

    expect(getDisplayTabKeys(editForm)).toEqual(['label']);
  });

  it('keeps only the tabs that apply to custom components', () => {
    const editForm = buildCustomComponentEditForm(displayComponents);
    const tabKeys = getTabs(editForm).components.map(tab => tab.key);

    expect(tabKeys).toEqual(CUSTOM_COMPONENT_TABS);
    expect(tabKeys).not.toContain('api');
    expect(tabKeys).not.toContain('validation');
  });

  it('warns and leaves the edit form untouched when Form.io has no display tab', () => {
    spyOn(console, 'warn');
    spyOn(Components.components.textfield, 'editForm').and.returnValue({
      components: [{key: 'somethingElse'}],
    });

    const editForm = buildCustomComponentEditForm(displayComponents);

    expect(console.warn).toHaveBeenCalled();
    expect(getTabs(editForm)).toBeUndefined();
  });
});

describe('formIoUploaderEditForm', () => {
  it('exposes the label, required and property name settings', () => {
    const keys = getDisplayTabKeys(formIoUploaderEditForm());

    expect(keys).toContain('label');
    expect(keys).toContain('validate.required');
    expect(keys).toContain('key');
  });

  it('exposes the uploader specific settings', () => {
    const keys = getDisplayTabKeys(formIoUploaderEditForm());

    expect(keys).toContain('customOptions.maxFileSize');
    expect(keys).toContain('customOptions.camera');
  });

  it('does not leak textfield settings that do not apply to an upload field', () => {
    const keys = getDisplayTabKeys(formIoUploaderEditForm());

    expect(keys).not.toContain('placeholder');
    expect(keys).not.toContain('inputMask');
  });
});

describe('formIoCurrentUserEditForm', () => {
  it('keeps its curated settings', () => {
    const keys = getDisplayTabKeys(formIoCurrentUserEditForm());

    expect(keys).toEqual(['label', 'key', 'tableView', 'hideLabel', 'hidden']);
  });

  it('defaults the label to the component name', () => {
    const label = getTabs(formIoCurrentUserEditForm())
      .components.find(tab => tab.key === 'display')
      .components.find(component => component.key === 'label');

    expect(label.defaultValue).toBe('Valtimo Current User');
  });
});
