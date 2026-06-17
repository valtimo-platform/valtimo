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

import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import {Add16, Edit16, TrashCan16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {ConfirmationModalModule} from '@valtimo/components';
import {ProcessDiagramComponent} from '@valtimo/process';
import {GlobalNotificationService} from '@valtimo/shared';
import {
  ButtonModule,
  IconModule,
  IconService,
  LayerModule,
  LinkModule,
  StructuredListModule,
  TabsModule,
  TagModule,
} from 'carbon-components-angular';
import {BehaviorSubject, Observable} from 'rxjs';
import {
  BuildingBlockProcessReference,
  ProcessDetailTab,
  ProcessInstanceInspection,
  ProcessVariable,
  ProcessVariableMutationRequest,
} from '../../../../models';
import {CaseInspectionService} from '../../../../services';
import {CaseInspectionProcessVariableModalComponent} from '../process-variable-modal/process-variable-modal.component';

@Component({
  standalone: true,
  selector: 'valtimo-case-inspection-process-detail',
  templateUrl: './process-detail.component.html',
  styleUrl: './process-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    IconModule,
    LinkModule,
    StructuredListModule,
    TabsModule,
    TagModule,
    ProcessDiagramComponent,
    CaseInspectionProcessVariableModalComponent,
    ConfirmationModalModule,
    LayerModule,
  ],
})
export class CaseInspectionProcessDetailComponent {
  @Input() public set row(value: ProcessInstanceInspection) {
    this._row = value;
    this.$row.set(value);
  }
  public get row(): ProcessInstanceInspection {
    return this._row;
  }

  @Input() public documentId = '';
  @Input() public set canInspectModify(value: boolean) {
    this.$canInspectModify.set(value);
  }

  @Output() public readonly viewBuildingBlockEvent =
    new EventEmitter<BuildingBlockProcessReference>();
  @Output() public readonly variablesChangedEvent = new EventEmitter<void>();
  @Output() public readonly viewProcessLogsEvent = new EventEmitter<string>();

  public readonly $activeTab = signal<ProcessDetailTab>(ProcessDetailTab.DETAILS);
  public readonly ProcessDetailTab = ProcessDetailTab;

  public readonly incidentColumns: readonly string[] = [
    'case.inspection.processes.incidentType',
    'case.inspection.processes.activity',
    'case.inspection.processes.message',
    'case.inspection.processes.timestamp',
  ];

  public readonly taskColumns: readonly string[] = [
    'case.inspection.processes.taskName',
    'case.inspection.processes.taskAssignee',
    'case.inspection.processes.taskCreated',
  ];

  public readonly variableColumns: readonly string[] = [
    'case.inspection.processes.variableName',
    'case.inspection.processes.variableType',
    'case.inspection.processes.variableValue',
  ];

  public readonly jobColumns: readonly string[] = [
    'case.inspection.processes.jobType',
    'case.inspection.processes.jobActivity',
    'case.inspection.processes.jobRetries',
    'case.inspection.processes.jobDueDate',
    'case.inspection.processes.jobException',
  ];

  public readonly $modalOpen = signal<boolean>(false);
  public readonly $modalMode = signal<'create' | 'edit'>('create');
  public readonly $modalInitial = signal<ProcessVariable | null>(null);
  public readonly $row = signal<ProcessInstanceInspection | null>(null);
  public readonly $canInspectModify = signal<boolean>(false);
  public readonly $canMutate = computed(() => this.$canInspectModify() && !!this.$row()?.active);

  public readonly showConfirmDelete$ = new BehaviorSubject<boolean>(false);

  public readonly pendingDeleteName$: Observable<string | null>;

  private _row!: ProcessInstanceInspection;
  private readonly _pendingDelete$ = new BehaviorSubject<ProcessVariable | null>(null);

  constructor(
    private readonly caseInspectionService: CaseInspectionService,
    private readonly notificationService: GlobalNotificationService,
    private readonly translateService: TranslateService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Add16, Edit16, TrashCan16]);
    this.pendingDeleteName$ = new Observable<string | null>(subscriber => {
      const sub = this._pendingDelete$.subscribe(v => subscriber.next(v?.name ?? null));
      return () => sub.unsubscribe();
    });
  }

  public onSelectTab(tab: ProcessDetailTab): void {
    this.$activeTab.set(tab);
  }

  public onViewBuildingBlock(bb: BuildingBlockProcessReference): void {
    this.viewBuildingBlockEvent.emit(bb);
  }

  public onViewProcessLogs(): void {
    this.viewProcessLogsEvent.emit(this.row.processInstanceId);
  }

  public formatVariableValue(variable: ProcessVariable): string {
    if (variable.value === null || variable.value === undefined) {
      return '—';
    }
    if (typeof variable.value === 'object') {
      try {
        return JSON.stringify(variable.value);
      } catch {
        return '[unserializable]';
      }
    }
    return String(variable.value);
  }

  public onAddVariable(): void {
    this.$modalMode.set('create');
    this.$modalInitial.set(null);
    this.$modalOpen.set(true);
  }

  public onEditVariable(variable: ProcessVariable): void {
    this.$modalMode.set('edit');
    this.$modalInitial.set(variable);
    this.$modalOpen.set(true);
  }

  public onRequestDelete(variable: ProcessVariable): void {
    this._pendingDelete$.next(variable);
    this.showConfirmDelete$.next(true);
  }

  public onConfirmDelete(): void {
    const variable = this._pendingDelete$.value;
    if (!variable) return;

    this.caseInspectionService
      .deleteProcessVariable(this.documentId, this.row.processInstanceId, variable.name)
      .subscribe({
        next: () => {
          this.notifySuccess(
            'case.inspection.processes.variableActions.deletedToast',
            variable.name
          );
          this._pendingDelete$.next(null);
          this.variablesChangedEvent.emit();
        },
        error: () => {
          this._pendingDelete$.next(null);
        },
      });
  }

  public onCancelDelete(): void {
    this._pendingDelete$.next(null);
  }

  public onModalClosed(request: ProcessVariableMutationRequest | null): void {
    this.$modalOpen.set(false);
    if (!request) return;

    const mode = this.$modalMode();
    if (mode === 'create') {
      this.caseInspectionService
        .createProcessVariable(this.documentId, this.row.processInstanceId, request)
        .subscribe({
          next: () => {
            this.notifySuccess(
              'case.inspection.processes.variableActions.createdToast',
              request.name
            );
            this.variablesChangedEvent.emit();
          },
        });
    } else {
      const original = this.$modalInitial();
      const name = original?.name ?? request.name;
      this.caseInspectionService
        .updateProcessVariable(this.documentId, this.row.processInstanceId, name, request)
        .subscribe({
          next: () => {
            this.notifySuccess('case.inspection.processes.variableActions.updatedToast', name);
            this.variablesChangedEvent.emit();
          },
        });
    }
  }

  private notifySuccess(translationKey: string, name: string): void {
    this.notificationService.showToast({
      type: 'success',
      title: this.translateService.instant(translationKey, {name}),
      message: '',
    });
  }
}
