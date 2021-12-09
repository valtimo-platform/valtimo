/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

import {AfterViewInit, Component, EventEmitter, Input, OnDestroy, Output, ViewChild} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {MenuService, ModalComponent} from '@valtimo/components';
import {DocumentDefinitionCreateRequest} from '@valtimo/contract';
import {DocumentService} from '@valtimo/document';
import {BehaviorSubject, Observable, Subject, Subscription} from 'rxjs';
import {switchMap, take, tap} from 'rxjs/operators';

@Component({
  selector: 'valtimo-dossier-management-upload',
  templateUrl: './dossier-management-upload.component.html',
  styleUrls: ['./dossier-management-upload.component.scss']
})
export class DossierManagementUploadComponent implements AfterViewInit, OnDestroy {
  @Input() show$: Observable<boolean>;
  @Output() definitionUploaded: EventEmitter<any> = new EventEmitter();

  @ViewChild('uploadDefinitionModal') modal: ModalComponent;

  readonly clear$ = new Subject();

  readonly jsonString$ = new BehaviorSubject<string>('');

  readonly error$ = new BehaviorSubject<string>('');

  readonly disabled$ = new BehaviorSubject<boolean>(false);

  private showSubscription: Subscription;

  private fileSubscription: Subscription;

  private errorSubscription: Subscription;

  private readonly file$ = new BehaviorSubject<File>(undefined);

  constructor(
    private readonly documentService: DocumentService,
    private readonly translateService: TranslateService,
    private readonly menuService: MenuService
  ) {}

  ngAfterViewInit(): void {
    this.openShowSubscription();
    this.openFileSubscription();
  }

  ngOnDestroy(): void {
    this.showSubscription.unsubscribe();
    this.fileSubscription.unsubscribe();
    this.closeErrorSubscription();
  }

  setFile(file: File): void {
    this.clearError();
    this.file$.next(file);
  }

  uploadDefinition(): void {
    this.disable();

    this.jsonString$
      .pipe(
        switchMap(jsonString =>
          this.documentService.createDocumentDefinition(new DocumentDefinitionCreateRequest(jsonString)).pipe(
            tap(
              // success
              () => {
                this.closeErrorSubscription();
                this.clearError();
                this.enable();
                this.hideModal();
                this.menuService.reload();
                this.definitionUploaded.emit();
              },
              // error
              () => {
                this.openErrorSubscription('dropzone.error.invalidDocDef');
                this.enable();
              }
            )
          )
        ),
        take(1)
      )
      .subscribe();
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

  private clearError(): void {
    this.error$.next('');
  }

  private openFileSubscription(): void {
    this.fileSubscription = this.file$.subscribe(file => {
      if (file) {
        const reader = new FileReader();

        reader.onloadend = () => {
          const result = reader.result.toString();
          if (this.stringIsValidJson(result)) {
            this.jsonString$.next(result);
          }
        };

        reader.readAsText(file);
      } else {
        this.clearJsonString();
      }
    });
  }

  private openShowSubscription(): void {
    this.showSubscription = this.show$.subscribe(show => {
      if (show) {
        this.showModal();
      } else {
        this.hideModal();
      }

      this.clearJsonString();
      this.clearError();
      this.clearDropzone();
    });
  }

  private clearJsonString(): void {
    this.jsonString$.next('');
  }

  private clearDropzone(): void {
    this.clear$.next();
  }

  private showModal(): void {
    this.modal.show();
  }

  private hideModal(): void {
    this.modal.hide();
  }

  private stringIsValidJson(string: string) {
    try {
      JSON.parse(string);
    } catch (e) {
      return false;
    }
    return true;
  }

  private disable(): void {
    this.disabled$.next(true);
  }

  private enable(): void {
    this.disabled$.next(false);
  }
}
