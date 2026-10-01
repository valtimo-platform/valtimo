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
import {GroupColumnModalComponent} from './group-column-modal.component';
import {GroupMember} from '../../../../../models';

describe('GroupColumnModalComponent', () => {
  let component: GroupColumnModalComponent;

  const members: GroupMember[] = [
    {caseDefinitionKey: 'bezwaar', caseDefinitionName: 'Bezwaar', order: 0},
    {caseDefinitionKey: 'auto-assign-test', caseDefinitionName: 'Auto assign test', order: 1},
    {caseDefinitionKey: 'case-messaging', caseDefinitionName: 'Case messaging', order: 2},
  ];

  beforeEach(() => {
    component = new GroupColumnModalComponent(
      new FormBuilder(),
      jasmine.createSpyObj('CaseDefinitionGroupManagementService', [
        'getListColumns',
        'updateListColumns',
      ]),
      jasmine.createSpyObj('TranslateService', ['instant']),
      jasmine.createSpyObj('GlobalNotificationService', ['showToast']),
      jasmine.createSpyObj('ChangeDetectorRef', ['markForCheck'])
    );
  });

  const setMembers = (): void => {
    component.members = members;
    component.ngOnChanges({members: {} as any});
  };

  describe('filledPathCount', () => {
    it('is 0 when no path controls are filled', () => {
      setMembers();

      expect(component.filledPathCount).toBe(0);
    });

    it('counts only controls with a non-blank value', () => {
      setMembers();
      component.pathControls[0].setValue('doc:/path');
      component.pathControls[1].setValue('   ');
      component.pathControls[2].setValue('doc:/other');

      expect(component.filledPathCount).toBe(2);
    });
  });

  describe('totalMemberCount', () => {
    it('reflects the number of members', () => {
      setMembers();

      expect(component.totalMemberCount).toBe(3);
    });
  });

  describe('displayedMembers', () => {
    beforeEach(() => setMembers());

    it('returns all members when there is no search term and showOnlyEmpty is false', () => {
      expect(component.displayedMembers.map(item => item.member.caseDefinitionKey)).toEqual([
        'bezwaar',
        'auto-assign-test',
        'case-messaging',
      ]);
    });

    it('filters by case definition name', () => {
      component.pathSearchControl.setValue('bezwaar');

      expect(component.displayedMembers.map(item => item.member.caseDefinitionKey)).toEqual([
        'bezwaar',
      ]);
    });

    it('filters by case definition key', () => {
      component.pathSearchControl.setValue('auto-assign');

      expect(component.displayedMembers.map(item => item.member.caseDefinitionKey)).toEqual([
        'auto-assign-test',
      ]);
    });

    it('is case insensitive and trims whitespace', () => {
      component.pathSearchControl.setValue('  BEZWAAR  ');

      expect(component.displayedMembers.map(item => item.member.caseDefinitionKey)).toEqual([
        'bezwaar',
      ]);
    });

    it('returns an empty list when no member matches the search term', () => {
      component.pathSearchControl.setValue('does-not-exist');

      expect(component.displayedMembers.length).toBe(0);
    });

    it('preserves the original member index for each displayed item', () => {
      component.pathSearchControl.setValue('case-messaging');

      expect(component.displayedMembers[0].index).toBe(2);
    });

    it('only shows members with an empty path when showOnlyEmpty is true', () => {
      component.pathControls[0].setValue('doc:/path');
      component.onShowOnlyEmptyChange(true);

      expect(component.displayedMembers.map(item => item.member.caseDefinitionKey)).toEqual([
        'auto-assign-test',
        'case-messaging',
      ]);
    });

    it('combines the search term and the showOnlyEmpty filter', () => {
      component.pathControls[1].setValue('doc:/path');
      component.onShowOnlyEmptyChange(true);
      component.pathSearchControl.setValue('case-messaging');

      expect(component.displayedMembers.map(item => item.member.caseDefinitionKey)).toEqual([
        'case-messaging',
      ]);
    });
  });

  describe('onShowOnlyEmptyChange', () => {
    it('updates showOnlyEmpty and requests change detection', () => {
      component.onShowOnlyEmptyChange(true);

      expect(component.showOnlyEmpty).toBe(true);
      expect((component as any).cdr.markForCheck).toHaveBeenCalled();
    });
  });

  describe('trackByMember', () => {
    it('returns the case definition key of the item', () => {
      setMembers();

      expect(component.trackByMember(0, component.displayedMembers[1])).toBe(
        'auto-assign-test'
      );
    });

    it('returns a stable value for the same member across recomputed arrays', () => {
      setMembers();
      const first = component.displayedMembers[0];
      const second = component.displayedMembers[0];

      expect(component.trackByMember(0, first)).toBe(component.trackByMember(0, second));
    });
  });

  describe('default sort removal', () => {
    it('does not include a defaultSort control in the form group', () => {
      expect(component.formGroup.get('defaultSort')).toBeNull();
    });

    it('does not include defaultSort in the built save request', () => {
      setMembers();
      component.groupKey = 'group-1';
      component.formGroup.patchValue({key: 'my-key', displayType: 'text'});

      const request = (component as any)._buildRequest();

      expect(request.hasOwnProperty('defaultSort')).toBe(false);
    });
  });
});
