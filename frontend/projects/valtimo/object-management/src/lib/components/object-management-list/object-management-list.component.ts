/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import {Component} from '@angular/core';
import {BehaviorSubject, combineLatest, Observable} from 'rxjs';
import {switchMap, tap} from 'rxjs/operators';
import {TranslateService} from '@ngx-translate/core';
import {ObjectManagementService} from '../../services/object-management.service';
import {Objecttype} from '../../models/object-management.model';
import {ObjectManagementStateService} from '../../services/object-management-state.service';
import {Router} from '@angular/router';

@Component({
  selector: 'valtimo-object-management-list',
  templateUrl: './object-management-list.component.html',
  styleUrls: ['./object-management-list.component.scss'],
})
export class ObjectManagementListComponent {
  readonly loading$ = new BehaviorSubject<boolean>(true);

  readonly fields$ = new BehaviorSubject<Array<{key: string; label: string}>>([]);

  readonly objecttypesInstances$: Observable<Array<Objecttype>> = combineLatest([
    this.translateService.stream('key'),
    this.objectManagementState.refresh$,
  ]).pipe(
    tap(() => this.setFields()),
    switchMap(() => this.objectManagementService.getAllObjects()),
    tap(() => this.loading$.next(false))
  );

  constructor(
    private readonly objectManagementService: ObjectManagementService,
    private readonly objectManagementState: ObjectManagementStateService,
    private readonly translateService: TranslateService,
    private router: Router
  ) {}

  showAddModal(): void {
    this.objectManagementState.setModalType('add');
    this.objectManagementState.showModal();
  }

  showUploadModal(): void {
    this.objectManagementState.setModalType('upload');
    this.objectManagementState.showModal();
  }

  redirectToDetails(objectManagement: Objecttype) {
    this.router.navigate(['/object-management/object', objectManagement.id]);
  }

  private setFields(): void {
    const keys: Array<string> = ['title'];
    this.fields$.next(
      keys.map(key => ({
        label: `${this.translateService.instant(`objectManagement.labels.${key}`)}`,
        key,
      }))
    );
  }
}
