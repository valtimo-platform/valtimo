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
import {StatusModalCloseEvent, StatusModalType} from '../../../models';
import {BehaviorSubject, combineLatest, map, Observable, Subscription, switchMap, take} from 'rxjs';
import {CARBON_CONSTANTS} from '@valtimo/components';
import {
  AbstractControl,
  AsyncValidatorFn,
  FormBuilder,
  FormControl,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {CaseTagService, CaseTagsUtils, CaseTag} from '@valtimo/document';
import {IconService} from 'carbon-components-angular';
import {Edit16} from '@carbon/icons';
import {ListItem} from 'carbon-components-angular/dropdown/list-item.interface';
import {TranslateService} from '@ngx-translate/core';
import {TagColor} from '@valtimo/config';

@Component({
  selector: 'valtimo-dossier-management-case-tag-modal',
  templateUrl: './dossier-management-case-tag-modal.component.html',
  styleUrls: ['./dossier-management-case-tag-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DossierManagementModalComponent implements OnInit, OnDestroy {
  @Input() public set type(value: StatusModalType) {
    this._type$.next(value);

    if (value === 'closed') {
      setTimeout(() => {
        this._typeAnimationDelay$.next(value);
      }, CARBON_CONSTANTS.modalAnimationMs);
    } else {
      this._typeAnimationDelay$.next(value);
    }
  }

  @Input() public set prefill(value: CaseTag) {
    this._prefillCaseTag.next(value);
  }

  @Input() public usedKeys!: string[];
  @Input() public documentDefinitionName!: string;

  @Output() public closeModalEvent = new EventEmitter<StatusModalCloseEvent>();

  public isCaseTag: boolean = false;

  private readonly _type$ = new BehaviorSubject<StatusModalType | undefined>(undefined);
  private readonly _typeAnimationDelay$ = new BehaviorSubject<StatusModalType | undefined>(
    undefined
  );
  private readonly _prefillCaseTag = new BehaviorSubject<CaseTag | undefined>(undefined);

  public readonly caseTagFormGroup = this.fb.group({
    title: this.fb.control('', Validators.required),
    key: this.fb.control('', [
      Validators.required,
      Validators.minLength(3),
      this.uniqueKeyValidator,
    ]),
    color: this.fb.control('', Validators.required),
  });

  public readonly isEdit$ = combineLatest([this._typeAnimationDelay$, this._prefillCaseTag]).pipe(
    map(([type, prefillCaseTag]) => {
      if (type === 'edit' && prefillCaseTag) {
        this.prefillForm(prefillCaseTag);
      }
      return type === 'edit';
    })
  );

  public readonly isAdd$ = this._typeAnimationDelay$.pipe(
    map(type => {
      if (type === 'add') this.resetForm();
      return type === 'add';
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
          'interface.tagType.' + CaseTagsUtils.getTagTypeFromCaseTagColor(color)
        ),
        color,
        tagType: CaseTagsUtils.getTagTypeFromCaseTagColor(color),
      }))
    )
  );

  public get key(): AbstractControl<string | null, string | null> {
    return this.caseTagFormGroup?.get('key') ?? new FormControl('');
  }

  public get title(): AbstractControl<string | null, string | null> {
    return this.caseTagFormGroup?.get('title') ?? new FormControl('');
  }

  public get color(): AbstractControl<string | null, string | null> {
    return this.caseTagFormGroup?.get('color') ?? new FormControl('');
  }

  public get invalid(): boolean {
    return !!this.caseTagFormGroup?.invalid;
  }

  public get pristine(): boolean {
    return !!this.caseTagFormGroup?.pristine;
  }

  public readonly editingKey$ = new BehaviorSubject<boolean>(false);

  private readonly _originalCaseTagKey$ = new BehaviorSubject<string>('');

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly iconService: IconService,
    private readonly translateService: TranslateService,
    private readonly caseTagService: CaseTagService
  ) {
    this.iconService.registerAll([Edit16]);
  }

  public ngOnInit(): void {
    this.openAutoKeySubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public addCaseTag(): void {
    this.disable();
    this._subscriptions.add(
      this.caseTagService.saveCaseTag(this.documentDefinitionName, this.getFormValue()).subscribe({
        next: () => {
          this.enable();
          this.closeAndRefresh();
        },
        error: () => {
          this.enable(false);
        },
      })
    );
  }

  public editCaseTag(): void {
    this.disable();

    this._originalCaseTagKey$
      .pipe(
        take(1),
        switchMap(originalCaseTagKey => {
          return this.caseTagService.updateCaseTag(
            this.documentDefinitionName,
            originalCaseTagKey,
            this.getFormValue()
          );
        })
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
      this.caseTagFormGroup.patchValue({color: newColor});
      this.caseTagFormGroup.markAsDirty();
    }
  }

  public close(): void {
    this.closeModalEvent.emit('close');
  }

  public onClose(): void {
    this.close();
  }

  private prefillForm(prefillCaseTag: CaseTag): void {
    this._originalCaseTagKey$.next(prefillCaseTag.key);
    this.caseTagFormGroup.patchValue({
      key: prefillCaseTag.key,
      title: prefillCaseTag.title,
      color: prefillCaseTag.color,
    });
    this._selectedColor$.next(prefillCaseTag.color);
    this.caseTagFormGroup.markAsPristine();
    this.resetEditingKey();
  }

  private resetForm(): void {
    this.caseTagFormGroup.patchValue({
      key: '',
      title: '',
      color: TagColor.Blue,
    });
    this._selectedColor$.next(TagColor.Blue);
    this.caseTagFormGroup.markAsPristine();
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
              this.caseTagFormGroup.patchValue({key: this.getUniqueKey(titleValue)});
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
    this.caseTagFormGroup.patchValue({key: ''});
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
    this.caseTagFormGroup.disable();
  }

  private enable(delay = true): void {
    setTimeout(
      () => {
        this.disabled$.next(false);
        this.caseTagFormGroup.enable();
      },
      delay ? CARBON_CONSTANTS.modalAnimationMs : 0
    );
  }

  private closeAndRefresh(): void {
    this.closeModalEvent.emit('closeAndRefresh');
  }

  private getFormValue(): CaseTag {
    return {
      key: this.key.value,
      title: this.title.value,
      color: this.color.value as TagColor,
    };
  }
}
