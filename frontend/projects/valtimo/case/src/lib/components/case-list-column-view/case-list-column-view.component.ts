import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import {ListField} from '@valtimo/components';
import {CaseListHiddenColumn} from '../../models';

@Component({
  selector: 'valtimo-case-list-column-view',
  templateUrl: './case-list-column-view.component.html',
  styleUrl: './case-list-column-view.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseListColumnViewComponent {
  private readonly _$fields = signal<(ListField & {selected: boolean | undefined})[]>([]);
  @Input() public set fields(value: ListField[]) {
    if (!value) return;

    this._$fields.set(value.map(item => ({...item, selected: undefined})));
  }

  private readonly _$hiddenColumns = signal<ListField[]>([]);
  @Input() public set hiddenColumns(value: ListField[] | undefined) {
    if (!value) return;
    this._$hiddenColumns.set(value);
  }

  @Output() public readonly viewUpdateEvent = new EventEmitter<CaseListHiddenColumn[]>();

  public readonly $fields = computed(() =>
    this._$fields().map(field => {
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
    () => this.$fields().filter(field => field.selected).length
  );

  public onCheckedChange(selected: boolean, fieldKey: string): void {
    this._$fields.update((fields: (ListField & {selected: boolean | undefined})[]) =>
      fields.map((field: ListField & {selected: boolean | undefined}) =>
        fieldKey !== field.key ? field : {...field, selected}
      )
    );
  }

  public onOpenChange(paneOpen: boolean | undefined): void {
    if (paneOpen === undefined || paneOpen) return;
    const hiddenColumns = this.$fields().flatMap(field =>
      !field.selected ? [{columnKey: field.key}] : []
    );

    this.viewUpdateEvent.emit(hiddenColumns);
  }
}
