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
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {ProcessInstanceTask} from '@valtimo/process';
import {BehaviorSubject, Subject} from 'rxjs';
import {filter, map} from 'rxjs/operators';
import {
  ButtonModule,
  DatePickerModule,
  IconModule,
  IconService,
  LayerModule,
  ToggletipModule,
} from 'carbon-components-angular';
import {CalendarAdd16} from '@carbon/icons';
import {TaskService} from '../../services';
import {Task} from '../../models';
import {CdsThemeService, RemoveClassnamesDirective} from '@valtimo/components';

@Component({
  selector: 'valtimo-set-task-due-date',
  templateUrl: './set-task-due-date.component.html',
  styleUrls: ['./set-task-due-date.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    IconModule,
    ToggletipModule,
    DatePickerModule,
    LayerModule,
    RemoveClassnamesDirective,
  ],
})
export class SetTaskDueDateComponent {
  public readonly canModifyTaskSet$ = new BehaviorSubject<boolean>(false);
  public readonly canModifyTask$ = new BehaviorSubject<boolean>(false);

  @Input() public set canModifyTask(value: boolean) {
    this.canModifyTaskSet$.next(true);
    this.canModifyTask$.next(value);
  }

  private readonly _task$ = new BehaviorSubject<Partial<ProcessInstanceTask> | null>(null);

  private get _task(): Partial<ProcessInstanceTask> | null {
    return this._task$.getValue();
  }

  public readonly hasDueDate$ = new BehaviorSubject<boolean>(false);

  public readonly selectedDateString$ = new BehaviorSubject<string>('');

  private get _selectedDateString(): string {
    return this.selectedDateString$.getValue();
  }

  @Input() public set task(value: ProcessInstanceTask | Task) {
    if (!value) return;
    this.hasDueDate$.next(!!value.due);
    this._task$.next(value);
  }

  public readonly taskDueDate$ = this._task$.pipe(
    filter(task => !!task),
    map(task => new Date(task.due))
  );

  public readonly disabled$ = new BehaviorSubject<boolean>(false);

  public readonly open$ = new Subject<boolean>();

  public readonly mouseIsOverDueDate$ = new BehaviorSubject<boolean>(false);

  public readonly toggletipTheme$ = this.cdsThemeService.toggletipTheme$;

  constructor(
    private readonly iconService: IconService,
    private readonly taskService: TaskService,
    private readonly cdsThemeService: CdsThemeService
  ) {
    this.iconService.registerAll([CalendarAdd16]);
  }

  public onDateValueChange(value: Date[]): void {
    const date = Array.isArray(value) && value[0];
    if (!date) return;
    this.selectedDateString$.next(date.toISOString());
  }

  public onSubmitButtonClick(): void {
    this.disabled$.next(true);

    this.taskService.setTaskDueDate(this._task.id, {dueDate: this._selectedDateString}).subscribe({
      next: () => {
        this.disabled$.next(false);
        this.hasDueDate$.next(true);
        this._task$.next({...this._task, due: this._selectedDateString});
        this.selectedDateString$.next('');
        this.closeToggletip();
      },
      error: () => {
        this.disabled$.next(false);
      },
    });
  }

  public onRemoveButtonClick(): void {
    this.disabled$.next(true);

    this.taskService.removeTaskDueDate(this._task.id).subscribe({
      next: () => {
        this.disabled$.next(false);
        this.hasDueDate$.next(false);
        this._task$.next({...this._task, due: null});
      },
      error: () => {
        this.disabled$.next(false);
      },
    });
  }

  private closeToggletip(): void {
    // needed to reliably trigger toggle tip closure
    this.open$.next(true);
    setTimeout(() => this.open$.next(false));
  }

  public onMouseEnterDueDate(): void {
    this.mouseIsOverDueDate$.next(true);
  }

  public onMouseLeaveDueDate(): void {
    this.mouseIsOverDueDate$.next(false);
  }
}
