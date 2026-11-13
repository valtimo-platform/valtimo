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
import {HttpErrorResponse} from '@angular/common/http';
import {BehaviorSubject, of, throwError} from 'rxjs';
import {BuildingBlockManagementFormsComponent} from './building-block-management-forms.component';

describe('BuildingBlockManagementFormsComponent', () => {
  let component: BuildingBlockManagementFormsComponent;
  let showToast: jasmine.Spy;
  let deleteForm: jasmine.Spy;

  beforeEach(() => {
    showToast = jasmine.createSpy('showToast');
    deleteForm = jasmine.createSpy('deleteBuildingBlockFormDefinition');

    component = new BuildingBlockManagementFormsComponent(
      {
        isFinal$: new BehaviorSubject(false),
        buildingBlockDefinitionKey: 'case-review',
        buildingBlockDefinitionVersionTag: '1.0.0',
        reloadFormDefinitions: () => {},
      } as any,
      {deleteBuildingBlockFormDefinition: deleteForm} as any,
      {
        stream: () => of(''),
        instant: (key: string, params?: object) => (params ? key + JSON.stringify(params) : key),
      } as any,
      {registerAll: () => {}} as any,
      {} as any,
      {showToast} as any
    );
    component.onDeleteClick({id: 'form-1', name: 'f'} as any);
  });

  it('shows a single in-use toast listing the usages on a 409', () => {
    deleteForm.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: {usages: [{processDefinitionName: 'Case review', activityId: 'StartEvent'}]},
          })
      )
    );

    component.onDeleteConfirm();

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast.calls.mostRecent().args[0].title).toBe(
      'formManagement.notifications.deletionInUse{"usages":"Case review (StartEvent)"}'
    );
    expect(component.$loading()).toBeFalse();
  });

  it('shows the generic deletion error for other errors', () => {
    deleteForm.and.returnValue(throwError(() => new HttpErrorResponse({status: 500})));

    component.onDeleteConfirm();

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast.calls.mostRecent().args[0].title).toBe(
      'formManagement.notifications.deletionError'
    );
  });
});
