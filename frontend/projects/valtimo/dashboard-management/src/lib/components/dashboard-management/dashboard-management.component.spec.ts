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
import {Router} from '@angular/router';
import {BehaviorSubject, of} from 'rxjs';
import {DashboardItem} from '../../models';
import {DashboardManagementService} from '../../services/dashboard-management.service';
import {DashboardManagementComponent} from './dashboard-management.component';

describe('DashboardManagementComponent', () => {
  let component: DashboardManagementComponent;
  let service: jasmine.SpyObj<DashboardManagementService>;

  beforeEach(() => {
    service = jasmine.createSpyObj<DashboardManagementService>(
      'DashboardManagementService',
      ['loadData', 'createDashboard', 'dispatchAction'],
      {
        dashboards$: new BehaviorSubject<{items: DashboardItem[] | null; loading: boolean}>({
          items: [
            {key: 'existing', title: 'Existing', description: 'd'},
            {key: '', title: '2026', description: 'legacy empty key'},
          ],
          loading: false,
        }),
      }
    );
    service.createDashboard.and.returnValue(of({} as DashboardItem));

    component = new DashboardManagementComponent(
      service,
      new FormBuilder(),
      jasmine.createSpyObj<Router>('Router', ['navigate'])
    );
    component.ngOnInit();
  });

  it('should keep the create form invalid while the key is empty', () => {
    component.form.patchValue({title: '2026', description: 'desc', key: ''});

    expect(component.form.invalid).toBeTrue();
  });

  it('should make the create form valid once a key is given', () => {
    component.form.patchValue({title: '2026', description: 'desc', key: 'dashboard-2026'});

    expect(component.form.valid).toBeTrue();
  });

  it('should provide the keys of existing dashboards as used keys', done => {
    component.usedKeys$.subscribe(keys => {
      expect(keys).toEqual(['existing']);
      done();
    });
  });

  it('should not create a dashboard while the key is empty', () => {
    component.form.patchValue({title: '2026', description: 'desc', key: ''});

    component.createDashboard();

    expect(service.createDashboard).not.toHaveBeenCalled();
  });

  it('should send the key when creating a dashboard', () => {
    component.form.patchValue({title: '2026', description: 'desc', key: 'dashboard-2026'});

    component.createDashboard();

    expect(service.createDashboard).toHaveBeenCalledWith({
      title: '2026',
      description: 'desc',
      key: 'dashboard-2026',
    });
  });
});
