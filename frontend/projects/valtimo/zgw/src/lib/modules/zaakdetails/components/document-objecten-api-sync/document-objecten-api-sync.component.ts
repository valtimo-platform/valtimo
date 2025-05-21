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
import {CommonModule} from '@angular/common';
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
import {Edit16, TrashCan16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {
  CdsThemeService,
  FormModule,
  InputModule,
  SelectItem,
  SelectModule,
  SpinnerModule,
  ValtimoCdsModalDirectiveModule,
} from '@valtimo/components';
import {getCaseManagementRouteParams} from '@valtimo/shared';
import {DocumentDefinition, DocumentService} from '@valtimo/document';
import {
  ButtonModule,
  CheckboxModule,
  IconModule,
  IconService,
  LayerModule,
  ModalModule,
  TilesModule,
} from 'carbon-components-angular';
import {BehaviorSubject, map, Observable, switchMap, tap} from 'rxjs';
import {DocumentObjectenApiSync} from '../../models';
import {DocumentObjectenApiSyncService} from '../../services';

@Component({
  selector: 'valtimo-document-objecten-api-sync',
  templateUrl: './document-objecten-api-sync.component.html',
  styleUrls: ['./document-objecten-api-sync.component.scss'],
  standalone: true,
  imports: [
    ButtonModule,
    CheckboxModule,
    CommonModule,
    FormModule,
    FormsModule,
    IconModule,
    InputModule,
    LayerModule,
    ModalModule,
    ReactiveFormsModule,
    SelectModule,
    SpinnerModule,
    TilesModule,
    TranslateModule,
    ValtimoCdsModalDirectiveModule,
  ],
})
export class DocumentObjectenApiSyncComponent implements OnInit {
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  private readonly documentDefinition$: Observable<DocumentDefinition> =
    getCaseManagementRouteParams(this.route).pipe(
      switchMap(params =>
        this.documentService.getDocumentDefinitionByVersion(
          params?.caseDefinitionKey ?? '',
          params?.caseDefinitionVersionTag ?? ''
        )
      )
    );
  public readonly documentObjectenApiSync$ = new BehaviorSubject<DocumentObjectenApiSync | null>(
    null
  );
  public readonly objectManagementConfigurationItems$: Observable<Array<SelectItem>> =
    this.documentObjectenApiSyncService.getObjectManagementConfigurations().pipe(
      map(results =>
        results?.map(configuration => ({
          id: configuration.id,
          text: configuration.title,
        }))
      )
    );
  public readonly modalShowing$ = new BehaviorSubject<boolean>(false);
  public readonly currentTheme$ = this.cdsThemeService.currentTheme$;
  public readonly formGroup = new FormGroup({
    objectManagementConfigurationId: new FormControl('', Validators.required),
    enabled: new FormControl(true),
  });

  public get objectManagementConfigurationId(): AbstractControl<string | null> | null {
    return this.formGroup.get('objectManagementConfigurationId') ?? null;
  }

  public get enabled(): AbstractControl<boolean | null> | null {
    return this.formGroup.get('enabled') ?? null;
  }

  public readonly valid$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly documentObjectenApiSyncService: DocumentObjectenApiSyncService,
    private readonly documentService: DocumentService,
    private readonly cdsThemeService: CdsThemeService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([TrashCan16, Edit16]);
  }

  public ngOnInit(): void {
    this.loadDocumentenObjectenApiSync();
  }

  public loadDocumentenObjectenApiSync(): void {
    this.documentDefinition$
      .pipe(
        switchMap((documentDefinition: DocumentDefinition) =>
          this.documentObjectenApiSyncService.getDocumentObjectenApiSync(
            documentDefinition.id.caseDefinitionId.key,
            documentDefinition.id.caseDefinitionId.versionTag
          )
        )
      )
      .subscribe(documentObjectenApiSync => {
        this.loading$.next(false);
        this.configSelected(documentObjectenApiSync?.objectManagementConfigurationId);
        this.enabled?.patchValue(documentObjectenApiSync?.enabled);
        this.documentObjectenApiSync$.next(documentObjectenApiSync);
      });
  }

  public remove(): void {
    this.documentDefinition$
      .pipe(
        switchMap(documentDefinition =>
          this.documentObjectenApiSyncService.deleteDocumentObjectenApiSync(
            documentDefinition.id.caseDefinitionId.key,
            documentDefinition.id.caseDefinitionId.versionTag
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
            documentDefinition.id.caseDefinitionId.key,
            documentDefinition.id.caseDefinitionId.versionTag,
            {
              objectManagementConfigurationId: formValues.objectManagementConfigurationId ?? '',
              enabled: !!formValues.enabled,
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
    if (!this.objectManagementConfigurationId) return;

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
