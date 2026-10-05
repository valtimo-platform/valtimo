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

import {FormBuilder} from '@angular/forms';
import {of} from 'rxjs';
import {CaseDefinitionGroupCreateModalComponent} from './case-definition-group-create-modal.component';

describe('CaseDefinitionGroupCreateModalComponent', () => {
  let component: CaseDefinitionGroupCreateModalComponent;
  let groupService: jasmine.SpyObj<any>;

  beforeEach(() => {
    groupService = jasmine.createSpyObj('CaseDefinitionGroupManagementService', ['createGroup']);
    groupService.createGroup.and.returnValue(of({}));
    component = new CaseDefinitionGroupCreateModalComponent(new FormBuilder(), groupService);
  });

  const open = (): void => {
    component.open = true;
    component.ngOnChanges({open: {currentValue: true} as any});
  };

  describe('edit mode', () => {
    beforeEach(() => {
      component.group = {title: 'Group A', description: 'Description'};
    });

    it('is in edit mode when a group is set', () => {
      expect(component.isEditMode).toBeTrue();
    });

    it('prefills the form when opened', () => {
      open();

      expect(component.formGroup.value).toEqual({title: 'Group A', description: 'Description'});
    });

    it('prefills an empty description when the group has none', () => {
      component.group = {title: 'Group A'};
      open();

      expect(component.formGroup.value).toEqual({title: 'Group A', description: ''});
    });

    it('emits the edited values and closes without creating a group', () => {
      const saved: any[] = [];
      const closed: boolean[] = [];
      component.saveEvent.subscribe(value => saved.push(value));
      component.closeEvent.subscribe(value => closed.push(value));
      open();
      component.formGroup.patchValue({title: 'Renamed', description: ''});

      component.onCloseModal(true);

      expect(saved).toEqual([{title: 'Renamed', description: undefined}]);
      expect(closed).toEqual([true]);
      expect(groupService.createGroup).not.toHaveBeenCalled();
    });

    it('does not emit a save when cancelled', () => {
      const saved: any[] = [];
      component.saveEvent.subscribe(value => saved.push(value));
      open();

      component.onCloseModal();

      expect(saved).toEqual([]);
    });
  });

  describe('create mode', () => {
    it('is not in edit mode without a group', () => {
      expect(component.isEditMode).toBeFalse();
    });

    it('creates a group with the entered values', () => {
      const closed: boolean[] = [];
      component.closeEvent.subscribe(value => closed.push(value));
      component.formGroup.patchValue({title: 'New', description: 'Desc'});

      component.onCloseModal(true);

      expect(groupService.createGroup).toHaveBeenCalledWith({title: 'New', description: 'Desc'});
      expect(closed).toEqual([true]);
    });
  });
});
