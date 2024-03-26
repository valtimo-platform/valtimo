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
import {Component, ViewChild} from '@angular/core';
import {ActivatedRoute, ParamMap} from '@angular/router';
import {Link16} from '@carbon/icons';
import {TranslateService} from '@ngx-translate/core';
import {ActionItem, ColumnConfig, ViewType} from '@valtimo/components';
import {DocumentDefinition, DocumentService, ProcessDocumentDefinition} from '@valtimo/document';
import {IconService, NotificationService} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, Observable, switchMap} from 'rxjs';
import {DossierDetailService} from '../../services';
import {DossierManagementConnectModalComponent} from '../dossier-management-connect-modal/dossier-management-connect-modal.component';

@Component({
  selector: 'valtimo-dossier-management-processes',
  templateUrl: './dossier-management-processes.component.html',
  styleUrls: ['./dossier-management-processes.component.scss'],
  providers: [NotificationService],
})
export class DossierManagementProcessesComponent {
  @ViewChild('dossierConnectModal')
  private readonly _dossierConnectModal: DossierManagementConnectModalComponent;

  private readonly _refresh$ = new BehaviorSubject<null>(null);
  public readonly processDocumentDefinitions$: Observable<ProcessDocumentDefinition[]> =
    this._refresh$.pipe(
      switchMap(() =>
        combineLatest([this.route.paramMap, this.dossierDetailService.selectedVersionNumber$])
      ),
      switchMap(([params, version]) =>
        this.documentService.findProcessDocumentDefinitionsByVersion(
          params.get('name') ?? '',
          version
        )
      )
    );

  public readonly documentDefinition$ = this.route.paramMap.pipe(
    switchMap((params: ParamMap) =>
      this.documentService.getDocumentDefinitionForManagement(params.get('name') ?? '')
    )
  );

  public readonly actionItems: ActionItem[] = [
    {
      label: 'dossierManagement.unlinkProcess',
      callback: this.deleteProcessDocumentDefinition.bind(this),
      type: 'danger',
    },
  ];
  public readonly fields: ColumnConfig[] = [
    {
      key: 'processName',
      label: 'interface.name',
      viewType: ViewType.TEXT,
    },
    {
      key: 'canInitializeDocument',
      label: 'processCaseConnection.processCreatesCase',
      viewType: ViewType.BOOLEAN,
    },
    {
      key: 'startableByUser',
      label: 'processCaseConnection.startableWithinCase',
      viewType: ViewType.BOOLEAN,
    },
  ];

  constructor(
    private readonly documentService: DocumentService,
    private readonly iconService: IconService,
    private readonly dossierDetailService: DossierDetailService,
    private readonly route: ActivatedRoute,
    private readonly notificationService: NotificationService,
    private readonly translateService: TranslateService
  ) {
    this.iconService.register(Link16);
  }

  public deleteProcessDocumentDefinition(
    processDocumentDefinition: ProcessDocumentDefinition
  ): void {
    this.documentService
      .deleteProcessDocumentDefinition({
        documentDefinitionName: processDocumentDefinition.id.documentDefinitionId.name,
        processDefinitionKey: processDocumentDefinition.id.processDefinitionKey,
        documentDefinitionVersion: processDocumentDefinition.id.documentDefinitionId.version,
        canInitializeDocument: processDocumentDefinition.canInitializeDocument,
        startableByUser: processDocumentDefinition.startableByUser,
      })
      .subscribe({
        next: () => {
          this.notificationService.showNotification({
            type: 'success',
            title: this.translateService.instant(
              'dossierManagement.processLinkNotification.unlinkSuccess'
            ),
            duration: 5000,
          });
          this.loadProcessDocumentDefinitions();
        },
        error: () => {
          this.notificationService.showNotification({
            type: 'error',
            title: this.translateService.instant(
              'dossierManagement.processLinkNotification.unlinkFailure'
            ),
            duration: 5000,
          });
        },
      });
  }

  public loadProcessDocumentDefinitions(): void {
    this._refresh$.next(null);
  }

  public openDossierConnectModal(documentDefinition: DocumentDefinition): void {
    this._dossierConnectModal.openModal(documentDefinition);
  }
}
