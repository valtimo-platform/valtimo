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
import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {CARBON_CONSTANTS} from '@valtimo/components';
import {LoadingModule, NotificationModule, NotificationService} from 'carbon-components-angular';
import {BehaviorSubject} from 'rxjs';
import {CaseProcessInstance, ProcessManagementContext, ProcessManagementParams} from '../../models';
import {ProcessManagementService} from '../../services';
import {ProcessManagementBuilderComponent} from '../process-management-builder/process-management-builder.component';
import {ProcessManagementListComponent} from '../process-management-list/process-management-list.component';
import {ProcessManagementUploadComponent} from '../process-management-upload/process-management-upload.component';

@Component({
  selector: 'valtimo-process-management',
  templateUrl: './process-management.component.html',
  styleUrls: ['./process-management.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ProcessManagementListComponent,
    ProcessManagementUploadComponent,
    ProcessManagementBuilderComponent,
    LoadingModule,
    NotificationModule,
  ],
  providers: [NotificationService, TranslateService],
})
export class ProcessManagementComponent {
  public readonly selectedProcess$ = new BehaviorSubject<CaseProcessInstance | null>(null);

  @Input() public set context(value: ProcessManagementContext) {
    this.processManagementService.context = value;
  }
  public readonly paramsAreSet$ = new BehaviorSubject<boolean>(false);
  @Input() public set params(value: ProcessManagementParams | null) {
    if (!value) return;

    this.processManagementService.setParams(value.definitionName, value.versionTag);
    this.paramsAreSet$.next(true);
  }

  constructor(
    private readonly notificationService: NotificationService,
    private readonly processManagementService: ProcessManagementService,
    private readonly translateService: TranslateService
  ) {}

  public navigateBack(notification: null | 'success' | 'error'): void {
    this.selectedProcess$.next(null);

    if (!notification) return;

    this.notificationService.showToast({
      caption: this.translateService.instant(`processManagement.${notification}Notification`),
      type: notification,
      duration: CARBON_CONSTANTS.notificationDuration,
      showClose: true,
      title: this.translateService.instant(`interface.${notification}`),
    });
  }

  public onProcessSelected(process: CaseProcessInstance): void {
    this.selectedProcess$.next(process);
  }
}
