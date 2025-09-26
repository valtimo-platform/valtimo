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

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {
  ConfigurationOutput,
  DataSourceConfigurationComponent,
  Operator,
  QueryCondition,
} from '../../../../models';
import {BehaviorSubject, combineLatest, map, Observable, startWith, Subscription} from 'rxjs';
import {AbstractControl, FormBuilder} from '@angular/forms';
import {TaskCountConfiguration} from '../../models';
import {ListItemWithId, MultiInputKeyValue, MultiInputValues} from '@valtimo/components';
import {TranslateService} from '@ngx-translate/core';
import {WidgetTranslationService} from '../../../../services';

@Component({
  templateUrl: './task-count-configuration.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./task-count-configuration.component.scss'],
})
export class TaskCountConfigurationComponent
  implements OnInit, OnDestroy, DataSourceConfigurationComponent
{
  @Input() public dataSourceKey: string;

  public readonly form = this.fb.group({
    queryConditions: this.fb.control(null),
  });

  @Input() public set disabled(disabledValue: boolean) {
    if (disabledValue) {
      this.form.disable();
    } else {
      this.form.enable();
    }
  }

  private readonly _OPERATORS: Array<Operator> = [
    Operator.NOT_EQUAL_TO,
    Operator.EQUAL_TO,
    Operator.GREATER_THAN,
    Operator.GREATER_THAN_OR_EQUAL_TO,
    Operator.LESS_THAN,
    Operator.LESS_THAN_OR_EQUAL_TO,
  ];

  public readonly operatorItems$: Observable<Array<ListItemWithId>> = this.translateService
    .stream('key')
    .pipe(
      map(() =>
        this._OPERATORS.map(operator => ({
          id: operator,
          content: this.widgetTranslationService.instant(operator, this.dataSourceKey),
          selected: false,
        }))
      )
    );

  public readonly defaultConditionValues$ = new BehaviorSubject<MultiInputValues | null>(null);
  public readonly allConditionsValid$ = new BehaviorSubject<boolean>(true);

  public get queryConditions(): AbstractControl<QueryCondition[]> {
    return this.form.get('queryConditions');
  }

  @Input() set prefillConfiguration(configurationValue: TaskCountConfiguration) {
    if (configurationValue) {
      this.defaultConditionValues$.next(
        configurationValue.queryConditions.map(condition => ({
          key: condition.queryPath,
          dropdown: condition.queryOperator,
          value: condition.queryValue,
        }))
      );
    }
  }

  @Output() public configurationEvent = new EventEmitter<
    ConfigurationOutput<TaskCountConfiguration>
  >();

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly translateService: TranslateService,
    private readonly widgetTranslationService: WidgetTranslationService
  ) {}

  public ngOnInit(): void {
    this.openFormSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public conditionsValueChange(values: Array<MultiInputKeyValue>): void {
    if (values.length === 0) {
      this.queryConditions.setValue(null);
    } else {
      this.queryConditions.setValue(
        values.map(value => ({
          queryPath: value.key,
          queryOperator: value.dropdown,
          queryValue: value.value,
        }))
      );
    }
  }

  public onAllConditionsValid(allConditionsValid: boolean): void {
    this.allConditionsValid$.next(allConditionsValid);
  }

  private openFormSubscription(): void {
    this._subscriptions.add(
      combineLatest([
        this.form.valueChanges.pipe(startWith(this.form.value)),
        this.allConditionsValid$,
      ]).subscribe(([formValue, allConditionsValid]) => {
        this.configurationEvent.emit({
          valid: this.form.valid && allConditionsValid,
          data: formValue as TaskCountConfiguration,
        });
      })
    );
  }
}
