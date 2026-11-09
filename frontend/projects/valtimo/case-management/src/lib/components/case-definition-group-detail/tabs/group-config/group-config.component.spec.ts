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

import {BehaviorSubject, of} from 'rxjs';
import {GroupConfigComponent} from './group-config.component';

describe('GroupConfigComponent', () => {
  it('removes the color with a PUT that keeps the title and description', () => {
    const group = {key: 'g', title: 'Group', description: 'Desc', color: '#ff0000', members: []};
    const detailService = {
      group$: new BehaviorSubject(group),
      currentGroup: group,
      updateGroup: jasmine.createSpy('updateGroup').and.returnValue(of(group)),
    };
    const notificationService = jasmine.createSpyObj('GlobalNotificationService', [
      'showNotification',
    ]);
    const component = new GroupConfigComponent(
      detailService as any,
      {} as any,
      {} as any,
      {instant: (key: string) => key} as any,
      notificationService,
      {registerAll: () => {}} as any,
      {markForCheck: () => {}} as any
    );

    component.onClear();

    expect(component.selectedColor).toBe('');
    expect(detailService.updateGroup).toHaveBeenCalledWith({
      title: 'Group',
      description: 'Desc',
      color: null,
    });
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      jasmine.objectContaining({type: 'success', title: 'caseManagement.color.removed'})
    );
  });
});
