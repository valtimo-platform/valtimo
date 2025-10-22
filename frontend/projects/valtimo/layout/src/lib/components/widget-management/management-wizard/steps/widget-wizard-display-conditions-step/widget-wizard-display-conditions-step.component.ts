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
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {
  CarbonMultiInputModule,
  ListItemWithId,
  MultiInputKeyValue,
  ValuePathSelectorPrefix,
} from '@valtimo/components';
import {BehaviorSubject, filter, map, Observable} from 'rxjs';
import {AbstractControl, FormBuilder, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {Condition, Operator} from '@valtimo/shared';
import {
  DropdownModule,
  InputModule,
  StructuredListModule,
  ToggleModule,
} from 'carbon-components-angular';
import {getCaseManagementRouteParams} from '@valtimo/shared';
import {ActivatedRoute} from '@angular/router';
import {toObservable} from '@angular/core/rxjs-interop';
import {take} from 'rxjs/operators';
import { WidgetWizardService } from '../../../../../services';

@Component({
  templateUrl: './widget-wizard-display-conditions-step.component.html',
  styleUrl: './widget-wizard-display-conditions-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    CarbonMultiInputModule,
    InputModule,
    DropdownModule,
    FormsModule,
    ReactiveFormsModule,
    StructuredListModule,
    ToggleModule,
    TranslatePipe,
  ],
})
export class WidgetWizardDisplayConditionsStepComponent {
  public readonly ValuePathSelectorPrefix = ValuePathSelectorPrefix;

  public readonly allConditionsValid$ = new BehaviorSubject<boolean>(true);

  public readonly params$ = getCaseManagementRouteParams(this.route);

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
          content: this.translateService.instant('condition.operator.' + operator),
          selected: false,
        }))
      )
    );

  public readonly defaultConditionValues$ = toObservable(
    this.widgetWizardService.$widgetDisplayConditions
  ).pipe(
    filter(conditions => conditions !== null),
    take(1),
    map((conditions: Array<Condition>) =>
      conditions.map(condition => ({
        key: condition.path,
        dropdown: condition.operator,
        value: condition.value,
      }))
    )
  );

  public readonly form = this.fb.group({
    conditions: this.fb.control(null),
  });

  public get conditions(): AbstractControl {
    return this.form.get('conditions') as AbstractControl;
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly translateService: TranslateService,
    private readonly widgetWizardService: WidgetWizardService,
    private readonly route: ActivatedRoute
  ) {}

  public onAllConditionsValid(allConditionsValid: boolean): void {
    this.allConditionsValid$.next(allConditionsValid);
  }

  public conditionsValueChange(values: Array<MultiInputKeyValue>): void {
    if (values.length === 0) {
      this.conditions.setValue(null);
    } else {
      this.conditions.setValue(
        values.map(value => ({
          path: value.key,
          operator: value.dropdown,
          value: value.value,
        }))
      );
    }
    this.widgetWizardService.$widgetDisplayConditions.set(this.conditions.value);
  }
}
