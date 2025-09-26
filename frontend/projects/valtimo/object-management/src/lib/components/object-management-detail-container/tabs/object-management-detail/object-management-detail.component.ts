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

import {Component, Input} from '@angular/core';
import {Objecttype} from '../../../../models/object-management.model';
import {ObjectManagementService} from '../../../../services/object-management.service';
import {ObjectManagementStateService} from '../../../../services/object-management-state.service';
import {BehaviorSubject, Observable} from 'rxjs';

@Component({
  selector: 'valtimo-object-management-detail',
  templateUrl: './object-management-detail.component.html',
  styleUrls: ['./object-management-detail.component.scss'],
})
export class ObjectManagementDetailComponent {
  @Input() object$: Observable<Objecttype>;
  readonly loading$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly objectManagementService: ObjectManagementService,
    private readonly objectManagementState: ObjectManagementStateService
  ) {}

  downloadDefinition(object): void {
    this.loading$.next(true);
    const dataString =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(object, null, 2));
    const downloadAnchorElement = document.getElementById('downloadAnchorElement');
    downloadAnchorElement.setAttribute('href', dataString);
    downloadAnchorElement.setAttribute('download', `${object.id}.json`);
    downloadAnchorElement.click();
    this.loading$.next(false);
  }

  showEditModal(): void {
    this.loading$.next(true);
    this.objectManagementState.setModalType('edit');
    this.objectManagementState.showModal();
    this.loading$.next(false);
  }
}
