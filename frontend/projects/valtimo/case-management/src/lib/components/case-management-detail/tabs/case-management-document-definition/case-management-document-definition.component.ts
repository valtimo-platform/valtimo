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
  Output,
  ViewChild,
} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Edit16, Save16} from '@carbon/icons';
import {ConfirmationModalComponent, EditorModel, PageHeaderService} from '@valtimo/components';
import {DocumentDefinitionCreateRequest, DocumentService} from '@valtimo/document';
import {
  CaseManagementParams,
  EditPermissionsService,
  getCaseManagementRouteParams,
} from '@valtimo/shared';
import {IconService} from 'carbon-components-angular';
import {BehaviorSubject, Observable} from 'rxjs';
import {switchMap, take} from 'rxjs/operators';
import {CaseDetailService} from '../../../../services';

@Component({
  standalone: false,
  templateUrl: './case-management-document-definition.component.html',
  styleUrls: ['./case-management-document-definition.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseManagementDocumentDefinitionComponent {
  @ViewChild('cancelModal') public cancelModal: ConfirmationModalComponent;
  @Input() caseDefinitionKey: string;
  @Output() cancelRedirect = new EventEmitter();
  @Output() confirmRedirect = new EventEmitter();
  @Output() pendingChangesUpdate = new EventEmitter<boolean>();

  public readonly loadingDocumentDefinition$ = this.caseDetailService.loadingDocumentDefinition$;
  private readonly _refreshEditor$ = new BehaviorSubject<null>(null);
  public readonly documentDefinitionModel$: Observable<EditorModel> = this._refreshEditor$.pipe(
    switchMap(() => this.caseDetailService.documentDefinitionModel$)
  );

  private readonly _pendingChanges$ = new BehaviorSubject<boolean>(false);
  public readonly selectedDocumentDefinition$ = this.caseDetailService.documentDefinition$;

  public readonly params$: Observable<CaseManagementParams | undefined> =
    getCaseManagementRouteParams(this.route);

  public readonly hasEditPermissions$: Observable<boolean> = this.params$.pipe(
    switchMap(params =>
      this.editPermissionsService.hasEditPermissions(
        params?.caseDefinitionKey ?? '',
        params?.caseDefinitionVersionTag ?? ''
      )
    )
  );

  constructor(
    private readonly documentService: DocumentService,
    private readonly caseDetailService: CaseDetailService,
    private readonly iconService: IconService,
    private readonly pageHeaderService: PageHeaderService,
    private readonly route: ActivatedRoute,
    private readonly editPermissionsService: EditPermissionsService
  ) {
    this.iconService.registerAll([Edit16, Save16]);
    this._pendingChanges$.subscribe((pendingChanges: boolean) =>
      this.pendingChangesUpdate.emit(pendingChanges)
    );
  }

  public downloadDefinition(): void {
    this.selectedDocumentDefinition$.pipe(take(1)).subscribe(definition => {
      const {key, versionTag} = definition.id.caseDefinitionId;
      const dataString =
        'data:text/json;charset=utf-8,' +
        encodeURIComponent(JSON.stringify(definition.schema, null, 2));
      const downloadAnchorElement = document.getElementById('downloadAnchorElement');
      if (!downloadAnchorElement) {
        return;
      }

      downloadAnchorElement.setAttribute('href', dataString);
      downloadAnchorElement.setAttribute('download', `${key}-v${versionTag}.json`);
      downloadAnchorElement.click();
    });
  }

  public onDiscardEvent(): void {
    this._pendingChanges$.next(false);
    this.confirmRedirect.emit();
  }

  public onKeepEditingEvent(): void {
    this.cancelRedirect.emit();
  }

  public onSaveEvent(definition): void {
    const newDocumentDefinition = new DocumentDefinitionCreateRequest(JSON.stringify(definition));

    this.params$
      .pipe(
        switchMap(params =>
          this.documentService.updateDocumentDefinitionForManagement(
            params?.caseDefinitionKey ?? '',
            params?.caseDefinitionVersionTag ?? '',
            newDocumentDefinition
          )
        )
      )
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.caseDetailService.setSelectedCaseDefinitionKey(this.caseDefinitionKey);
          this.confirmRedirect.emit();
          this._pendingChanges$.next(false);
          this.caseDetailService.reloadDocumentDefinition();
        },
        error: () => {
          this.cancelRedirect.emit();
        },
      });
  }

  public onChangeEvent(): void {
    this._pendingChanges$.next(true);
  }
}
