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
import {
  AbstractControl,
  FormBuilder,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {
  CaseGroupByConfiguration,
  CaseGroupByConfigurationFormValue,
  CaseGroupByEnum,
} from '../../models';
import {DocumentService} from '@valtimo/document';
import {ListItem} from 'carbon-components-angular';
import {ListItemWithId, MultiInputValues} from '@valtimo/components';
import {TranslateService} from '@ngx-translate/core';
import {WidgetTranslationService} from '../../../../services';
import {isEqual} from 'lodash';

@Component({
  templateUrl: './case-group-by-configuration.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./case-group-by-configuration.component.scss'],
})
export class CaseGroupByConfigurationComponent
  implements OnInit, OnDestroy, DataSourceConfigurationComponent
{
  @Input() public dataSourceKey: string;

  public readonly form = this.fb.group({
    documentDefinition: this.fb.control(null, [Validators.required]),
    path: this.fb.control(null, [Validators.required]),
    queryConditions: this.fb.control([], [this.queryConditionsValidator()]),
    enum: this.fb.control([], [this.enumValidator()]),
  });

  public get documentDefinition(): AbstractControl<string> {
    return this.form.get('documentDefinition');
  }

  public get path(): AbstractControl<string> {
    return this.form.get('path');
  }

  public get queryConditions(): AbstractControl<MultiInputValues> {
    return this.form.get('queryConditions');
  }

  public get enum(): AbstractControl<MultiInputValues> {
    return this.form.get('enum');
  }

  public get formDisabled(): boolean {
    return this.form.disabled;
  }

  public get formValue$(): Observable<Partial<CaseGroupByConfigurationFormValue>> {
    return this.form.valueChanges.pipe(startWith(this.form.value));
  }

  @Input() public set disabled(disabledValue: boolean) {
    if (disabledValue) {
      this.form.disable();
    } else {
      this.form.enable();
    }
  }

  private readonly _selectedDocumentDefinition$ = new BehaviorSubject<string>('');

  public readonly documentItems$: Observable<Array<ListItem>> = combineLatest([
    this.documentService.getAllDefinitions(),
    this._selectedDocumentDefinition$,
  ]).pipe(
    map(([documentDefinitions, selectedDocumentDefintion]) =>
      documentDefinitions.content.map(definition => ({
        content: definition.id.name,
        selected: definition.id.name === selectedDocumentDefintion,
      }))
    )
  );

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

  @Input() set prefillConfiguration(configurationValue: CaseGroupByConfiguration) {
    if (!configurationValue) return;

    this.documentDefinitionSelected({
      item: {
        content: configurationValue.documentDefinition,
      },
    } as any);

    this.queryConditions.patchValue(
      this.queryConditionsToMultiInputValues(configurationValue.queryConditions)
    );
    this.enum.patchValue(this.enumToMultiInputValues(configurationValue.enum));
    this.path.patchValue(configurationValue.path);
  }

  @Output() public configurationEvent = new EventEmitter<
    ConfigurationOutput<CaseGroupByConfiguration>
  >();

  private _subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly documentService: DocumentService,
    private readonly translateService: TranslateService,
    private readonly widgetTranslationService: WidgetTranslationService
  ) {}

  public ngOnInit(): void {
    this.openFormSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public documentDefinitionSelected(documentDefinitionItem: ListItem): void {
    if (!documentDefinitionItem) {
      return;
    }

    this._selectedDocumentDefinition$.next(documentDefinitionItem?.item?.content);
    this.documentDefinition.setValue(documentDefinitionItem?.item?.content);
  }

  public conditionsValueChange(values: MultiInputValues): void {
    if (!values) return;

    const currentValue = this.queryConditions.value;

    if (isEqual(values, currentValue)) return;

    this.queryConditions.patchValue(values);
  }

  public enumValueChange(values: MultiInputValues): void {
    if (!values) return;

    const currentValue = this.enum.value;

    if (isEqual(values, currentValue)) return;

    this.enum.patchValue(values);
  }

  private openFormSubscription(): void {
    this._subscriptions.add(
      this.form.valueChanges.pipe(startWith(this.form.value)).subscribe(formValue => {
        this.configurationEvent.emit({
          valid: this.form.valid,
          data: {
            ...formValue,
            queryConditions: this.multiInputValuesToQueryConditions(formValue.queryConditions),
            enum: this.multiInputValuesToEnum(formValue.enum),
          } as CaseGroupByConfiguration,
        });
      })
    );
  }

  private queryConditionsValidator(): ValidatorFn {
    return (control: AbstractControl<MultiInputValues>): ValidationErrors | null => {
      const queryConditions = control.value;
      const validConditions = queryConditions.filter(
        condition => !!condition.value && !!condition.key && !!condition.dropdown
      );

      return validConditions.length === queryConditions.length
        ? null
        : {
            invalidQueryItems: 'invalid',
          };
    };
  }

  private enumValidator(): ValidatorFn {
    return (control: AbstractControl<MultiInputValues>): ValidationErrors | null => {
      const enumeration = control.value || [];
      const enumLength = enumeration.length;
      const validEnumKeysLength = enumeration.filter(entry => !!entry.key).length;
      const validEnumValuesLength = enumeration.filter(entry => !!entry.value).length;

      return enumLength === validEnumKeysLength && enumLength === validEnumValuesLength
        ? null
        : {
            invalidEnum: 'invalid',
          };
    };
  }

  private enumToMultiInputValues(enumeration?: CaseGroupByEnum): MultiInputValues {
    return Object.keys(enumeration || {}).reduce(
      (acc, key) => [...acc, {key, value: enumeration[key]}],
      []
    );
  }

  private multiInputValuesToEnum(values?: MultiInputValues): CaseGroupByEnum {
    return (values || []).reduce((acc, curr) => ({...acc, [curr.key]: curr.value}), {});
  }

  private queryConditionsToMultiInputValues(queryConditions?: QueryCondition[]): MultiInputValues {
    return (queryConditions || []).map(condition => ({
      key: condition.queryPath,
      dropdown: condition.queryOperator,
      value: condition.queryValue,
    }));
  }

  private multiInputValuesToQueryConditions(values?: MultiInputValues): QueryCondition[] {
    return (values || []).map(condition => ({
      queryPath: condition.key,
      queryOperator: condition.dropdown,
      queryValue: condition.value,
    }));
  }
}
