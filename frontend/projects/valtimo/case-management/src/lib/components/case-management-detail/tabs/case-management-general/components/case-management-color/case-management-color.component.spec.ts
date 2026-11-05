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

import {of} from 'rxjs';
import {CaseManagementColorComponent} from './case-management-color.component';

describe('CaseManagementColorComponent', () => {
  let documentService: jasmine.SpyObj<any>;
  let pinnedItemsService: jasmine.SpyObj<any>;
  let menuService: jasmine.SpyObj<any>;
  let notificationService: jasmine.SpyObj<any>;
  let component: CaseManagementColorComponent;

  beforeEach(() => {
    documentService = jasmine.createSpyObj('DocumentService', [
      'getCaseSettingsForManagement',
      'patchCaseSettingsForManagement',
    ]);
    documentService.getCaseSettingsForManagement.and.returnValue(of({color: '#ff0000'}));
    documentService.patchCaseSettingsForManagement.and.returnValue(of({}));
    pinnedItemsService = jasmine.createSpyObj('PinnedItemsService', ['refresh']);
    menuService = jasmine.createSpyObj('MenuService', ['reload']);
    notificationService = jasmine.createSpyObj('GlobalNotificationService', ['showNotification']);

    component = new CaseManagementColorComponent(
      documentService,
      {
        snapshot: {params: {}},
        params: of({caseDefinitionKey: 'house', caseDefinitionVersionTag: '1.0.0'}),
        paramMap: of({get: () => null}),
        parent: null,
        pathFromRoot: [],
      } as any,
      pinnedItemsService,
      menuService,
      notificationService,
      {instant: (key: string) => key} as any
    );
    (component as any).params$ = of({caseDefinitionKey: 'house', caseDefinitionVersionTag: '1.0.0'});
  });

  it('saves a picked color, refreshes the menus and shows a toast', () => {
    component.onSwatchClick('#00ff00');

    expect(documentService.patchCaseSettingsForManagement).toHaveBeenCalledWith('house', '1.0.0', {
      color: '#00ff00',
    });
    expect(pinnedItemsService.refresh).toHaveBeenCalled();
    expect(menuService.reload).toHaveBeenCalled();
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      jasmine.objectContaining({type: 'success', title: 'caseManagement.color.saved'})
    );
  });

  it('sends a null color when the color is removed', () => {
    component.onClear();

    expect(documentService.patchCaseSettingsForManagement).toHaveBeenCalledWith('house', '1.0.0', {
      color: null,
    });
  });

  it('does not save when read only', () => {
    component.isReadOnly = true;

    component.onClear();

    expect(documentService.patchCaseSettingsForManagement).not.toHaveBeenCalled();
  });
});
