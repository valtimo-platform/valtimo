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

import {ChangeDetectionStrategy, Component} from '@angular/core';
import {DossierDetailService} from '../../services';
import {Observable} from 'rxjs';
import {EditorModel} from '@valtimo/components';
import {take} from 'rxjs/operators';

@Component({
  selector: 'valtimo-dossier-management-document-definition',
  templateUrl: './dossier-management-document-definition.html',
  styleUrls: ['./dossier-management-document-definition.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DossierManagementDocumentDefinitionComponent {
  public readonly loadingDocumentDefinition$ = this.dossierDetailService.loadingDocumentDefinition$;
  public readonly documentDefinitionModel$: Observable<EditorModel> =
    this.dossierDetailService.documentDefinitionModel$;
  public readonly selectedDocumentDefinition$ = this.dossierDetailService.documentDefinition$;

  constructor(private readonly dossierDetailService: DossierDetailService) {}

  public downloadDefinition(): void {
    this.selectedDocumentDefinition$.pipe(take(1)).subscribe(definition => {
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
}
