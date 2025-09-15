import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import {ListField, ListHiddenColumn} from '../../models';
import {CommonModule} from '@angular/common';
import {
  ButtonModule,
  CheckboxModule,
  DialogModule,
  IconModule,
  TagModule,
} from 'carbon-components-angular';
import {TranslateModule} from '@ngx-translate/core';

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
  ],
})
export class ListColumnViewComponent {
  private readonly _$availableFields = signal<(ListField & {selected: boolean | undefined})[]>([]);
  @Input() public set availableFields(value: ListField[]) {
    if (!value) return;

    this._$availableFields.set(value.map(item => ({...item, selected: undefined})));
  }

  private readonly _$hiddenColumns = signal<ListField[]>([]);
  @Input() public set hiddenColumns(value: ListField[] | undefined) {
    if (!value) return;
    this._$hiddenColumns.set(value);
  }

  @Output() public readonly viewUpdateEvent = new EventEmitter<ListHiddenColumn[]>();

  public readonly $availableFields = computed(() =>
    this._$availableFields().map(field => {
      return {
        ...field,
        selected:
          field.selected === undefined
            ? !this._$hiddenColumns().find(hiddenColumn => hiddenColumn.key === field.key)
            : field.selected,
      };
    })
  );

  public readonly $checkedItemsCount = computed(
    () => this.$availableFields().filter(field => field.selected).length
  );

  public onCheckedChange(selected: boolean, fieldKey: string): void {
    this._$availableFields.update((fields: (ListField & {selected: boolean | undefined})[]) =>
      fields.map((field: ListField & {selected: boolean | undefined}) =>
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
