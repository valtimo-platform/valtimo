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
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  Inject,
  Optional,
  Type,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {ActivatedRoute, ParamMap} from '@angular/router';
import {DocumentDefinition, DocumentService} from '@valtimo/document';
import {Observable, switchMap} from 'rxjs';
import {ZGW_CASE_CONFIGURATION_EXTENSIONS_TOKEN} from '@valtimo/config';

@Component({
  selector: 'valtimo-dossier-management-detail',
  templateUrl: './dossier-management-detail.component.html',
  styleUrls: ['./dossier-management-detail.component.scss'],
})
export class DossierManagementDetailComponent implements AfterViewInit {
  @ViewChild('extensions', {read: ViewContainerRef})
  private _extensions: ViewContainerRef;

  public readonly documentDefinition$: Observable<DocumentDefinition> = this.route.paramMap.pipe(
    switchMap((params: ParamMap) =>
      this.documentService.getDocumentDefinitionForManagement(params.get('name') ?? '')
    )
  );

  constructor(
    private readonly documentService: DocumentService,
    private readonly route: ActivatedRoute,
    @Optional()
    @Inject(ZGW_CASE_CONFIGURATION_EXTENSIONS_TOKEN)
    private readonly zgwCaseConfigurationExtensionComponents: Type<any>[],
    private readonly cdr: ChangeDetectorRef
  ) {}

  public ngAfterViewInit(): void {
    this.renderExtensions();
  }

  private renderExtensions(): void {
    if (
      !Array.isArray(this.zgwCaseConfigurationExtensionComponents) ||
      this.zgwCaseConfigurationExtensionComponents.length === 0
    ) {
      return;
    }

    this.zgwCaseConfigurationExtensionComponents.forEach(extensionComponent => {
      this._extensions.createComponent(extensionComponent);
    });

    this.cdr.detectChanges();
  }
}
