/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import {ChangeDetectionStrategy, Component, EventEmitter, Output} from '@angular/core';
import {Upload16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  ActionItem,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  ViewType,
} from '@valtimo/components';
import {
  EditPermissionsService,
  EnvironmentService,
  getCaseManagementRouteParams,
  GlobalNotificationService,
} from '@valtimo/shared';
import {ProcessDefinition} from '@valtimo/process';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, Observable, switchMap, tap} from 'rxjs';
import {ProcessDefinitionResult} from '../../models';
import {ProcessManagementService, ProcessManagementStateService} from '../../services';
import {ActivatedRoute} from '@angular/router';
import {getContextObservable} from '../../utils';

@Component({
  selector: 'valtimo-process-management-list',
  templateUrl: './process-management-list.component.html',
  styleUrls: ['./process-management-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    CarbonListModule,
    IconModule,
    IconModule,
    TranslateModule,
    ConfirmationModalModule,
  ],
})
export class ProcessManagementListComponent {
  @Output() public readonly processSelected = new EventEmitter<
    ProcessDefinitionResult | 'create'
  >();

  public readonly context = this.processManagementService.context;
  public readonly processToDelete$ = new BehaviorSubject<ProcessDefinition | null>(null);
  public readonly showDeleteModal$ = new BehaviorSubject<boolean>(false);
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly ACTION_ITEMS: ActionItem[] = [
    {label: 'Delete', callback: this.onDeleteProcess.bind(this), type: 'danger'},
  ];

  public readonly context$ = getContextObservable(this.route);

  public readonly processDefinitions$: Observable<ProcessDefinitionResult[]> =
    this.processManagementStateService.reloadDefinitions$.pipe(
      tap(() => this.loading$.next(true)),
      switchMap(() => this.processManagementService.processes$),
      tap(() => this.loading$.next(false))
    );

  public readonly hasEditPermissions$: Observable<boolean> = combineLatest([
    getCaseManagementRouteParams(this.route),
    this.context$,
  ]).pipe(
    switchMap(([params, context]) => {
      return this.editPermissionsService.hasPermissionsToEditBasedOnContext(
        params?.caseDefinitionKey,
        params?.caseDefinitionVersionTag,
        context
      );
    })
  );

  public readonly FIELDS: ColumnConfig[] = [
    {key: 'processDefinition.name', label: 'processManagement.name'},
    {key: 'processDefinition.key', label: 'processManagement.key'},
    {
      key: 'processDefinition.readOnly',
      label: 'processManagement.readOnly',
      viewType: ViewType.BOOLEAN,
    },
    ...(this.processManagementService.context() === 'case'
      ? [
          {
            key: 'processCaseLink.canInitializeDocument',
            label: 'processManagement.canInitializeDocument',
            viewType: ViewType.BOOLEAN,
          },
        ]
      : []),
    ...(this.processManagementService.context() === 'case'
      ? [
          {
            key: 'processCaseLink.startableByUser',
            label: 'processManagement.startableByUser',
            viewType: ViewType.BOOLEAN,
          },
        ]
      : []),
  ];

  constructor(
    private readonly iconService: IconService,
    private readonly notificationService: GlobalNotificationService,
    private readonly processManagementService: ProcessManagementService,
    private readonly processManagementStateService: ProcessManagementStateService,
    private readonly translateService: TranslateService,
    private readonly environmentService: EnvironmentService,
    private readonly route: ActivatedRoute,
    private readonly editPermissionsService: EditPermissionsService
  ) {
    this.iconService.registerAll([Upload16]);
  }

  public editProcessDefinition(processDefinition: ProcessDefinitionResult): void {
    this.processSelected.emit(processDefinition);
  }

  public openModal(): void {
    this.processManagementStateService.openModal();
  }

  public onCreateProcess(): void {
    this.processSelected.emit('create');
  }

  public onDeleteConfirm(processDefinition: ProcessDefinition): void {
    (this.context() === 'case'
      ? this.processManagementService.deleteProcess(processDefinition.key)
      : this.processManagementService.deleteUnlinkedProcess(processDefinition.key)
    ).subscribe(() => {
      this.processManagementStateService.reloadDefinitions();

      this.notificationService.showToast({
        title: this.translateService.instant(`interface.delete`),
        caption: this.translateService.instant(`processManagement.deleteNotification`),
        type: 'success',
      });
    });
  }

  public onDeleteProcess(process: ProcessDefinitionResult): void {
    this.processToDelete$.next(process.processDefinition);
    this.showDeleteModal$.next(true);
  }
}
