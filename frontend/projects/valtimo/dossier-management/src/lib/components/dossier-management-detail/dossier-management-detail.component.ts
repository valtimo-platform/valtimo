/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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

import {Component, OnInit, ViewChild} from '@angular/core';
import {DocumentDefinition, DocumentService, ProcessDocumentDefinition} from '@valtimo/document';
import {ActivatedRoute} from '@angular/router';
import {DossierManagementConnectModalComponent} from '../dossier-management-connect-modal/dossier-management-connect-modal.component';
import {AlertService} from '@valtimo/components';
import {DossierDetailService} from '../../services';
import {take} from 'rxjs/operators';

@Component({
  selector: 'valtimo-dossier-management-detail',
  templateUrl: './dossier-management-detail.component.html',
  styleUrls: ['./dossier-management-detail.component.scss'],
})
export class DossierManagementDetailComponent implements OnInit {
  @ViewChild('dossierConnectModal')
  private readonly _dossierConnectModal: DossierManagementConnectModalComponent;

  public documentDefinitionName: string | null = null;
  public documentDefinition: DocumentDefinition | null = null;
  public processDocumentDefinitions: ProcessDocumentDefinition[] = [];
  public readonly loadingDocumentDefinition$ = this.dossierDetailService.loadingDocumentDefinition$;

  constructor(
    private readonly documentService: DocumentService,
    private readonly route: ActivatedRoute,
    private readonly alertService: AlertService,
    private readonly dossierDetailService: DossierDetailService
  ) {
    this.documentDefinitionName = this.route.snapshot.paramMap.get('name');
  }

  public ngOnInit(): void {
    this.loadDocumentDefinition();
    this.loadProcessDocumentDefinitions();
  }

  public loadProcessDocumentDefinitions(): void {
    this.documentService
      .findProcessDocumentDefinitions(this.documentDefinitionName)
      .subscribe((processDocumentDefinitions: ProcessDocumentDefinition[]) => {
        this.processDocumentDefinitions = processDocumentDefinitions;
      });
  }

  public openDossierConnectModal(): void {
    this._dossierConnectModal.openModal(this.documentDefinition);
  }

  public deleteProcessDocumentDefinition(
    processDocumentDefinition: ProcessDocumentDefinition
  ): void {
    this.documentService
      .deleteProcessDocumentDefinition({
        documentDefinitionName: processDocumentDefinition.id.documentDefinitionId.name,
        processDefinitionKey: processDocumentDefinition.id.processDefinitionKey,
        canInitializeDocument: processDocumentDefinition.canInitializeDocument,
        startableByUser: processDocumentDefinition.startableByUser,
      })
      .subscribe(
        () => {
          this.alertService.success('Successfully deleted process document definition');
          this.loadProcessDocumentDefinitions();
        },
        () => {
          this.alertService.error('Failed to delete process document definition');
        }
      );
  }

  public downloadDefinition(): void {
    this.dossierDetailService.documentDefinition$.pipe(take(1)).subscribe(definition => {
      const dataString =
        'data:text/json;charset=utf-8,' +
        encodeURIComponent(JSON.stringify(definition.schema, null, 2));
      const downloadAnchorElement = document.getElementById('downloadAnchorElement');
      downloadAnchorElement.setAttribute('href', dataString);
      downloadAnchorElement.setAttribute(
        'download',
        `${definition.id.name}-v${definition.id.version}.json`
      );
      downloadAnchorElement.click();
    });
  }

  private loadDocumentDefinition(): void {
    this.documentService
      .getDocumentDefinitionForManagement(this.documentDefinitionName)
      .subscribe((documentDefinition: DocumentDefinition) => {
        this.documentDefinition = documentDefinition;
      });
  }
}
