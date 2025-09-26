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
  Output,
  ViewChild,
} from '@angular/core';
import {Edit16, Save16} from '@carbon/icons';
import {ConfirmationModalComponent, EditorModel, PageHeaderService} from '@valtimo/components';
import {
  DocumentDefinition,
  DocumentDefinitionCreateRequest,
  DocumentService,
} from '@valtimo/document';
import {IconService} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, Observable} from 'rxjs';
import {map, switchMap, take, tap} from 'rxjs/operators';
import {DossierDetailService} from '../../services';

@Component({
  selector: 'valtimo-dossier-management-document-definition',
  templateUrl: './dossier-management-document-definition.component.html',
  styleUrls: ['./dossier-management-document-definition.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DossierManagementDocumentDefinitionComponent {
  @ViewChild('cancelModal') public cancelModal: ConfirmationModalComponent;
  @Input() documentDefinitionName: string;
  @Output() cancelRedirect = new EventEmitter();
  @Output() confirmRedirect = new EventEmitter();
  @Output() pendingChangesUpdate = new EventEmitter<boolean>();

  public readonly loadingDocumentDefinition$ = this.dossierDetailService.loadingDocumentDefinition$;
  private readonly _refreshEditor$ = new BehaviorSubject<null>(null);
  public readonly documentDefinitionModel$: Observable<EditorModel> = this._refreshEditor$.pipe(
    switchMap(() => this.dossierDetailService.documentDefinitionModel$)
  );

  private readonly _pendingChanges$ = new BehaviorSubject<boolean>(false);
  public readonly pendingChanges$: Observable<boolean> = this._pendingChanges$.pipe(
    tap((pendingChanges: boolean) => {
      this.pendingChangesUpdate.emit(pendingChanges);
    })
  );
  public readonly editActive$ = new BehaviorSubject<boolean>(false);
  public readonly showSaveConfirmation$ = new BehaviorSubject<boolean>(false);
  public readonly showCancelConfirmation$ = new BehaviorSubject<boolean>(false);
  public readonly selectedDocumentDefinition$ = this.dossierDetailService.documentDefinition$.pipe(
    tap(
      (documentDefinition: DocumentDefinition) => (this._initialId = documentDefinition.schema.$id)
    )
  );
  private readonly _changeIsValid$ = new BehaviorSubject<boolean>(false);
  private readonly _idChanged$ = new BehaviorSubject<boolean>(false);

  public readonly saveButtonDisabled$ = combineLatest([
    this.pendingChanges$,
    this._changeIsValid$,
    this._idChanged$,
  ]).pipe(
    map(
      ([pendingChanges, changeIsValid, idChanged]) => !pendingChanges || !changeIsValid || idChanged
    )
  );

  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  private _changesToSave: any;
  private _initialId: string;

  constructor(
    private readonly documentService: DocumentService,
    private readonly dossierDetailService: DossierDetailService,
    private readonly iconService: IconService,
    private readonly pageHeaderService: PageHeaderService
  ) {
    this.iconService.registerAll([Edit16, Save16]);
  }

  public downloadDefinition(): void {
    this.selectedDocumentDefinition$.pipe(take(1)).subscribe(definition => {
      const dataString =
        'data:text/json;charset=utf-8,' +
        encodeURIComponent(JSON.stringify(definition.schema, null, 2));
      const downloadAnchorElement = document.getElementById('downloadAnchorElement');
      if (!downloadAnchorElement) {
        return;
      }

      downloadAnchorElement.setAttribute('href', dataString);
      downloadAnchorElement.setAttribute(
        'download',
        `${definition.id.name}-v${definition.id.version}.json`
      );
      downloadAnchorElement.click();
    });
  }

  public discardChanges(): void {
    this.showCancelConfirmation$.next(false);
    this.confirmRedirect.emit();
    this.resetEditorState();
  }

  public keepEditingDefinition(): void {
    this.cancelRedirect.emit();
    this.showSaveConfirmation$.next(false);
    this.showCancelConfirmation$.next(false);
  }

  public onCancelClick(pendingChanges: boolean): void {
    if (pendingChanges) {
      this.showCancelConfirmation$.next(true);
      return;
    }

    this.resetEditorState();
  }

  public saveDefinition(): void {
    this.showSaveConfirmation$.next(false);
    this.editActive$.next(false);
    const newDocumentDefinition = new DocumentDefinitionCreateRequest(
      JSON.stringify(this._changesToSave)
    );

    this.documentService
      .createDocumentDefinitionForManagement(newDocumentDefinition)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.dossierDetailService.setSelectedDocumentDefinitionName(this.documentDefinitionName);
          this.confirmRedirect.emit();
          this._pendingChanges$.next(false);
        },
        error: () => {
          this.cancelRedirect.emit();
        },
      });
  }

  public onEditClick(): void {
    this.editActive$.next(true);
  }

  public onSaveClick(): void {
    this.showSaveConfirmation$.next(true);
  }

  public onValueChangeEvent(value: string): void {
    this._pendingChanges$.next(true);
    this._changesToSave = JSON.parse(value);
    const id: string = this._changesToSave.$id;
    this._idChanged$.next(this._initialId !== id);
  }

  public onValidEvent(valid: boolean): void {
    this._changeIsValid$.next(valid);
  }

  public onCanDeactivate(): void {
    this.showCancelConfirmation$.next(true);
  }

  private resetEditorState(): void {
    this._refreshEditor$.next(null);
    this.editActive$.next(false);
    this._pendingChanges$.next(false);
  }
}
