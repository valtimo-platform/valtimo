import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  EventEmitter,
  Input,
  Output,
  signal,
  WritableSignal,
} from '@angular/core';
import {ListField} from '@valtimo/components';

@Component({
  selector: 'valtimo-case-list-column-view',
  templateUrl: './case-list-column-view.component.html',
  styleUrl: './case-list-column-view.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseListColumnViewComponent {
  private _checkChangeInit = false;

  private readonly _$fields = signal<(ListField & {selected: boolean})[]>([]);
  @Input() public set fields(value: ListField[]) {
    if (!value) return;
    this._$fields.set(value.map(item => ({...item, selected: true})));
  }
  public get $fields(): WritableSignal<(ListField & {selected: boolean})[]> {
    return this._$fields;
  }
  @Output() public readonly viewUpdateEvent = new EventEmitter<string[]>();

  public readonly $checkedItemsCount = computed(
    () => this.$fields().filter(field => field.selected).length
  );

  constructor() {
    effect(() => {
      const keys = this.$fields().flatMap(field => (field.selected ? [field.key] : []));
      if (!!this._checkChangeInit) this.viewUpdateEvent.emit(keys);
    });
  }

  public onCheckedChange(selected: boolean, fieldKey: string): void {
    if (!this._checkChangeInit) {
      this._checkChangeInit = true;
    }
    this.$fields.update((fields: (ListField & {selected: boolean})[]) =>
      fields.map((field: ListField & {selected: boolean}) =>
        fieldKey !== field.key ? field : {...field, selected}
      )
    );
  }
}
