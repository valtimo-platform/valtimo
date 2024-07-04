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

import {Component, OnInit} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {
  CdsThemeService,
  FormModule,
  InputModule,
  SelectItem,
  SelectModule,
  SpinnerModule,
  ValtimoCdsModalDirectiveModule,
} from '@valtimo/components';
import {TranslateModule} from '@ngx-translate/core';
import {BehaviorSubject, map, Observable, switchMap, tap} from 'rxjs';
import {CommonModule} from '@angular/common';
import {ButtonModule, CheckboxModule, ModalModule} from 'carbon-components-angular';
import {DocumentObjectenApiSyncService} from '../../services';
import {DocumentObjectenApiSync} from '../../models';
import {DocumentDefinition} from '@valtimo/document';

@Component({
  selector: 'valtimo-document-objecten-api-sync',
  templateUrl: './document-objecten-api-sync.component.html',
  styleUrls: ['./document-objecten-api-sync.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    SpinnerModule,
    FormModule,
    InputModule,
    SelectModule,
    ValtimoCdsModalDirectiveModule,
    CheckboxModule,
    ReactiveFormsModule,
    ButtonModule,
    ModalModule,
  ],
})
export class DocumentObjectenApiSyncComponent implements OnInit {
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  private readonly documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params.name || '')
  );
  private readonly documentDefinition$: Observable<DocumentDefinition> =
    this.documentDefinitionName$.pipe(
      switchMap(documentDefinitionName =>
        this.documentObjectenApiSyncService.getDocumentDefinition(documentDefinitionName)
      )
    );
  public readonly documentObjectenApiSync$ = new BehaviorSubject<DocumentObjectenApiSync>(null);
  public readonly objectManagementConfigurationItems$: Observable<Array<SelectItem>> =
    this.documentObjectenApiSyncService.getObjectManagementConfigurations().pipe(
      map(results =>
        results?.map(configuration => ({
          id: configuration.id,
          text: configuration.title,
        }))
      )
    );
  private readonly modalShowing$ = new BehaviorSubject<boolean>(false);
  public readonly currentTheme$ = this.cdsThemeService.currentTheme$
  public readonly formGroup = new FormGroup({
    objectManagementConfigurationId: new FormControl('', Validators.required),
    enabled: new FormControl(true),
  });

  public get objectManagementConfigurationId(): AbstractControl<string> {
    return this.formGroup.get('objectManagementConfigurationId');
  }

  public get enabled(): AbstractControl<boolean> {
    return this.formGroup.get('enabled');
  }

  public readonly valid$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly documentObjectenApiSyncService: DocumentObjectenApiSyncService,
    private readonly cdsThemeService: CdsThemeService
  ) {}

  public ngOnInit(): void {
    this.loadDocumentenObjectenApiSync();
  }

  public loadDocumentenObjectenApiSync(): void {
    this.documentDefinition$
      .pipe(
        switchMap(documentDefinition =>
          this.documentObjectenApiSyncService.getDocumentObjectenApiSync(
            documentDefinition.id.name,
            documentDefinition.id.version
          )
        )
      )
      .subscribe(documentObjectenApiSync => {
        this.loading$.next(false);
        this.configSelected(documentObjectenApiSync?.objectManagementConfigurationId);
        this.enabled.patchValue(documentObjectenApiSync?.enabled);
        this.documentObjectenApiSync$.next(documentObjectenApiSync);
      });
  }

  public remove(): void {
    this.documentDefinition$
      .pipe(
        switchMap(documentDefinition =>
          this.documentObjectenApiSyncService.deleteDocumentObjectenApiSync(
            documentDefinition.id.name,
            documentDefinition.id.version
          )
        ),
        tap(() => {
          this.documentObjectenApiSync$.next(null);
        })
      )
      .subscribe();
  }

  public submit(): void {
    const formValues = this.formGroup.getRawValue();
    this.documentDefinition$
      .pipe(
        switchMap(documentDefinition =>
          this.documentObjectenApiSyncService.updateDocumentObjectenApiSync(
            documentDefinition.id.name,
            documentDefinition.id.version,
            {
              objectManagementConfigurationId: formValues.objectManagementConfigurationId,
              enabled: formValues.enabled,
            }
          )
        )
      )
      .subscribe(() => {
        this.loadDocumentenObjectenApiSync();
        this.hideModal();
      });
  }

  public onModalClose(): void {
    this.hideModal();
  }

  public showModal(): void {
    this.modalShowing$.next(true);
  }

  public configSelected(selectedId: string): void {
    if (!selectedId) {
      this.objectManagementConfigurationId.patchValue('');
    } else {
      this.objectManagementConfigurationId.patchValue(selectedId);
    }
  }

  private hideModal(): void {
    this.modalShowing$.next(false);
  }
}
