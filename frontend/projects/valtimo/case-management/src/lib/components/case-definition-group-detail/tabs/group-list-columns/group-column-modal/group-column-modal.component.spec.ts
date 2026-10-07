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
      jasmine.createSpyObj('TranslateService', {instant: '', stream: of({})}),
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

    it('keeps an empty member visible while its path is being filled in', () => {
      component.onShowOnlyEmptyChange(true);
      component.pathControls[1].setValue('doc:/p');

      expect(component.displayedMembers.map(item => item.member.caseDefinitionKey)).toContain(
        'auto-assign-test'
      );
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

      expect(component.trackByMember(0, component.displayedMembers[1])).toBe('auto-assign-test');
    });

    it('returns a stable value for the same member across recomputed arrays', () => {
      setMembers();
      const first = component.displayedMembers[0];
      const second = component.displayedMembers[0];

      expect(component.trackByMember(0, first)).toBe(component.trackByMember(0, second));
    });
  });

  describe('sorting', () => {
    const groupService = (): jasmine.SpyObj<any> => (component as any).groupService;

    beforeEach(() => {
      setMembers();
      component.ngOnInit();
    });

    it('cannot sort when no path is filled', () => {
      expect(component.canSort).toBe(false);
    });

    it('can sort when all paths are the same whitelisted case field', () => {
      component.pathControls[0].setValue('case:createdOn');
      component.pathControls[1].setValue('case:createdOn');

      expect(component.canSort).toBe(true);
      expect(component.formGroup.get('sortable')?.enabled).toBe(true);
    });

    it('cannot sort on document paths', () => {
      component.pathControls[0].setValue('doc:/street');

      expect(component.canSort).toBe(false);
      expect(component.formGroup.get('sortable')?.disabled).toBe(true);
    });

    it('cannot sort on mixed case paths', () => {
      component.pathControls[0].setValue('case:createdOn');
      component.pathControls[1].setValue('case:modifiedOn');

      expect(component.canSort).toBe(false);
    });

    it('cannot sort on a case field that is not whitelisted', () => {
      component.pathControls[0].setValue('case:assignedTeamKey');

      expect(component.canSort).toBe(false);
    });

    it('unchecks sortable when the paths stop being sortable', () => {
      component.pathControls[0].setValue('case:createdOn');
      component.formGroup.get('sortable')?.setValue(true);
      component.pathControls[1].setValue('doc:/street');

      expect(component.formGroup.get('sortable')?.value).toBe(false);
    });

    it('enables the default sort only when sortable', () => {
      component.pathControls[0].setValue('case:createdOn');
      component.formGroup.get('sortable')?.setValue(false);

      expect(component.formGroup.get('defaultSort')?.disabled).toBe(true);

      component.formGroup.get('sortable')?.setValue(true);

      expect(component.formGroup.get('defaultSort')?.enabled).toBe(true);
    });

    it('disables the default sort when another column already has one', () => {
      groupService().getListColumns.and.returnValue(
        of([{key: 'other', defaultSort: 'ASC', sortable: true}])
      );
      component.groupKey = 'group-1';
      component.open = true;
      component.ngOnChanges({open: {} as any});
      component.pathControls[0].setValue('case:createdOn');
      component.formGroup.get('sortable')?.setValue(true);

      expect(component.otherColumnHasDefaultSort).toBe(true);
      expect(component.formGroup.get('defaultSort')?.disabled).toBe(true);
    });

    it('includes the selected default sort in the save request', () => {
      component.pathControls[0].setValue('case:createdOn');
      component.formGroup.patchValue({key: 'my-key', displayType: 'text', sortable: true});
      component.formGroup.get('defaultSort')?.setValue('DESC');

      const request = (component as any)._buildRequest();

      expect(request.sortable).toBe(true);
      expect(request.defaultSort).toBe('DESC');
    });

    it('sends no default sort or sortable for non sortable paths', () => {
      component.pathControls[0].setValue('doc:/street');
      component.formGroup.patchValue({key: 'my-key', displayType: 'text'});

      const request = (component as any)._buildRequest();

      expect(request.sortable).toBe(false);
      expect(request.defaultSort).toBeUndefined();
    });

    it('trims paths and drops whitespace only paths in the save request', () => {
      component.pathControls[0].setValue('case:createdOn ');
      component.pathControls[1].setValue('   ');
      component.pathControls[2].setValue(' case:createdOn');
      component.formGroup.patchValue({key: 'my-key', displayType: 'text', sortable: true});

      const request = (component as any)._buildRequest();

      expect(request.sortable).toBe(true);
      expect(request.pathMappings).toEqual([
        {caseDefinitionKey: 'bezwaar', path: 'case:createdOn'},
        {caseDefinitionKey: 'case-messaging', path: 'case:createdOn'},
      ]);
    });

    it('sends the default sort of every column when saving', () => {
      groupService().getListColumns.and.returnValue(
        of([
          {
            key: 'a',
            displayType: {type: 'text'},
            sortable: true,
            defaultSort: 'ASC',
            pathMappings: [{caseDefinitionKey: 'bezwaar', path: 'case:createdOn'}],
          },
          {
            key: 'b',
            displayType: {type: 'text'},
            sortable: true,
            defaultSort: 'DESC',
            pathMappings: [{caseDefinitionKey: 'bezwaar', path: 'doc:/street'}],
          },
          {key: 'c', displayType: {type: 'text'}, sortable: false, exportable: true},
        ])
      );
      groupService().updateListColumns.and.returnValue(of([]));
      component.groupKey = 'group-1';
      component.column = {key: 'c', displayType: {type: 'text'}, sortable: false, exportable: true};
      component.pathControls[0].setValue('doc:/other');
      component.formGroup.patchValue({key: 'c', displayType: 'text'});

      component.onCloseModal(true);

      const sent = groupService().updateListColumns.calls.mostRecent().args[1];
      expect(sent.map((c: any) => c.defaultSort)).toEqual(['ASC', undefined, undefined]);
      expect(sent.map((c: any) => c.sortable)).toEqual([true, false, false]);
    });

    describe('reopening the modal', () => {
      const pathMappings = (...paths: string[]) =>
        paths.map((path, index) => ({caseDefinitionKey: members[index].caseDefinitionKey, path}));

      const docColumn = {
        key: 'doc',
        displayType: {type: 'text'},
        sortable: false,
        exportable: true,
        pathMappings: pathMappings('doc:/a', 'doc:/b', 'doc:/c'),
      } as any;

      const sortableColumn = {
        key: 'sortable',
        displayType: {type: 'text'},
        sortable: true,
        defaultSort: 'ASC',
        exportable: true,
        pathMappings: pathMappings('case:createdOn', 'case:createdOn', 'case:createdOn'),
      } as any;

      const openModal = (column: any): void => {
        component.column = column;
        component.open = true;
        component.ngOnChanges({open: {} as any, column: {} as any});
      };

      const closeModal = (): void => {
        component.open = false;
        component.column = null;
        component.ngOnChanges({open: {} as any, column: {} as any});
      };

      const echoPathsInOrder = (column: any): void => {
        column.pathMappings.forEach((mapping: any, index: number) =>
          component.pathControls[index].setValue(mapping.path)
        );
      };

      it('keeps sortable and default sort when paths are applied one by one after a document column', () => {
        openModal(docColumn);
        closeModal();
        openModal(sortableColumn);
        component.pathControls.forEach((control, index) =>
          control.setValue(docColumn.pathMappings[index].path)
        );
        echoPathsInOrder(sortableColumn);

        expect(component.canSort).toBe(true);
        expect(component.formGroup.get('sortable')?.enabled).toBe(true);
        expect(component.formGroup.get('sortable')?.value).toBe(true);
        expect(component.formGroup.get('defaultSort')?.value).toBe('ASC');
      });

      it('keeps sortable and default sort when the same column is opened twice', () => {
        openModal(sortableColumn);
        closeModal();
        openModal(sortableColumn);

        expect(component.formGroup.get('sortable')?.value).toBe(true);
        expect(component.formGroup.get('defaultSort')?.value).toBe('ASC');
      });

      it('restores the chosen sort once the paths become sortable again', () => {
        openModal(sortableColumn);
        component.formGroup.get('defaultSort')?.setValue('DESC');

        component.pathControls[1].setValue('doc:/x');

        expect(component.formGroup.get('sortable')?.value).toBe(false);
        expect(component.formGroup.get('sortable')?.disabled).toBe(true);
        expect((component as any)._buildRequest().sortable).toBe(false);

        component.pathControls[1].setValue('case:createdOn');

        expect(component.formGroup.get('sortable')?.value).toBe(true);
        expect(component.formGroup.get('defaultSort')?.value).toBe('DESC');
      });

      it('keeps the same default sort items between openings', () => {
        const items = component.defaultSortItems;

        openModal(sortableColumn);
        closeModal();
        openModal(docColumn);

        expect(component.defaultSortItems).toBe(items);
        expect(items.map(item => item.value)).toEqual(['none', 'ASC', 'DESC']);
      });
    });
  });
});
