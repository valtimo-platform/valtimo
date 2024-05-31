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
  Output,
} from '@angular/core';
import {DocumentenApiColumnModalTypeCloseEvent} from '../../models';
import {BehaviorSubject, Subscription} from 'rxjs';
import {CARBON_CONSTANTS} from '@valtimo/components';
import {AbstractControl, FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {
  ButtonModule,
  DropdownModule,
  InputModule,
  ModalModule,
  TagModule,
  ToggleModule,
} from 'carbon-components-angular';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {CommonModule} from '@angular/common';
import {DocumentenApiTagService} from '../../services/documenten-api-tag.service';
import {DocumentenApiTag} from '../../models/documenten-api-tag.model';
import {Utils} from 'formiojs';
import getValue = Utils.getValue;

@Component({
  selector: 'valtimo-documenten-api-tag-modal',
  templateUrl: './documenten-api-tag-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ModalModule,
    TagModule,
    TranslateModule,
    InputModule,
    ReactiveFormsModule,
    ButtonModule,
    DropdownModule,
    ToggleModule,
  ],
})
export class DocumentenApiTagModalComponent implements OnDestroy {
  @Input() public documentDefinitionName!: string;
  @Input() public open = false;

  @Output() public closeModalEvent = new EventEmitter<DocumentenApiColumnModalTypeCloseEvent>();

  public readonly tagFormGroup = this.fb.group({
    value: this.fb.control('', [Validators.required, Validators.maxLength(50)]),
  });

  public readonly disabled$ = new BehaviorSubject<boolean>(false);

  public get value(): AbstractControl<string, string> {
    return this.tagFormGroup?.get('value');
  }

  public get invalid(): boolean {
    return !!this.tagFormGroup?.invalid;
  }

  public get pristine(): boolean {
    return !!this.tagFormGroup?.pristine;
  }

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly documentenApiTagService: DocumentenApiTagService
  ) {}

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onClose(): void {
    this.close();
  }

  public addTag(): void {
    this.disable();

    this.documentenApiTagService
      .createTag(this.documentDefinitionName, this.value.value)
      .subscribe({
        next: () => {
          this.enable();
          this.closeAndRefresh();
          this.resetForm();
        },
        error: () => {
          this.enable(false);
        },
      });
  }

  private resetForm(): void {
    this.tagFormGroup.reset();
  }

  private disable(): void {
    this.disabled$.next(true);
    this.tagFormGroup.disable();
  }

  private enable(delay = true): void {
    setTimeout(
      () => {
        this.disabled$.next(false);
        this.tagFormGroup.enable();
      },
      delay ? CARBON_CONSTANTS.modalAnimationMs : 0
    );
  }

  private close(): void {
    this.closeModalEvent.emit('close');
    this.resetForm();
  }

  private closeAndRefresh(): void {
    this.closeModalEvent.emit('closeAndRefresh');
    this.resetForm();
  }
}
