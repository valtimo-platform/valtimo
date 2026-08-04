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
  computed,
  EventEmitter,
  Input,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import {toObservable} from '@angular/core/rxjs-interop';
import {
  ConditionLeaf,
  ConditionNode,
  ConfigurationOutput,
  DataSourceConfigurationComponent,
} from '../../../../models';
import {BehaviorSubject, combineLatest, map, Observable} from 'rxjs';
import {TaskCountConfiguration} from '../../models';
import {DocumentService} from '@valtimo/document';
import {IconService, ListItem, NotificationContent} from 'carbon-components-angular';
import {ListItemWithId, MultiInputKeyValue, MultiInputValues} from '@valtimo/components';
import {TranslateService} from '@ngx-translate/core';
import {ExpressionOperator} from '@valtimo/shared';
import {isEqual} from 'lodash';
import {Add16, TrashCan16} from '@carbon/icons';
import {WidgetTranslationService} from '../../../../services';
import {TASK_COUNT_TEST_IDS} from '../../constants';

interface OrGroupForm {
  rows: MultiInputValues;
}

interface RawLeaf {
  path?: string;
  operator?: string;
  value?: unknown;
  queryPath?: string;
  queryOperator?: string;
  queryValue?: unknown;
}

interface RawOrGroup {
  or: RawNode[];
}

interface RawAndGroup {
  and: RawNode[];
}

type RawNode = RawLeaf | RawOrGroup | RawAndGroup;

