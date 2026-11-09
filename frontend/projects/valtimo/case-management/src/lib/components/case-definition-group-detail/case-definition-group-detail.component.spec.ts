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

import {of, Subject} from 'rxjs';
import {CaseDefinitionGroupDetailComponent} from './case-definition-group-detail.component';

describe('CaseDefinitionGroupDetailComponent', () => {
  it('redirects to the case groups tab with an info toast when the group does not exist', () => {
    const groupNotFound$ = new Subject<string>();
    const detailService = {
      group$: of(null),
      showNoListColumnsWarning$: of(false),
      groupNotFound$,
      loadGroup: jasmine.createSpy('loadGroup'),
    };
    const router = jasmine.createSpyObj('Router', ['navigate'], {events: of()});
    const notificationService = jasmine.createSpyObj('GlobalNotificationService', [
      'showNotification',
    ]);
    const translateService = jasmine.createSpyObj('TranslateService', ['get']);
    translateService.get.and.callFake((key: string) => of(`translated:${key}`));
    const breadcrumbService = jasmine.createSpyObj('BreadcrumbService', [
      'setSecondBreadcrumb',
      'clearSecondBreadcrumb',
    ]);
    const iconService = jasmine.createSpyObj('IconService', ['registerAll']);
    const pageHeaderService = {compactMode$: of(false)};
    const pageTitleService = jasmine.createSpyObj('PageTitleService', [
      'setCustomPageTitle',
      'enableReset',
    ]);

    const component = new CaseDefinitionGroupDetailComponent(
      {params: of({groupKey: 'missing'}), firstChild: null, snapshot: {params: {}}} as any,
      router,
      detailService as any,
      pageTitleService,
      breadcrumbService,
      pageHeaderService as any,
      iconService,
      {} as any,
      notificationService,
      translateService,
      jasmine.createSpyObj('PinnedItemsService', ['refresh']),
      {} as any
    );

    component.ngOnInit();
    groupNotFound$.next('missing');

    expect(router.navigate).toHaveBeenCalledWith(['/case-management'], {
      queryParams: {tab: 'groups'},
      replaceUrl: true,
    });
    expect(notificationService.showNotification).toHaveBeenCalledWith({
      type: 'info',
      title: 'translated:caseManagement.groups.notFound',
      duration: 5000,
    });
    component.ngOnDestroy();
  });

  describe('delete', () => {
    const setup = () => {
      const groupService = jasmine.createSpyObj('CaseDefinitionGroupManagementService', [
        'deleteGroup',
      ]);
      groupService.deleteGroup.and.returnValue(of(undefined));
      const router = jasmine.createSpyObj('Router', ['navigate'], {events: of()});
      const notificationService = jasmine.createSpyObj('GlobalNotificationService', [
        'showNotification',
      ]);
      const translateService = jasmine.createSpyObj('TranslateService', ['instant']);
      translateService.instant.and.callFake((key: string) => `translated:${key}`);
      const pinnedItemsService = jasmine.createSpyObj('PinnedItemsService', ['refresh']);

      const component = new CaseDefinitionGroupDetailComponent(
        {params: of({}), firstChild: null, snapshot: {params: {groupKey: 'my_group'}}} as any,
        router,
        {group$: of(null), showNoListColumnsWarning$: of(false)} as any,
        {} as any,
        {} as any,
        {compactMode$: of(false)} as any,
        jasmine.createSpyObj('IconService', ['registerAll']),
        groupService,
        notificationService,
        translateService,
        pinnedItemsService,
        {} as any
      );

      return {component, groupService, router, notificationService, pinnedItemsService};
    };

    it('opens the confirmation when the delete button is used', () => {
      const {component, groupService} = setup();
      let opened = false;
      component.showDeleteModal$.subscribe(value => (opened = value));

      component.openDeleteModal();

      expect(opened).toBeTrue();
      expect(groupService.deleteGroup).not.toHaveBeenCalled();
    });

    it('deletes the group, refreshes the pins, redirects and shows a toast on confirm', () => {
      const {component, groupService, router, notificationService, pinnedItemsService} = setup();

      component.onConfirmDeleteGroup();

      expect(groupService.deleteGroup).toHaveBeenCalledWith('my_group');
      expect(pinnedItemsService.refresh).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/case-management'], {
        queryParams: {tab: 'groups'},
        replaceUrl: true,
      });
      expect(notificationService.showNotification).toHaveBeenCalledWith({
        type: 'success',
        title: 'translated:caseManagement.groups.delete.success',
        duration: 5000,
      });
    });
  });
});
