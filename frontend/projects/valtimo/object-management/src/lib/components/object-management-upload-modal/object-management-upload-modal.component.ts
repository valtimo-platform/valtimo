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
  AfterViewInit,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import {BehaviorSubject, Observable, Subject, Subscription} from 'rxjs';
import {take} from 'rxjs/operators';
import {ObjectManagementStateService} from '../../services/object-management-state.service';
import {FormManagementService} from '@valtimo/form-management';
import {PluginManagementService} from '@valtimo/plugin';
import {ObjectManagementService} from '../../services/object-management.service';
import {TranslateService} from '@ngx-translate/core';
import {Objecttype, ObjecttypeKeys} from '../../models/object-management.model';
import {VModalComponent, ModalService} from '@valtimo/components';

@Component({
  selector: 'valtimo-object-management-upload-modal',
  templateUrl: './object-management-upload-modal.component.html',
  styleUrls: ['./object-management-upload-modal.component.scss'],
})
export class ObjectManagementUploadModalComponent implements AfterViewInit, OnDestroy {
  @ViewChild('objectManagementUploadModal') objectManagementUploadModal: VModalComponent;
  @Input() objecttypes?: Objecttype[];

  readonly clear$ = new Subject();
  readonly jsonString$ = new BehaviorSubject<string>('');
  readonly error$ = new BehaviorSubject<string>('');
  readonly disabled$ = new BehaviorSubject<boolean>(false);
  readonly showForm$: Observable<boolean> = this.modalService.modalVisible$;

  private readonly file$ = new BehaviorSubject<File>(undefined);

  private showSubscription!: Subscription;
  private hideSubscription!: Subscription;
  private fileSubscription: Subscription;
  private errorSubscription: Subscription;

  constructor(
    private readonly objectManagementState: ObjectManagementStateService,
    private readonly objectManagementService: ObjectManagementService,
    private readonly formManagementService: FormManagementService,
    private readonly pluginManagementService: PluginManagementService,
    private readonly modalService: ModalService,
    private readonly translateService: TranslateService
  ) {}

  ngAfterViewInit(): void {
    this.openShowSubscription();
    this.openFileSubscription();
    this.openHideSubscription();
  }

  ngOnDestroy(): void {
    this.showSubscription?.unsubscribe();
    this.hideSubscription?.unsubscribe();
    this.fileSubscription.unsubscribe();
  }

  hide(): void {
    this.modalService.closeModal();
  }

  cancel(): void {
    this.hide();
  }

  setFile(file: File): void {
    this.clearError();
    this.file$.next(file);
  }

  uploadDefinition(): void {
    this.disable();

    this.jsonString$.pipe(take(1)).subscribe(objecttypeDefinition => {
      this.objectManagementService
        .createObject({...JSON.parse(objecttypeDefinition)})
        .subscribe(() => {
          this.objectManagementState.refresh();
          this.objectManagementState.hideModal();
        });
      this.closeErrorSubscription();
      this.clearError();
      this.enable();
      this.hide();
    });
  }

  private openErrorSubscription(errorCode: string): void {
    this.closeErrorSubscription();
    this.errorSubscription = this.translateService.stream(errorCode).subscribe(error => {
      this.error$.next(error);
    });
  }

  private closeErrorSubscription(): void {
    if (this.errorSubscription) {
      this.errorSubscription.unsubscribe();
    }
  }

  private openFileSubscription(): void {
    this.fileSubscription = this.file$.subscribe(file => {
      if (file) {
        const reader = new FileReader();

        reader.onloadend = () => {
          const result = reader.result.toString();
          if (this.isValidJsonObjecttype(result)) {
            this.jsonString$.next(result);
          } else {
            this.clearJsonString();
          }
        };

        reader.readAsText(file);
      } else {
        this.clearJsonString();
      }
    });
  }

  private openShowSubscription(): void {
    this.showSubscription = this.objectManagementState.showModal$.subscribe(() => {
      this.show();

      this.clearJsonString();
      this.clearError();
      this.clearDropzone();
    });
  }

  private openHideSubscription(): void {
    this.hideSubscription = this.objectManagementState.hideModal$.subscribe(() => {
      this.hide();
    });
  }

  private show(): void {
    this.objectManagementState.modalType$.pipe(take(1)).subscribe(modalType => {
      if (modalType === 'upload') {
        this.modalService.openModal(this.objectManagementUploadModal);
      }
    });
  }

  private clearError(): void {
    this.error$.next('');
  }

  private clearJsonString(): void {
    this.jsonString$.next('');
  }

  private clearDropzone(): void {
    this.clear$.next(null);
  }

  private isValidJsonObjecttype(string: string) {
    const jsonObjecttype = JSON.parse(string);
    const isValid = this.validateObject(jsonObjecttype, [
      'title',
      'objecttypenApiPluginConfigurationId',
      'objecttypeId',
      'objecttypeVersion',
      'objectenApiPluginConfigurationId',
      'showInDataMenu',
    ]);
    const isObjecttypeTitleUnique = !this.objecttypes?.find(
      objecttype => objecttype.title === jsonObjecttype.title
    );
    if (isValid && isObjecttypeTitleUnique) {
      return true;
    } else if (isValid && !isObjecttypeTitleUnique) {
      this.clearDropzone();
      this.openErrorSubscription('dropzone.error.objecttypeAlreadyExists');
      return false;
    } else if (!isValid && isObjecttypeTitleUnique) {
      this.clearDropzone();
      this.openErrorSubscription('dropzone.error.invalidObjecttypeDef');
      return false;
    }
  }

  validateObject(obj: object, requiredKeys: ObjecttypeKeys[]) {
    const objKeys = Object.keys(obj);
    return requiredKeys.every(key => objKeys.includes(key));
  }

  private disable(): void {
    this.disabled$.next(true);
  }

  private enable(): void {
    this.disabled$.next(false);
  }
}
