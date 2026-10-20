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

import {NgTemplateOutlet} from '@angular/common';
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {ArrowLeft16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {TaskWithProcessLink} from '@valtimo/process-link';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {CASE_DETAIL_PANEL_TEST_IDS} from '../../constants/case-detail.test-ids';
import {CaseDetailLayoutService} from '../../services/case-detail-layout.service';
import {CaseTabService} from '../../services/case-tab.service';
import {CaseDetailsTaskDetailComponent} from '../case-detail-task-detail/case-detail-task-detail.component';
import {CaseDetailTaskListComponent} from '../case-detail-task-list/case-detail-task-list.component';

/**
 * Side panel content of the case detail: an in-panel start form, else an in-panel task, else the
 * task list. Rendered with the case detail's injector, so it shares its page-scoped services.
 */
@Component({
  standalone: true,
  selector: 'valtimo-case-detail-task-panel',
  templateUrl: './case-detail-task-panel.component.html',
  styleUrls: ['./case-detail-task-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    TranslateModule,
    ButtonModule,
    IconModule,
    CaseDetailsTaskDetailComponent,
    CaseDetailTaskListComponent,
  ],
})
export class CaseDetailTaskPanelComponent {
  /** The back button returns to the task list, so only where the active tab shows it. */
  public readonly $showTaskList = toSignal(this.caseTabService.showTaskList$, {
    initialValue: false,
  });
  public readonly $startFormPanel = toSignal(this.caseDetailLayoutService.startFormPanel$, {
    initialValue: null,
  });
  public readonly $taskAndProcessLink = toSignal(
    this.caseDetailLayoutService.taskAndProcessLinkOpenedInPanel$,
    {initialValue: null}
  );

  protected readonly testIds = CASE_DETAIL_PANEL_TEST_IDS;

  constructor(
    private readonly caseDetailLayoutService: CaseDetailLayoutService,
    private readonly caseTabService: CaseTabService,
    private readonly iconService: IconService
  ) {
    this.iconService.register(ArrowLeft16);
  }

  public onDueDateChanged(): void {
    this.caseDetailLayoutService.refreshTasks();
  }

  public onStartFormPanelClose(): void {
    this.caseDetailLayoutService.requestStartFormPanelClose();
  }

  public onTaskClick(taskWithProcessLink: TaskWithProcessLink): void {
    this.caseDetailLayoutService.selectTask(taskWithProcessLink);
  }

  public onTaskClose(): void {
    this.caseDetailLayoutService.setTaskFormPendingChanges(false);
    this.caseDetailLayoutService.setTaskAndProcessLinkOpenedInPanel(null);
  }

  public onTaskCloseRequest(): void {
    this.caseDetailLayoutService.requestTaskClose();
  }

  public onTaskFormActiveChange(pendingChanges: boolean): void {
    this.caseDetailLayoutService.setTaskFormPendingChanges(pendingChanges);
  }

  public onTaskFormSubmit(): void {
    this.caseDetailLayoutService.setTaskFormPendingChanges(false);
    this.caseDetailLayoutService.notifyTaskFormSubmitted();
  }
}
