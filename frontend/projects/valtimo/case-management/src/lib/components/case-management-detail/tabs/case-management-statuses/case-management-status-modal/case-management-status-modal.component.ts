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

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {StatusModalCloseEvent, StatusModalType} from '../../../../../models';
import {
  BehaviorSubject,
  combineLatest,
  map,
  Observable,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {CARBON_CONSTANTS} from '@valtimo/components';
import {
  AbstractControl,
  AsyncValidatorFn,
  FormBuilder,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {CaseStatusService, InternalCaseStatus, InternalCaseStatusUtils} from '@valtimo/document';
import {IconService, ListItem} from 'carbon-components-angular';
import {Edit16} from '@carbon/icons';
import {TranslateService} from '@ngx-translate/core';
import {TagColor} from '@valtimo/shared';
import {CASE_MANAGEMENT_STATUS_MODAL_TEST_IDS} from '../../../../../constants';

@Component({
  standalone: false,
  selector: 'valtimo-case-management-status-modal',
  templateUrl: './case-management-status-modal.component.html',
  styleUrls: ['./case-management-status-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseManagementStatusModalComponent implements OnInit, OnDestroy {
  protected readonly testIds = CASE_MANAGEMENT_STATUS_MODAL_TEST_IDS;

  private _closedAnimationTimeout: ReturnType<typeof setTimeout> | undefined;

  @Input() public set type(value: StatusModalType) {
    this._type$.next(value);

    // Cancel any pending closed animation delay
    if (this._closedAnimationTimeout) {
      clearTimeout(this._closedAnimationTimeout);
      this._closedAnimationTimeout = undefined;
    }

    if (value === 'closed') {
      this._closedAnimationTimeout = setTimeout(() => {
        this._typeAnimationDelay$.next(value);
        this._closedAnimationTimeout = undefined;
      }, CARBON_CONSTANTS.modalAnimationMs);
    } else {
      this._typeAnimationDelay$.next(value);
    }
  }

  @Input() public set prefill(value: InternalCaseStatus) {
    this._prefillStatus.next(value);
  }

  @Input() public usedKeys!: string[];
  @Input() public caseDefinitionKey!: string;

  @Output() public closeModalEvent = new EventEmitter<StatusModalCloseEvent>();

  private readonly _type$ = new BehaviorSubject<StatusModalType>(undefined);
  private readonly _typeAnimationDelay$ = new BehaviorSubject<StatusModalType>(undefined);
  private readonly _prefillStatus = new BehaviorSubject<InternalCaseStatus>(undefined);

  public readonly statusFormGroup = this.fb.group({
    title: this.fb.control('', Validators.required),
    key: this.fb.control('', [
      Validators.required,
      Validators.minLength(3),
      this.uniqueKeyValidator,
    ]),
    retentionPeriodInDays: this.fb.control(-1, [
      Validators.required,
      Validators.pattern(/^(?:-1|0|[1-9]\d*)$/),
    ]),
    visibleInCaseListByDefault: this.fb.control(true, Validators.required),
    color: this.fb.control('', Validators.required),
  });

  private _isEdit!: boolean;

  public readonly isEdit$ = combineLatest([this._typeAnimationDelay$, this._prefillStatus]).pipe(
    tap(([type, prefillStatus]) => {
      if (type === 'edit' && prefillStatus) this.prefillForm(prefillStatus);
    }),
    map(([type]) => type === 'edit'),
    tap(isEdit => (this._isEdit = isEdit))
  );

  public readonly isAdd$ = this._typeAnimationDelay$.pipe(
    map(type => type === 'add'),
    tap(isAdd => {
      if (isAdd) this.resetForm();
    })
  );

  public readonly isClosed$ = this._type$.pipe(map(type => type === 'closed'));

  public readonly disabled$ = new BehaviorSubject<boolean>(false);

  private readonly COLORS: TagColor[] = Object.values(TagColor);

  private readonly _selectedColor$ = new BehaviorSubject<TagColor | undefined>(undefined);

  public readonly colorListItems$: Observable<ListItem[]> = combineLatest([
    this._selectedColor$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([selectedColor]) =>
      this.COLORS.map(color => ({
        selected: color === selectedColor,
        content: this.translateService.instant(
          'interface.tagType.' +
            InternalCaseStatusUtils.getTagTypeFromInternalCaseStatusColor(color)
        ),
        color,
        tagType: InternalCaseStatusUtils.getTagTypeFromInternalCaseStatusColor(color),
      }))
    )
  );

  public get visibleInCaseListByDefault(): AbstractControl<boolean, boolean> {
    return this.statusFormGroup?.get('visibleInCaseListByDefault');
  }

  public get key(): AbstractControl<string, string> {
    return this.statusFormGroup?.get('key');
  }

  public get title(): AbstractControl<string, string> {
    return this.statusFormGroup?.get('title');
  }

  public get retentionPeriodInDays(): AbstractControl<number, number> {
    return this.statusFormGroup?.get('retentionPeriodInDays');
  }

  public get color(): AbstractControl<string, string> {
    return this.statusFormGroup?.get('color');
  }

  public get invalid(): boolean {
    return !!this.statusFormGroup?.invalid;
  }

  public get pristine(): boolean {
    return !!this.statusFormGroup?.pristine;
  }

  public readonly editingKey$ = new BehaviorSubject<boolean>(false);

  public readonly showRetentionPeriod$ = new BehaviorSubject<boolean>(false);

  public toggleRetentionPeriod(checked: boolean): void {
    this.showRetentionPeriod$.next(checked);
    if (!checked) {
      this.retentionPeriodInDays.setValue(-1);
      this.retentionPeriodInDays.markAsDirty();
      this.statusFormGroup.markAsDirty();
    }
  }

  private readonly _originalStatusKey$ = new BehaviorSubject<string>('');

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly iconService: IconService,
    private readonly caseStatusService: CaseStatusService,
    private readonly translateService: TranslateService
  ) {
    this.iconService.registerAll([Edit16]);
  }

  public ngOnInit(): void {
    this.openAutoKeySubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onClose(): void {
    this.close();
  }

  public toggleCheckedChange(checked: boolean): void {
    this.statusFormGroup.patchValue({
      visibleInCaseListByDefault: checked,
    });
    this.statusFormGroup.markAsDirty();
  }

  public addStatus(): void {
    this.disable();

    this.caseStatusService
      .createInternalCaseStatus(this.caseDefinitionKey, this.getFormValue())
      .subscribe({
        next: () => {
          this.enable();
          this.closeAndRefresh();
        },
        error: () => {
          this.enable(false);
        },
      });
  }

  public editStatus(): void {
    this.disable();

    this._originalStatusKey$
      .pipe(
        take(1),
        switchMap(originalStatusKey =>
          this.caseStatusService.updateInternalCaseStatus(
            this.caseDefinitionKey,
            originalStatusKey,
            this.getFormValue()
          )
        )
      )
      .subscribe({
        next: () => {
          this.enable();
          this.closeAndRefresh();
        },
        error: () => {
          this.enable(false);
        },
      });
  }

  public editKeyButtonClick(): void {
    this.editingKey$.next(true);
  }

  public colorDropdownChange(event: {
    item: {color: string; content: string; selected: boolean};
    isUpdate: boolean;
  }): void {
    const newColor = event?.item?.color as TagColor;

    if (newColor) {
      this._selectedColor$.next(newColor);
      this.statusFormGroup.patchValue({color: newColor});
      this.statusFormGroup.markAsDirty();
    }
  }

  private prefillForm(prefillStatus: InternalCaseStatus): void {
    const retentionPeriodInDays = prefillStatus.retentionPeriodInDays ?? -1;
    this.showRetentionPeriod$.next(retentionPeriodInDays !== -1);
    this._originalStatusKey$.next(prefillStatus.key);
    this.statusFormGroup.patchValue({
      key: prefillStatus.key,
      title: prefillStatus.title,
      retentionPeriodInDays: retentionPeriodInDays,
      visibleInCaseListByDefault: prefillStatus.visibleInCaseListByDefault,
      color: prefillStatus.color,
    });
    this._selectedColor$.next(prefillStatus.color);
    this.statusFormGroup.markAsPristine();
    this.resetEditingKey();
  }

  private resetForm(): void {
    this.showRetentionPeriod$.next(false);
    this.statusFormGroup.patchValue({
      key: '',
      title: '',
      visibleInCaseListByDefault: true,
      retentionPeriodInDays: -1,
      color: TagColor.Magenta,
    });
    this._selectedColor$.next(TagColor.Blue);
    this.statusFormGroup.markAsPristine();
    this.resetEditingKey();
  }

  private resetEditingKey(): void {
    this.editingKey$.next(false);
  }

  private openAutoKeySubscription(): void {
    this._subscriptions.add(
      combineLatest([this.isAdd$, this.title.valueChanges, this.editingKey$]).subscribe(
        ([isAdd, titleValue, editingKey]) => {
          if (isAdd && !editingKey) {
            if (titleValue) {
              this.statusFormGroup.patchValue({key: this.getUniqueKey(titleValue)});
            } else {
              this.clearKey();
            }
          }
        }
      )
    );
  }

  private getUniqueKey(title: string): string {
    const dashCaseKey = `${title}`
      .toLowerCase()
      .replace(/[^a-z0-9-_]+|-[^a-z0-9]+/g, '-')
      .replace(/_[-_]+/g, '_')
      .replace(/^[^a-z]+/g, '');
    const usedKeys = this.usedKeys;

    if (!usedKeys.includes(dashCaseKey)) {
      return dashCaseKey;
    }

    return this.getUniqueKeyWithNumber(dashCaseKey, usedKeys);
  }

  private getUniqueKeyWithNumber(dashCaseKey: string, usedKeys: string[]): string {
    const numbersFromCurrentKey = (dashCaseKey.match(/^\d+|\d+\b|\d+(?=\w)/g) || []).map(
      (numberValue: string) => +numberValue
    );
    const lastNumberFromCurrentKey =
      numbersFromCurrentKey.length > 0 && numbersFromCurrentKey[numbersFromCurrentKey.length - 1];
    const newKey = lastNumberFromCurrentKey
      ? `${dashCaseKey.replace(`${lastNumberFromCurrentKey}`, `${lastNumberFromCurrentKey + 1}`)}`
      : `${dashCaseKey}-1`;

    if (usedKeys.includes(newKey)) {
      return this.getUniqueKeyWithNumber(newKey, usedKeys);
    }

    return newKey;
  }

  private clearKey(): void {
    this.statusFormGroup.patchValue({key: ''});
  }

  private uniqueKeyValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> =>
      combineLatest([this.isEdit$, control.valueChanges]).pipe(
        map(([isEdit, keyValue]) =>
          this.usedKeys?.every((key: string) => key !== keyValue) || isEdit
            ? null
            : {uniqueKey: {value: control.value}}
        )
      );
  }

  private disable(): void {
    this.disabled$.next(true);
    this.statusFormGroup.disable();
  }

  private enable(delay = true): void {
    setTimeout(
      () => {
        this.disabled$.next(false);
        this.statusFormGroup.enable();
      },
      delay ? CARBON_CONSTANTS.modalAnimationMs : 0
    );
  }

  private close(): void {
    this.closeModalEvent.emit('close');
  }

  private closeAndRefresh(): void {
    this.closeModalEvent.emit('closeAndRefresh');
  }

  private getFormValue(): InternalCaseStatus {
    return {
      key: this.key.value,
      title: this.title.value,
      retentionPeriodInDays: this.retentionPeriodInDays.value,
      visibleInCaseListByDefault: this.visibleInCaseListByDefault.value,
      color: this.color.value as TagColor,
    };
  }
}
