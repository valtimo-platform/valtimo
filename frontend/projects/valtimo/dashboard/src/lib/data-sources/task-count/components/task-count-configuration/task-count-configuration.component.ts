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
  OnInit,
  Output,
  signal,
} from '@angular/core';
import {toObservable} from '@angular/core/rxjs-interop';
import {combineLatest, map, Observable, shareReplay} from 'rxjs';
import {ListItem, NotificationContent} from 'carbon-components-angular';
import {ListItemWithId} from '@valtimo/components';
import {DocumentService} from '@valtimo/document';
import {TranslateService} from '@ngx-translate/core';
import {ConfigurationOutput, DataSourceConfigurationComponent} from '../../../../models';
import {WidgetTranslationService} from '../../../../services';
import {TASK_COUNT_TEST_IDS} from '../../constants';
import {TaskCountConfiguration} from '../../models';
import {
  createConditionGroup,
  EDITABLE_CONDITION_OPERATORS,
  serializeConditionGroup,
  wireNodesToRootGroup,
} from '../../utils';

@Component({
  standalone: false,
  templateUrl: './task-count-configuration.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./task-count-configuration.component.scss'],
})
export class TaskCountConfigurationComponent implements OnInit, DataSourceConfigurationComponent {
  @Input() public dataSourceKey: string;

  @Input() public set disabled(disabledValue: boolean) {
    this.$disabled.set(disabledValue);
  }

  @Input() public set prefillConfiguration(configurationValue: TaskCountConfiguration) {
    if (!configurationValue) {
      return;
    }

    this._$selectedCaseDefinitionName.set(configurationValue.caseDefinitionName ?? undefined);
    this.$rootGroup.set(
      wireNodesToRootGroup(
        configurationValue.conditions ?? configurationValue.queryConditions ?? []
      )
    );
  }

  @Output() public configurationEvent = new EventEmitter<
    ConfigurationOutput<TaskCountConfiguration>
  >();

  public readonly $disabled = signal<boolean>(false);
  public readonly $rootGroup = signal(createConditionGroup('and'));
  public readonly $hasUnsupportedConditions = signal<boolean>(false);

  public readonly testIds = TASK_COUNT_TEST_IDS;

  // Declared before the observables below, which read it at field-initialization time.
  private readonly _$selectedCaseDefinitionName = signal<string | undefined>(undefined);

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

  constructor(
    private readonly documentService: DocumentService,
    private readonly translateService: TranslateService,
    private readonly widgetTranslationService: WidgetTranslationService
  ) {}

  public ngOnInit(): void {
    this.emit();
  }

  public caseDefinitionSelected(event: {item?: ListItem}): void {
    if (!event) {
      return;
    }

    this._$selectedCaseDefinitionName.set(event.item?.caseDefinitionName ?? undefined);
    this.emit();
  }

  public conditionsChange(): void {
    this.emit();
  }

  private emit(): void {
    // The group tree is walked once: the condition groups are mutated in place by the child
    // component, so the derived state has to be refreshed here rather than in a computed.
    const {node, valid, hasUnsupportedNodes} = serializeConditionGroup(this.$rootGroup());
    this.$hasUnsupportedConditions.set(hasUnsupportedNodes);

    this.configurationEvent.emit({
      valid,
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
