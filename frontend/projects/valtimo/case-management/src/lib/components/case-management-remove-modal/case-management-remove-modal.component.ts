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

import {Component, ViewChild} from '@angular/core';
import {
  DocumentDefinition,
  DocumentService,
  UndeployDocumentDefinitionResult,
} from '@valtimo/document';
import {MenuService, ModalComponent} from '@valtimo/components';
import {ToastrService} from 'ngx-toastr';
import {Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';

@Component({
  standalone: false,
  selector: 'valtimo-case-management-remove-modal',
  templateUrl: './case-management-remove-modal.component.html',
})
export class CaseManagementRemoveModalComponent {
  public documentDefinition: DocumentDefinition | null = null;
  public errors: string[] = [];
  @ViewChild('documentDefinitionRemoveModal') modal: ModalComponent;

  constructor(
    private documentService: DocumentService,
    private toasterService: ToastrService,
    private router: Router,
    private translateService: TranslateService,
    private menuService: MenuService
  ) {}

  public openModal(documentDefinition: DocumentDefinition): void {
    this.documentDefinition = documentDefinition;
    this.modal.show();
  }

  public removeDocumentDefinition(): void {
    this.documentService
      .removeDocumentDefinitionForManagement(this.documentDefinition.id.name)
      .subscribe(
        () => {
          this.menuService.reload();
          this.router.navigate(['/case-management']);
          this.toasterService.success(
            this.translateService.instant('remove-document-definition-success')
          );
        },
        (result: UndeployDocumentDefinitionResult) => {
          this.errors = result.errors;
        }
      );
  }
}
