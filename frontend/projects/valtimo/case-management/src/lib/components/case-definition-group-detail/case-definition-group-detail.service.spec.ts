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

import {PinnedItemType} from '@valtimo/case';
import {of} from 'rxjs';
import {CaseDefinitionGroupResponse, CaseDefinitionGroupWithMembersResponse} from '../../models';
import {CaseDefinitionGroupDetailService} from './case-definition-group-detail.service';

describe('CaseDefinitionGroupDetailService', () => {
  const group: CaseDefinitionGroupWithMembersResponse = {
    key: 'group-a',
    title: 'Group A',
    description: 'Description',
    color: '#ff0000',
    order: 1,
    members: [{caseDefinitionKey: 'bezwaar', order: 0}],
    createdBy: 'admin',
    createdOn: '2026-01-01T00:00:00',
  };

  let managementService: jasmine.SpyObj<any>;
  let pinnedItemsService: jasmine.SpyObj<any>;
  let service: CaseDefinitionGroupDetailService;
  let current: CaseDefinitionGroupWithMembersResponse | null;

  const toResponse = (request: {
    title: string;
    description?: string;
    color?: string;
  }): CaseDefinitionGroupResponse => ({
    key: group.key,
    title: request.title,
    description: request.description,
    color: request.color,
    order: group.order,
    memberCount: 1,
    createdBy: group.createdBy,
    createdOn: group.createdOn,
  });

  beforeEach(() => {
    managementService = jasmine.createSpyObj('CaseDefinitionGroupManagementService', [
      'getGroup',
      'updateGroup',
    ]);
    managementService.getGroup.and.returnValue(of(group));
    managementService.updateGroup.and.callFake((_key: string, request: any) =>
      of(toResponse(request))
    );
    pinnedItemsService = jasmine.createSpyObj('PinnedItemsService', ['isPinned', 'refresh']);
    pinnedItemsService.isPinned.and.returnValue(false);
    service = new CaseDefinitionGroupDetailService(managementService, pinnedItemsService);
    service.group$.subscribe(value => (current = value));
  });

  it('loads the group', () => {
    service.loadGroup('group-a');

    expect(managementService.getGroup).toHaveBeenCalledWith('group-a');
    expect(current).toEqual(group);
  });

  it('reloads the current group', () => {
    service.loadGroup('group-a');
    service.reloadGroup();

    expect(managementService.getGroup).toHaveBeenCalledTimes(2);
  });

  it('does not reload when no group is loaded', () => {
    service.reloadGroup();

    expect(managementService.getGroup).not.toHaveBeenCalled();
  });

  it('merges the update response and keeps the members', () => {
    service.loadGroup('group-a');

    service.updateGroup({title: 'Renamed', description: 'New', color: '#ff0000'}).subscribe();

    expect(managementService.updateGroup).toHaveBeenCalledWith('group-a', {
      title: 'Renamed',
      description: 'New',
      color: '#ff0000',
    });
    expect(current?.title).toBe('Renamed');
    expect(current?.description).toBe('New');
    expect(current?.members).toEqual(group.members);
  });

  it('keeps the new title when the color is changed afterwards', () => {
    service.loadGroup('group-a');
    service
      .updateGroup({title: 'Renamed', description: 'Description', color: '#ff0000'})
      .subscribe();

    const latest = service.currentGroup;
    service
      .updateGroup({title: latest?.title ?? '', description: latest?.description, color: '#00ff00'})
      .subscribe();

    expect(managementService.updateGroup).toHaveBeenCalledWith('group-a', {
      title: 'Renamed',
      description: 'Description',
      color: '#00ff00',
    });
    expect(current?.title).toBe('Renamed');
    expect(current?.color).toBe('#00ff00');
  });

  it('refreshes the pinned menu items when the updated group is pinned', () => {
    pinnedItemsService.isPinned.and.returnValue(true);
    service.loadGroup('group-a');

    service.updateGroup({title: 'Group A', color: '#00ff00'}).subscribe();

    expect(pinnedItemsService.isPinned).toHaveBeenCalledWith(
      PinnedItemType.CASE_DEFINITION_GROUP,
      'group-a'
    );
    expect(pinnedItemsService.refresh).toHaveBeenCalled();
  });

  it('does not refresh the pinned menu items when the group is not pinned', () => {
    service.loadGroup('group-a');

    service.updateGroup({title: 'Group A', color: '#00ff00'}).subscribe();

    expect(pinnedItemsService.refresh).not.toHaveBeenCalled();
  });

  it('errors when updating without a loaded group', () => {
    let failed = false;

    service.updateGroup({title: 'x'}).subscribe({error: () => (failed = true)});

    expect(failed).toBeTrue();
    expect(managementService.updateGroup).not.toHaveBeenCalled();
  });
});
