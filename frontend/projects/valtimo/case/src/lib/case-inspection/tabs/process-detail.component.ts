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
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {ProcessDiagramComponent} from '@valtimo/process';
import {
  ButtonModule,
  IconModule,
  StructuredListModule,
  TabsModule,
  TagModule,
} from 'carbon-components-angular';
import {
  BuildingBlockProcessReference,
  ProcessInstanceInspection,
  ProcessVariable,
} from '../models/case-inspection.models';
import {ProcessDetailTab} from './process-detail-tab.enum';

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
    StructuredListModule,
    TabsModule,
    TagModule,
    ProcessDiagramComponent,
  ],
})
export class CaseInspectionProcessDetailComponent {
  @Input() public row!: ProcessInstanceInspection;

  @Output() public readonly viewBuildingBlockEvent =
    new EventEmitter<BuildingBlockProcessReference>();

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

  public onSelectTab(tab: ProcessDetailTab): void {
    this.$activeTab.set(tab);
  }

  public onViewBuildingBlock(bb: BuildingBlockProcessReference): void {
    this.viewBuildingBlockEvent.emit(bb);
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
}
