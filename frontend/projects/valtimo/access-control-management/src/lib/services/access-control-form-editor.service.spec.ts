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

import {FormArray, FormBuilder, FormGroup} from '@angular/forms';
import {Permission, PermissionCondition} from '../models';
import {AccessControlFormEditorService} from './access-control-form-editor.service';

describe('AccessControlFormEditorService', () => {
  let service: AccessControlFormEditorService;

  const permissionWith = (condition: PermissionCondition): Permission => ({
    resourceType: 'com.ritense.case_.domain.definition.CaseDefinition',
    actions: ['view_list'],
    roleKey: 'ROLE_USER',
    conditions: [condition],
  });

  const roundTrip = (condition: PermissionCondition): PermissionCondition =>
    service.serialize(service.buildPermissionsArray([permissionWith(condition)]))[0].conditions[0];

  const conditionGroup = (permissions: FormArray): FormGroup =>
    (permissions.at(0).get('conditions') as FormArray).at(0) as FormGroup;

  beforeEach(() => {
    service = new AccessControlFormEditorService(new FormBuilder());
  });

  describe('like', () => {
    it('should save a value typed as a number or boolean as text', () => {
      const permissions = service.buildPermissionsArray([
        permissionWith({type: 'field', field: 'id.key', operator: 'like', value: 'x'}),
      ]);
      const condition = conditionGroup(permissions);

      condition.get('value')!.setValue('2024');
      expect(service.serialize(permissions)[0].conditions[0]).toEqual(
        jasmine.objectContaining({operator: 'like', value: '2024'})
      );

      condition.get('value')!.setValue('true');
      expect(service.serialize(permissions)[0].conditions[0]).toEqual(
        jasmine.objectContaining({operator: 'like', value: 'true'})
      );
    });

    it('should keep a stored text value that looks like a number as text when saved again', () => {
      expect(roundTrip({type: 'field', field: 'id.key', operator: 'like', value: '2024'})).toEqual(
        jasmine.objectContaining({value: '2024'})
      );
      expect(
        roundTrip({
          type: 'expression',
          field: 'content.content',
          path: '$.year',
          operator: 'like',
          value: '2024',
          clazz: 'java.lang.String',
        })
      ).toEqual(jasmine.objectContaining({value: '2024'}));
    });

    it('should keep a null value null', () => {
      expect(roundTrip({type: 'field', field: 'id.key', operator: 'like', value: null})).toEqual(
        jasmine.objectContaining({value: null})
      );
    });
  });

  it('should still read a number typed for other operators as a number', () => {
    const permissions = service.buildPermissionsArray([
      permissionWith({type: 'field', field: 'sequence', operator: '==', value: 1}),
    ]);
    conditionGroup(permissions).get('value')!.setValue('2024');

    expect(service.serialize(permissions)[0].conditions[0]).toEqual(
      jasmine.objectContaining({operator: '==', value: 2024})
    );
  });
});