interface RawTaskCountConfiguration {
  caseDefinitionName?: string;
  conditions?: RawNode[];
  queryConditions?: RawNode[];
}

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

    const raw = configurationValue as unknown as RawTaskCountConfiguration;
    this._$selectedCaseDefinitionName.set(raw.caseDefinitionName ?? undefined);

    const rawNodes = raw.conditions ?? raw.queryConditions ?? [];
    const flatRows: MultiInputValues = [];
    const orGroups: OrGroupForm[] = [];
    const passthrough: ConditionNode[] = [];

    rawNodes.forEach(node => {
      if (this.isRawOrGroup(node)) {
        if (node.or.every(child => this.isEditableLeaf(child))) {
          orGroups.push({rows: node.or.map(child => this.rawLeafToRow(child as RawLeaf))});
        } else {
          passthrough.push(node as unknown as ConditionNode);
        }
      } else if (this.isRawAndGroup(node)) {
        passthrough.push(node as unknown as ConditionNode);
      } else if (this.isEditableLeaf(node)) {
        flatRows.push(this.rawLeafToRow(node as RawLeaf));
      } else {
        passthrough.push(node as unknown as ConditionNode);
      }
    });

    this._$flatRows.set(flatRows);
    this.defaultConditionValues$.next(flatRows.length ? flatRows : null);
    this.$orGroups.set(orGroups);
    this._$passthroughNodes.set(passthrough);
  }

  @Output() public configurationEvent = new EventEmitter<
    ConfigurationOutput<TaskCountConfiguration>
  >();

  // Declared before the observables/computeds below, which read these signals at field-init time.
  private readonly _$selectedCaseDefinitionName = signal<string | undefined>(undefined);
  private readonly _$flatRows = signal<MultiInputValues>([]);
  private readonly _$passthroughNodes = signal<ConditionNode[]>([]);

  public readonly $disabled = signal<boolean>(false);
  public readonly $orGroups = signal<OrGroupForm[]>([]);
  public readonly $hasUnsupportedConditions = computed(() => this._$passthroughNodes().length > 0);

  public readonly defaultConditionValues$ = new BehaviorSubject<MultiInputValues | null>(null);

  public readonly caseDefinitionItems$: Observable<Array<ListItem>> = combineLatest([
    this.documentService.getAllDefinitions(),
    toObservable(this._$selectedCaseDefinitionName),
    this.translateService.stream('key'),
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

  public readonly unsupportedConditionsNotification$: Observable<NotificationContent> =
    this.translateService.stream('key').pipe(
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

  private readonly _OPERATORS: Array<ExpressionOperator> = ['!=', '==', '>', '>=', '<', '<='];

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

  public readonly testIds = TASK_COUNT_TEST_IDS;

  constructor(
    private readonly documentService: DocumentService,
    private readonly translateService: TranslateService,
    private readonly widgetTranslationService: WidgetTranslationService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Add16, TrashCan16]);
  }

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

  public flatConditionsValueChange(values: MultiInputValues): void {
    if (isEqual(this._$flatRows(), values)) {
      return;
    }

    this._$flatRows.set(values);
    this.emit();
  }

  public groupConditionsValueChange(index: number, values: MultiInputValues): void {
    const currentGroups = this.$orGroups();

    if (isEqual(currentGroups[index]?.rows, values)) {
      return;
    }

    this.$orGroups.set(
      currentGroups.map((group, groupIndex) => (groupIndex === index ? {rows: values} : group))
    );
    this.emit();
  }

  public addOrGroup(): void {
    this.$orGroups.set([...this.$orGroups(), {rows: [{key: '', dropdown: '', value: ''}]}]);
    this.emit();
  }

  public deleteOrGroup(index: number): void {
    this.$orGroups.set(this.$orGroups().filter((_, groupIndex) => groupIndex !== index));
    this.emit();
  }

  private emit(): void {
    const flatLeaves: ConditionNode[] = this._$flatRows()
      .filter(row => this.isRowComplete(row))
      .map(row => this.rowToLeaf(row));

    const orGroups: ConditionNode[] = this.$orGroups()
      .map(group => ({
        or: group.rows.filter(row => this.isRowComplete(row)).map(row => this.rowToLeaf(row)),
      }))
      .filter(group => group.or.length > 0);

    const conditions: ConditionNode[] = [...flatLeaves, ...orGroups, ...this._$passthroughNodes()];

    this.configurationEvent.emit({
      valid: this.isValid(),
      data: {
        caseDefinitionName: this._$selectedCaseDefinitionName() ?? undefined,
        conditions,
      },
    });
  }

  private isValid(): boolean {
    const flatValid = this._$flatRows().every(row => !this.isRowPartial(row));
    const groupsValid = this.$orGroups().every(group =>
      group.rows.every(row => !this.isRowPartial(row))
    );

    return flatValid && groupsValid;
  }

  private rowToLeaf(row: MultiInputKeyValue): ConditionLeaf {
    return {
      path: row.key ?? '',
      operator: row.dropdown ?? '',
      value: row.value ?? '',
    };
  }

  private isRowComplete(row: MultiInputKeyValue): boolean {
    return !!row.key && !!row.dropdown && !!row.value;
  }

  private isRowEmpty(row: MultiInputKeyValue): boolean {
    return !row.key && !row.dropdown && !row.value;
  }

  private isRowPartial(row: MultiInputKeyValue): boolean {
    return !this.isRowComplete(row) && !this.isRowEmpty(row);
  }

  private isRawOrGroup(node: RawNode): node is RawOrGroup {
    return Array.isArray((node as RawOrGroup).or);
  }

  private isRawAndGroup(node: RawNode): node is RawAndGroup {
    return Array.isArray((node as RawAndGroup).and);
  }

  private isEditableLeaf(node: RawNode): boolean {
    if (this.isRawOrGroup(node) || this.isRawAndGroup(node)) {
      return false;
    }

    const leaf = node as RawLeaf;
    const hasPath = typeof (leaf.path ?? leaf.queryPath) === 'string';
    const value = leaf.value ?? leaf.queryValue;
    const scalarValue =
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

    return hasPath && scalarValue;
  }

  private rawLeafToRow(leaf: RawLeaf): MultiInputKeyValue {
    return {
      key: (leaf.path ?? leaf.queryPath ?? '') as string,
      dropdown: (leaf.operator ?? leaf.queryOperator ?? '') as string,
      value: String(leaf.value ?? leaf.queryValue ?? ''),
    };
  }
}
