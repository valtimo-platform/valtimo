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

import {Component, ViewChild} from '@angular/core';
import {DocumentService} from '@valtimo/document';
import {DocumentDefinition, UndeployDocumentDefinitionResult} from '@valtimo/contract';
import {MenuService, ModalComponent} from '@valtimo/components';
import {ToastrService} from 'ngx-toastr';
import {Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';

@Component({
  selector: 'valtimo-dossier-management-remove-modal',
  templateUrl: './dossier-management-remove-modal.component.html',
  styleUrls: ['./dossier-management-remove-modal.component.scss']
})
export class DossierManagementRemoveModalComponent {
  public documentDefinition: DocumentDefinition | null = null;
  public errors: string[] = [];
  @ViewChild('documentDefinitionRemoveModal') modal: ModalComponent;

  constructor(
    private documentService: DocumentService,
    private toasterService: ToastrService,
    private router: Router,
    private translateService: TranslateService,
    private menuService: MenuService
  ) {
  }

  openModal(documentDefinition: DocumentDefinition) {
    this.documentDefinition = documentDefinition;
    this.modal.show();
  }

  removeDocumentDefinition() {
    this.documentService.removeDocumentDefinition(this.documentDefinition.id.name).subscribe(
      () => {
        this.menuService.reload();
        this.router.navigate(['/dossier-management']);
        this.toasterService.success(this.translateService.instant('remove-document-definition-success'));
      }, (result: UndeployDocumentDefinitionResult) => {
        this.errors = result.errors;
      });
  }

}
