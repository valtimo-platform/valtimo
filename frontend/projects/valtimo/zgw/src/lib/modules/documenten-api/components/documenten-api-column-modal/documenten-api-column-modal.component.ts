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
import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  ButtonModule,
  DropdownModule,
  InputModule,
  ListItem,
  ModalModule,
  NotificationContent,
  NotificationModule,
  RadioModule,
} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable, Subscription, switchMap} from 'rxjs';
import {
  ConfiguredColumn,
  DocumentenApiColumnModalType,
  DocumentenApiColumnModalTypeCloseEvent,
} from '../../models';
import {DocumentenApiColumnService} from '../../services';
import {CARBON_CONSTANTS} from '@valtimo/components';

@Component({
  selector: 'valtimo-documenten-api-column-modal',
  templateUrl: './documenten-api-column-modal.component.html',
  styleUrls: ['./documenten-api-column-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ModalModule,
    TranslateModule,
    InputModule,
    ReactiveFormsModule,
    ButtonModule,
    DropdownModule,
    RadioModule,
    NotificationModule,
  ],
})
export class DocumentenApiColumnModalComponent implements OnInit, OnDestroy {
  @Input() public definitionName: string;

  private _prefillColumn!: ListItem[] | null;
  @Input() public set prefillColumn(value: ConfiguredColumn | undefined) {
    if (!value) return;

    const column = {content: value.key, selected: true, column: value};
    const defaultSort = value.defaultSort ?? 'noDefault';
    this.formGroup.patchValue({column, defaultSort});
    this.formGroup.get('column')?.disable();
    this._prefillColumn = [column];
  }
  public get prefillColumn(): ListItem[] | null {
    return this._prefillColumn;
  }

  private _type!: DocumentenApiColumnModalType;
  @Input() public set type(value: DocumentenApiColumnModalType) {
    this._type = value;
    if (value === 'edit') {
      this.formGroup.get('column')?.disable;
    }
  }
  public get type(): DocumentenApiColumnModalType {
    return this._type;
  }

  private readonly _availableColumns$ = new BehaviorSubject<ConfiguredColumn[]>([]);
  @Input() public set availableColumns(value: ConfiguredColumn[]) {
    if (!value) return;

    this._availableColumns$.next(value);
  }

  public readonly availableColumns$: Observable<ListItem[]> = combineLatest([
    this._availableColumns$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([columns]) =>
      columns.map((column: ConfiguredColumn) => ({
        content: this.translateService.instant(`zgw.documentColumns.${column.key}`),
        selected: false,
        column,
      }))
    )
  );

  private _defaultSortedColumn!: ConfiguredColumn | undefined;
  @Input() public set configuredColumns(value: ConfiguredColumn[]) {
    if (!value) return;

    this._defaultSortedColumn = value.find((column: ConfiguredColumn) => !!column.defaultSort);
  }

  @Output() closeModal = new EventEmitter<DocumentenApiColumnModalTypeCloseEvent>();

  public formGroup = this.fb.group({
    column: this.fb.control(
      {content: '', selected: false, column: {} as ConfiguredColumn},
      Validators.required
    ),
    defaultSort: this.fb.control<'ASC' | 'DESC' | 'noDefault'>('noDefault'),
  });

  private readonly _notificationMessage$ = new BehaviorSubject<string>(
    'zgw.columns.defaultWarning'
  );
  public readonly notificationObj$: Observable<NotificationContent> = combineLatest([
    this._notificationMessage$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([message]) => ({
      type: 'warning',
      lowContrast: true,
      title: this.translateService.instant('interface.warning'),
      message: this.translateService.instant(message),
      showClose: false,
    }))
  );

  public showRadioButtons = true;

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly translateService: TranslateService,
    private readonly zgwDocumentenApiColumnService: DocumentenApiColumnService
  ) {}

  public ngOnInit(): void {
    this.openDisableRadioSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onClose(refresh = false): void {
    this.closeModal.emit(refresh ? 'closeAndRefresh' : 'close');

    setTimeout(() => {
      this.formGroup.reset();
      this.formGroup.enable();
      this.showRadioButtons = true;
      this._notificationMessage$.next('zgw.columns.defaultWarning');
      this._prefillColumn = null;
    }, CARBON_CONSTANTS.modalAnimationMs);
  }

  public updateColumn(): void {
    const columnValue: ListItem | null | undefined = this.formGroup.get('column')?.value;
    if (!columnValue || !this.definitionName) {
      return;
    }
    const defaultSortValue = this.formGroup.get('defaultSort')?.value;
    const defaultSort = !defaultSortValue
      ? null
      : defaultSortValue === 'noDefault'
        ? null
        : defaultSortValue;
    const column = {...columnValue.column, defaultSort};

    if (
      !!this._defaultSortedColumn &&
      this._defaultSortedColumn.key !== column.key &&
      !!column.defaultSort
    ) {
      this.zgwDocumentenApiColumnService
        .updateColumn(this.definitionName, {
          ...this._defaultSortedColumn,
          defaultSort: null,
        })
        .pipe(
          switchMap(() =>
            this.zgwDocumentenApiColumnService.updateColumn(this.definitionName, column)
          )
        )
        .subscribe(() => {
          this.onClose(true);
        });

      return;
    }

    this.zgwDocumentenApiColumnService.updateColumn(this.definitionName, column).subscribe(() => {
      this.onClose(true);
    });
  }

  private openDisableRadioSubscription(): void {
    this._subscriptions.add(
      this.formGroup.get('column')?.valueChanges.subscribe(columnValue => {
        this.showRadioButtons = !!columnValue?.column.sortable;

        this._notificationMessage$.next(
          this.showRadioButtons ? 'zgw.columns.defaultWarning' : 'zgw.columns.notSortable'
        );
      })
    );
  }
}
