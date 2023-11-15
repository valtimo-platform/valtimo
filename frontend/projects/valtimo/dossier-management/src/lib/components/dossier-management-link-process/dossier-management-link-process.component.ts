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
import {Component, OnInit} from '@angular/core';
import {ConfigService, UploadProvider, ValtimoConfig} from '@valtimo/config';
import {BehaviorSubject, map, Observable} from 'rxjs';
import {SelectItem} from '@valtimo/components';
import {ProcessService} from '@valtimo/process';
import {ActivatedRoute} from '@angular/router';
import {DocumentService} from '@valtimo/document';

@Component({
  selector: 'valtimo-dossier-management-link-process',
  templateUrl: './dossier-management-link-process.component.html',
  styleUrls: ['./dossier-management-link-process.component.scss'],
})
export class DossierManagementLinkProcessComponent implements OnInit {
  documentenApiUploadProvider!: boolean;
  documentDefinitionName: string | null = null;

  readonly selectionId$ = new BehaviorSubject<string>('');
  readonly processItems$: Observable<Array<SelectItem>> = this.processService
    .getProcessDefinitions()
    .pipe(
      map(definitions => definitions.filter(definition => !!definition?.key) || []),
      map(processes => processes.map(process => ({text: process?.name || '-', id: process.key})))
    );

  readonly disabled$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly configService: ConfigService,
    private readonly processService: ProcessService,
    private readonly route: ActivatedRoute,
    private readonly documentService: DocumentService
  ) {
    this.setDocumentenApiUploaderProvider(configService.config);
    this.documentDefinitionName = this.route.snapshot.paramMap.get('name');
  }

  ngOnInit(): void {
    if (this.documentenApiUploadProvider) {
      this.getDefaultSelection();
    }
  }

  selectProcess(processDefinitionKey: string): void {
    this.disabled$.next(true);
    const currentSelectionId = this.selectionId$.getValue();
    if (processDefinitionKey && processDefinitionKey !== currentSelectionId) {
      this.disabled$.next(true);
      this.documentService
        .updateLinkedUploadProcess(this.documentDefinitionName, processDefinitionKey)
        .subscribe(processLink => {
          this.selectionId$.next(processLink.processDefinitionKey);
          this.disabled$.next(false);
        });
    } else if (!processDefinitionKey) {
      this.documentService.deleteLinkedUploadProcess(this.documentDefinitionName).subscribe(() => {
        this.disabled$.next(false);
      });
    }
  }

  private setDocumentenApiUploaderProvider(config: ValtimoConfig): void {
    this.documentenApiUploadProvider = config.uploadProvider === UploadProvider.DOCUMENTEN_API;
  }

  private getDefaultSelection(): void {
    this.documentService
      .getLinkedUploadProcess(this.documentDefinitionName)
      .subscribe(linkedUploadProcess => {
        if (linkedUploadProcess) {
          this.selectionId$.next(linkedUploadProcess.processDefinitionKey);
        }
      });
  }
}
