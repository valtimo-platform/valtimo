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

import {SimpleChange} from '@angular/core';
import {FormBuilder} from '@angular/forms';
import {of} from 'rxjs';
import {CaseManagementConfigurationModalComponent} from './case-management-configuration-modal.component';

describe('CaseManagementConfigurationModalComponent', () => {
  const PARAMS = {caseDefinitionKey: 'permit', caseDefinitionVersionTag: '1.0.0'};
  const ITEM = {key: 'api-url', defaultValue: 'https://a', environmentValue: null};

  let api: jasmine.SpyObj<any>;
  let component: CaseManagementConfigurationModalComponent;

  const open = (item: typeof ITEM | null): void => {
    component.item = item;
    component.open = true;
    component.ngOnChanges({open: new SimpleChange(false, true, false)});
  };

  beforeEach(() => {
    api = jasmine.createSpyObj('CaseConfigurationApiService', [
      'createConfiguration',
      'updateConfiguration',
    ]);
    api.createConfiguration.and.returnValue(of(ITEM));
    api.updateConfiguration.and.returnValue(of(ITEM));
    component = new CaseManagementConfigurationModalComponent(api, new FormBuilder());
    component.params = PARAMS;
    component.usedKeys = ['api-url'];
  });

  it('rejects a blank key, a key with whitespace and a key already in use', () => {
    open(null);

    for (const key of ['', '   ', 'api url', 'api-url']) {
      component.key.setValue(key);
      expect(component.key.valid).withContext(key).toBeFalse();
    }

    component.key.setValue('other-key');
    expect(component.key.valid).toBeTrue();
  });

  it('creates a declaration with an empty default value', () => {
    open(null);
    component.formGroup.setValue({key: 'new-key', defaultValue: ''});

    component.save();

    expect(api.createConfiguration).toHaveBeenCalledWith(PARAMS, {
      key: 'new-key',
      defaultValue: '',
    });
  });

  it('fixes the key when editing and sends only the default value', () => {
    open(ITEM);

    expect(component.$isEdit()).toBeTrue();
    expect(component.key.disabled).toBeTrue();

    component.formGroup.controls.defaultValue.setValue('https://b');
    component.save();

    expect(api.updateConfiguration).toHaveBeenCalledWith(PARAMS, 'api-url', {
      defaultValue: 'https://b',
    });
  });
});
