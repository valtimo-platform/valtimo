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
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  Input,
  Output,
  Signal,
  signal,
} from '@angular/core';
import {ViewOff16, WarningAltFilled16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {
  ButtonModule,
  CheckboxModule,
  DialogModule,
  IconModule,
  IconService,
  InputModule,
  TagModule,
  TooltipModule,
} from 'carbon-components-angular';
import {ListAvailableField, ListField, ListHiddenColumn} from '../../models';
import { TEST_IDS } from '@valtimo/shared';

@Component({
  selector: 'valtimo-list-column-view',
  templateUrl: './list-column-view.component.html',
  styleUrl: './list-column-view.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DialogModule,
    TagModule,
    CheckboxModule,
    ButtonModule,
    TranslateModule,
    IconModule,
    InputModule,
    TooltipModule,
  ],
})
export class ListColumnViewComponent {
  readonly TEST_IDS = TEST_IDS;

  private readonly _$availableFields = signal<ListAvailableField[]>([]);
  @Input() public set availableFields(value: ListField[]) {
    if (!value) return;

    this._$availableFields.set(value.map(item => ({...item, selected: undefined})));
  }

  private readonly _$hiddenColumns = signal<ListField[]>([]);
  @Input() public set hiddenColumns(value: ListField[] | undefined) {
    if (!value) return;
    this._$hiddenColumns.set(value);
  }
  @Input() public disabled: boolean;

  @Output() public readonly viewUpdateEvent = new EventEmitter<ListHiddenColumn[]>();

  public readonly $availableFields = computed(() =>
    this._$availableFields().map(field => ({
      ...field,
      selected:
        field.selected === undefined
          ? !this._$hiddenColumns().find(hiddenColumn => hiddenColumn.key === field.key)
          : field.selected,
    }))
  );

  public readonly $checkedItemsCount: Signal<number> = computed(
    () => this.$availableFields().filter(field => field.selected).length
  );

  constructor(private readonly iconService: IconService) {
    this.iconService.registerAll([ViewOff16, WarningAltFilled16]);
  }

  public onCheckedChange(selected: boolean, fieldKey: string): void {
    this._$availableFields.update((fields: ListAvailableField[]) =>
      fields.map((field: ListAvailableField) =>
        fieldKey !== field.key ? field : {...field, selected}
      )
    );
  }

  public onOpenChange(paneOpen: boolean | undefined): void {
    if (paneOpen === undefined || paneOpen) return;
    const hiddenColumns = this.$availableFields().flatMap(field =>
      !field.selected ? [{columnKey: field.key}] : []
    );

    this.viewUpdateEvent.emit(hiddenColumns);
  }
}
