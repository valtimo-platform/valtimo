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
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {AbstractControl, FormBuilder, FormGroup, Validators} from '@angular/forms';
import {Edit16, Information16} from '@carbon/icons';
import {CARBON_CONSTANTS} from '@valtimo/components';
import {DocumentService, TemplatePayload} from '@valtimo/document';
import {IconService} from 'carbon-components-angular';
import {BehaviorSubject, take, tap} from 'rxjs';

@Component({
  selector: 'valtimo-dossier-management-create',
  styleUrls: ['./dossier-management-create.component.scss'],
  templateUrl: './dossier-management-create.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DossierManagementCreateComponent {
  @Input() open = false;
  @Output() closeModal = new EventEmitter<TemplatePayload | null>();

  public formGroup: FormGroup = this.fb.group({
    title: this.fb.control('', Validators.required),
    name: this.fb.control({value: '', disabled: true}, [
      Validators.required,
      Validators.pattern('[A-Za-z0-9-]*'),
    ]),
  });

  private readonly _editActive$ = new BehaviorSubject<boolean>(false);
  public readonly editActive$ = this._editActive$.pipe(
    tap((editActive: boolean) => {
      const name: AbstractControl | null = this.formGroup.get('name');
      if (!name) {
        return;
      }

      if (editActive) {
        name.enable();
        return;
      }
      name.disable();
    })
  );
  public readonly editDisabled$ = new BehaviorSubject<boolean>(true);
  public readonly idError$ = new BehaviorSubject<string | null>(null);

  constructor(
    private readonly documentService: DocumentService,
    private readonly fb: FormBuilder,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Edit16, Information16]);
  }

  public onCloseModal(definitionCreated?: boolean): void {
    if (!definitionCreated) {
      this.closeModal.emit(null);
      this.resetForm();
      return;
    }

    const {name, title} = this.formGroup.controls;
    if (!name || !title) {
      return;
    }

    this.documentService
      .getDocumentDefinition(name.value, true)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.idError$.next('dossierManagement.createDefinition.idError');
          this.editDisabled$.next(false);
          this.enableEdit();
        },
        error: () => {
          this.closeModal.emit({
            documentDefinitionId: name.value,
            documentDefinitionTitle: title.value,
          });
          this.resetForm();
        },
      });
  }

  public enableEdit(): void {
    this._editActive$.next(true);
  }

  public onFocusOut(): void {
    const {name, title} = this.formGroup.controls;
    if (!name || !title) {
      return;
    }

    if (!title.value) {
      return;
    }

    name.patchValue(title.value.replace(/\W+/g, '-').replace(/\-$/, '').toLowerCase());
    this.editDisabled$.next(false);
  }

  private resetForm(): void {
    setTimeout(() => {
      this.formGroup.reset();
      this.idError$.next(null);
      this._editActive$.next(false);
      this.editDisabled$.next(true);
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
}
