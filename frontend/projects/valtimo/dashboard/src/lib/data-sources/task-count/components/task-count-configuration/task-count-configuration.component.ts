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

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import {toObservable} from '@angular/core/rxjs-interop';
import {combineLatest, map, Observable, shareReplay, startWith, Subscription} from 'rxjs';
import {ListItem, NotificationContent} from 'carbon-components-angular';
import {ListItemWithId} from '@valtimo/components';
import {DocumentService} from '@valtimo/document';
import {TranslateService} from '@ngx-translate/core';
import {ConfigurationOutput, DataSourceConfigurationComponent} from '../../../../models';
import {WidgetTranslationService} from '../../../../services';
import {TASK_COUNT_TEST_IDS} from '../../constants';
import {ConditionGroupValue, TaskCountConfiguration} from '../../models';
import {
  createConditionGroup,
  EDITABLE_CONDITION_OPERATORS,
  resetRootGroup,
  serializeConditionGroup,
} from '../../utils';

@Component({
  standalone: false,
  templateUrl: './task-count-configuration.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./task-count-configuration.component.scss'],
})
export class TaskCountConfigurationComponent
  implements OnInit, OnDestroy, DataSourceConfigurationComponent
{
  @Input() public dataSourceKey: string;

  @Input() public set disabled(disabledValue: boolean) {
    this.$disabled.set(disabledValue);
    // The rows of a group are a form control, so the multi input follows the form rather than a
    // [disabled] binding of its own.
    disabledValue
      ? this.conditionsForm.disable({emitEvent: false})
      : this.conditionsForm.enable({emitEvent: false});
  }

  @Input() public set prefillConfiguration(configurationValue: TaskCountConfiguration) {
    if (!configurationValue) {
      return;
    }

    this._$selectedCaseDefinitionName.set(configurationValue.caseDefinitionName ?? undefined);
    resetRootGroup(
      this.conditionsForm,
      configurationValue.conditions ?? configurationValue.queryConditions ?? []
    );
  }

  @Output() public configurationEvent = new EventEmitter<
    ConfigurationOutput<TaskCountConfiguration>
  >();

  public readonly $disabled = signal<boolean>(false);

  /**
   * The whole condition tree. Kept for the lifetime of the component - a prefill resets its
   * contents - so that the subscription below survives it.
   */
  public readonly conditionsForm = createConditionGroup('and');

  protected readonly testIds = TASK_COUNT_TEST_IDS;

  // Declared before the observables below, which read it at field-initialization time.
  private readonly _$selectedCaseDefinitionName = signal<string | undefined>(undefined);

  private readonly _serializedConditions$ = this.conditionsForm.valueChanges.pipe(
    startWith(null),
    map(() => serializeConditionGroup(this.conditionsForm.getRawValue() as ConditionGroupValue)),
    shareReplay({bufferSize: 1, refCount: true})
  );

  public readonly hasUnsupportedConditions$: Observable<boolean> = this._serializedConditions$.pipe(
    map(serialized => serialized.hasUnsupportedNodes)
  );

  /**
   * Emits once and then on every language change. Subscribing to a translation is the only way to
   * be notified, so the lists below are rebuilt whenever this fires.
   */
  private readonly _languageChange$: Observable<unknown> = this.translateService
    .stream('key')
    .pipe(shareReplay({bufferSize: 1, refCount: true}));

  public readonly caseDefinitionItems$: Observable<Array<ListItem>> = combineLatest([
    this.documentService.getAllDefinitions(),
    toObservable(this._$selectedCaseDefinitionName),
    this._languageChange$,
  ]).pipe(
    map(([definitions, selectedCaseDefinitionName]) => [
      {
        content: this.widgetTranslationService.instant('allCaseDefinitions', this.dataSourceKey),
        selected: selectedCaseDefinitionName === undefined,
        caseDefinitionName: undefined,
      },
      ...definitions.content.map(definition => ({
        content: definition.id.name,
        selected: definition.id.name === selectedCaseDefinitionName,
        caseDefinitionName: definition.id.name,
      })),
    ])
  );

  public readonly operatorItems$: Observable<Array<ListItemWithId>> = this._languageChange$.pipe(
    map(() =>
      EDITABLE_CONDITION_OPERATORS.map(operator => ({
        id: operator,
        content: this.translateService.instant('condition.operator.' + operator),
        selected: false,
      }))
    )
  );

  public readonly unsupportedConditionsNotification$: Observable<NotificationContent> =
    this._languageChange$.pipe(
      map(() => ({
        type: 'info',
        lowContrast: true,
        title: this.widgetTranslationService.instant(
          'unsupportedConditionsNotification',
          this.dataSourceKey
        ),
        showClose: false,
      }))
    );

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly documentService: DocumentService,
    private readonly translateService: TranslateService,
    private readonly widgetTranslationService: WidgetTranslationService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(this.conditionsForm.valueChanges.subscribe(() => this.emit()));
    this.emit();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public caseDefinitionSelected(event: {item?: ListItem}): void {
    if (!event) {
      return;
    }

    this._$selectedCaseDefinitionName.set(event.item?.caseDefinitionName ?? undefined);
    this.emit();
  }

  private emit(): void {
    const {node} = serializeConditionGroup(
      this.conditionsForm.getRawValue() as ConditionGroupValue
    );

    this.configurationEvent.emit({
      // A disabled form is neither valid nor invalid, so a read-only configuration is not reported
      // as an incomplete one.
      valid: !this.conditionsForm.invalid,
      data: {
        caseDefinitionName: this._$selectedCaseDefinitionName() ?? undefined,
        // Emitted as a single root node so that the operator of the outermost group survives a
        // save/reload round-trip. An empty root is omitted entirely: the backend rejects empty
        // `and`/`or` groups.
        conditions: node ? [node] : [],
      },
    });
  }
}
