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
import {ConfigurationOutput, DataSourceConfigurationComponent, Operator} from '../../../../models';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  map,
  Observable,
  startWith,
  Subscription,
} from 'rxjs';
import {
  AbstractControl,
  FormBuilder,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {CaseCountsConfiguration, CaseCountsQueryItem, CaseCountsQueryItemForm} from '../../models';
import {DocumentService} from '@valtimo/document';
import {IconService, ListItem} from 'carbon-components-angular';
import {ListItemWithId, MultiInputValues} from '@valtimo/components';
import {TranslateService} from '@ngx-translate/core';
import {WidgetTranslationService} from '../../../../services';
import {isEqual} from 'lodash';
import {Add16, TrashCan16} from '@carbon/icons';

@Component({
  templateUrl: './case-counts-configuration.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./case-counts-configuration.component.scss'],
})
export class CaseCountsConfigurationComponent
  implements OnInit, OnDestroy, DataSourceConfigurationComponent
{
  @Input() public dataSourceKey: string;

  private readonly _EMPTY_QUERY_ITEM_VALUE: CaseCountsQueryItemForm = {
    label: '',
    queryConditions: [{key: '', value: '', dropdown: ''}],
  };

  public readonly form = this.fb.group({
    documentDefinition: this.fb.control(null, [Validators.required]),
    queryItems: this.fb.control(
      [this._EMPTY_QUERY_ITEM_VALUE, this._EMPTY_QUERY_ITEM_VALUE],
      [this.queryItemsValidator()]
    ),
  });

  @Input() public set disabled(disabledValue: boolean) {
    if (disabledValue) {
      this.form.disable();
    } else {
      this.form.enable();
    }
  }

  public get queryItems(): AbstractControl<CaseCountsQueryItemForm[]> {
    return this.form.get('queryItems');
  }

  public get queryItemsValue$(): Observable<CaseCountsQueryItemForm[]> {
    return this.queryItems.valueChanges.pipe(startWith(this.queryItems.value || []));
  }

  public get queryItemsList$(): Observable<null[]> {
    return this.queryItemsValue$.pipe(
      map(queryItemsValue => queryItemsValue.map(() => null)),
      distinctUntilChanged((previous, current) => isEqual(previous, current))
    );
  }

  public get documentDefinition() {
    return this.form.get('documentDefinition');
  }

  public get formDisabled(): boolean {
    return this.form.disabled;
  }

  @Input() set prefillConfiguration(configurationValue: CaseCountsConfiguration) {
    if (!configurationValue) return;

    this.documentDefinitionSelected({
      item: {
        content: configurationValue.documentDefinition,
      },
    } as any);
    this.documentDefinition.patchValue(configurationValue.documentDefinition);

    this.queryItems.patchValue(this.queryItemsToMultiInputValues(configurationValue.queryItems));
  }

  @Output() public configurationEvent = new EventEmitter<
    ConfigurationOutput<CaseCountsConfiguration>
  >();

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

  private _subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly documentService: DocumentService,
    private readonly translateService: TranslateService,
    private readonly widgetTranslationService: WidgetTranslationService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Add16, TrashCan16]);
  }

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
  }

  public conditionsValueChange(index: number, values: MultiInputValues): void {
    const currentQueryItemsValues = this.queryItems.value;

    if (isEqual(currentQueryItemsValues[index].queryConditions, values)) return;

    this.queryItems.patchValue(
      currentQueryItemsValues.map((item, itemIndex) =>
        itemIndex === index ? {...item, queryConditions: values} : item
      )
    );
  }

  public labelValueChange(index: number, value: string): void {
    const currentQueryItemsValues = this.queryItems.value;

    if (currentQueryItemsValues[index].label === value) return;

    this.queryItems.patchValue(
      currentQueryItemsValues.map((item, itemIndex) =>
        itemIndex === index ? {...item, label: value} : item
      )
    );
  }

  public addQueryItem(): void {
    const currentQueryItems = this.queryItems.value;
    this.queryItems.patchValue([...currentQueryItems, this._EMPTY_QUERY_ITEM_VALUE]);
  }

  public deleteCount(i: number): void {
    const currentQueryItems = this.queryItems.value;
    this.queryItems.patchValue(currentQueryItems.filter((_, index) => index !== i));
  }

  private openFormSubscription(): void {
    this._subscriptions.add(
      this.form.valueChanges.pipe(startWith(this.form.value)).subscribe(formValue => {
        this.configurationEvent.emit({
          valid: this.form.valid,
          data: {
            ...formValue,
            queryItems: this.multiInputValuesToQueryItems(formValue.queryItems),
          } as CaseCountsConfiguration,
        });
      })
    );
  }

  private queryItemsToMultiInputValues(
    queryItems: CaseCountsQueryItem[]
  ): CaseCountsQueryItemForm[] {
    return queryItems.map(queryItem => ({
      ...queryItem,
      queryConditions: queryItem.queryConditions.map(condition => ({
        key: condition.queryPath,
        dropdown: condition.queryOperator,
        value: condition.queryValue,
      })),
    }));
  }

  private multiInputValuesToQueryItems(
    multiInputValues: CaseCountsQueryItemForm[]
  ): CaseCountsQueryItem[] {
    return multiInputValues.map(queryItem => ({
      ...queryItem,
      queryConditions: queryItem.queryConditions.map(condition => ({
        queryPath: condition.key,
        queryOperator: condition.dropdown,
        queryValue: condition.value,
      })),
    }));
  }

  private queryItemsValidator(): ValidatorFn {
    return (control: AbstractControl<CaseCountsQueryItemForm[]>): ValidationErrors | null => {
      const queryItems = control.value;
      const validQueryItems = queryItems.filter(item => {
        const validLabel = !!item.label;
        const validConditions = item.queryConditions.filter(
          condition => !!condition.value && !!condition.key && !!condition.dropdown
        );

        return (
          validLabel &&
          validConditions.length > 0 &&
          item.queryConditions.length === validConditions.length
        );
      });

      return validQueryItems.length > 1 && validQueryItems.length === queryItems.length
        ? null
        : {
            invalidQueryItems: 'invalid',
          };
    };
  }
}
