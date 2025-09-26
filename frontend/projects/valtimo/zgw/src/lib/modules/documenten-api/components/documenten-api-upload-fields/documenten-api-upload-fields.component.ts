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
import {ChangeDetectionStrategy, Component, ViewChild} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  ActionItem,
  CarbonListComponent,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  ViewType,
} from '@valtimo/components';
import {
  CaseManagementParams,
  EditPermissionsService,
  getCaseManagementRouteParams,
} from '@valtimo/shared';
import {ButtonModule, IconModule} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import {DocumentenApiColumnModalType, DocumentenApiColumnModalTypeCloseEvent} from '../../models';
import {DocumentenApiUploadField} from '../../models/documenten-api-upload-field.model';
import {DocumentenApiDocumentService} from '../../services';
import {DocumentenApiUploadFieldModalComponent} from '../documenten-api-upload-field-model/documenten-api-upload-field-modal.component';
import {take} from 'rxjs/operators';

@Component({
  selector: 'valtimo-documenten-api-upload-fields',
  templateUrl: './documenten-api-upload-fields.component.html',
  styleUrls: ['./documenten-api-upload-fields.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    CarbonListModule,
    TranslateModule,
    ConfirmationModalModule,
    ButtonModule,
    IconModule,
    DocumentenApiUploadFieldModalComponent,
  ],
})
export class DocumentenApiUploadFieldsComponent {
  @ViewChild(CarbonListComponent) carbonList: CarbonListComponent;

  private readonly _reload$ = new BehaviorSubject<null | 'noAnimation'>(null);

  public readonly caseDefinitionKey$: Observable<string> = getCaseManagementRouteParams(
    this.route
  ).pipe(
    map((params: CaseManagementParams | undefined) => params?.caseDefinitionKey ?? ''),
    filter(caseDefinitionKey => !!caseDefinitionKey)
  );
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly fields$ = new BehaviorSubject<ColumnConfig[]>([]);
  public readonly uploadFieldModalType$ = new BehaviorSubject<DocumentenApiColumnModalType>(
    'closed'
  );
  public readonly prefill$ = new BehaviorSubject<DocumentenApiUploadField | undefined>(undefined);

  public readonly documentUploadFields$: Observable<string[]> = combineLatest([
    this.caseDefinitionKey$,
    this._reload$,
    this.translateService.stream('key'),
  ]).pipe(
    tap(([_, reload]) => {
      if (reload === null) {
        this.loading$.next(true);
      }
    }),
    switchMap(([caseDefinitionKey]) =>
      this.documentenApiDocumentService.getUploadFields(caseDefinitionKey)
    ),
    map(fields =>
      fields.map(field => ({
        ...field,
        field: this.translateService.instant(`zgw.uploadFields.keys.${field.key}`),
      }))
    ),
    startWith([]),
    tap(() => {
      this.loading$.next(false);
    })
  );

  public readonly hasEditPermissions$: Observable<boolean> = getCaseManagementRouteParams(
    this.route
  ).pipe(
    switchMap(params =>
      this.editPermissionsService.hasEditPermissions(
        params?.caseDefinitionKey,
        params?.caseDefinitionVersionTag
      )
    )
  );

  public readonly ACTION_ITEMS: ActionItem[] = [
    {
      label: 'interface.edit',
      callback: this.openEditModal.bind(this),
      type: 'normal',
    },
  ];

  public readonly FIELDS: ColumnConfig[] = [
    {
      key: 'field',
      label: 'zgw.uploadFields.fields.field',
      viewType: ViewType.TEXT,
    },
    {
      key: 'defaultValue',
      label: 'zgw.uploadFields.fields.defaultValue',
      viewType: ViewType.TEXT,
    },
    {
      key: 'visible',
      label: 'zgw.uploadFields.fields.visible',
      viewType: ViewType.BOOLEAN,
    },
    {
      key: 'readonly',
      label: 'zgw.uploadFields.fields.readonly',
      viewType: ViewType.BOOLEAN,
    },
  ];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly documentenApiDocumentService: DocumentenApiDocumentService,
    private readonly translateService: TranslateService,
    private readonly editPermissionsService: EditPermissionsService
  ) {}

  public openEditModal(uploadField: DocumentenApiUploadField): void {
    this.hasEditPermissions$.pipe(take(1)).subscribe(hasPermission => {
      if (!hasPermission && uploadField.key !== 'informatieobjecttype') {
        return;
      }
      this.prefill$.next(uploadField);
      this.uploadFieldModalType$.next('edit');
    });
  }

  public closeModal(closeModalEvent: DocumentenApiColumnModalTypeCloseEvent): void {
    if (closeModalEvent === 'closeAndRefresh') {
      this.reload();
    }
    this.uploadFieldModalType$.next('closed');
  }

  private reload(noAnimation = false): void {
    this._reload$.next(noAnimation ? 'noAnimation' : null);
  }
}
