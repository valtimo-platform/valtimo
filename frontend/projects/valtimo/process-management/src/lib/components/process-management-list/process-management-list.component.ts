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
import {TranslateModule} from '@ngx-translate/core';
import {
  ActionItem,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  ViewType,
} from '@valtimo/components';
import {ProcessDefinition} from '@valtimo/process';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {BehaviorSubject, map, Observable, switchMap, take, tap} from 'rxjs';
import {CaseProcessInstance} from '../../models';
import {ProcessManagementService, ProcessManagementStateService} from '../../services';

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
  @Output() public readonly processSelected = new EventEmitter<CaseProcessInstance | 'create'>();

  public readonly processToDelete$ = new BehaviorSubject<ProcessDefinition | null>(null);
  public readonly showDeleteModal$ = new BehaviorSubject<boolean>(false);
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly ACTION_ITEMS: ActionItem[] = [
    {
      label: 'Delete',
      callback: this.onDeleteProcess.bind(this),
      type: 'danger',
    },
  ];

  public readonly processDefinitions$: Observable<CaseProcessInstance[]> =
    this.processManagementStateService.reloadDefinitions$.pipe(
      tap(() => this.loading$.next(true)),
      switchMap(() => this.processManagementService.processes$),
      tap(() => this.loading$.next(false))
    );

  public readonly FIELDS: ColumnConfig[] = [
    {key: 'processDefinition.name', label: 'Name'},
    {key: 'processDefinition.key', label: 'Key'},
    {key: 'processDefinition.readOnly', label: 'Read-only', viewType: ViewType.BOOLEAN},
  ];

  constructor(
    private readonly processManagementService: ProcessManagementService,
    private readonly processManagementStateService: ProcessManagementStateService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Upload16]);
  }

  public editProcessDefinition(processDefinition: CaseProcessInstance): void {
    this.processSelected.emit(processDefinition);
  }

  public openModal(): void {
    this.processManagementStateService.openModal();
  }

  public onCreateProcess(): void {
    this.processSelected.emit('create');
  }

  public onDeleteConfirm(processDefinition: ProcessDefinition): void {
    this.processManagementService
      .deleteProcess(processDefinition.key)
      .pipe(take(1))
      .subscribe(() => {
        this.processManagementStateService.reloadDefinitions();
      });
  }

  public onDeleteProcess(process: CaseProcessInstance): void {
    this.processToDelete$.next(process.processDefinition);
    this.showDeleteModal$.next(true);
  }
}
