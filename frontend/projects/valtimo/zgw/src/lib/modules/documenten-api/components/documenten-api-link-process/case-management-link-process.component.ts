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

import {Component, OnInit} from '@angular/core';
import {BehaviorSubject, combineLatest, map, Observable, switchMap, tap} from 'rxjs';
import {ComboBoxModule, LayerModule, ListItem} from 'carbon-components-angular';
import {ConfigService, UploadProvider, ValtimoConfig} from '@valtimo/config';
import {ActivatedRoute} from '@angular/router';
import {DocumentenApiLinkProcessService, DocumentenApiVersionService} from '../../services';
import {CommonModule} from '@angular/common';
import {ParagraphModule} from '@valtimo/components';
import {TranslateModule} from '@ngx-translate/core';

@Component({
  selector: 'valtimo-case-management-link-process',
  templateUrl: './case-management-link-process.component.html',
  styleUrl: './case-management-link-process.component.scss',
  standalone: true,
  imports: [CommonModule, ParagraphModule, TranslateModule, ComboBoxModule, LayerModule],
})
export class CaseManagementLinkProcessComponent implements OnInit {
  public readonly documentenApiUploadProviders$ = new BehaviorSubject<boolean>(false);

  public readonly params$: Observable<any> | undefined = this.route.parent?.params.pipe(
    map(({caseDefinitionKey, caseDefinitionVersionTag}) => ({
      caseDefinitionKey: caseDefinitionKey,
      caseDefinitionVersionTag: caseDefinitionVersionTag,
    }))
  );

  public readonly caseDefinitionKey$: Observable<string> | undefined = this.params$?.pipe(
    map(({caseDefinitionKey}) => caseDefinitionKey || '')
  );

  public readonly caseVersionTag$: Observable<string> | undefined = this.params$?.pipe(
    map(({caseDefinitionVersionTag}) => caseDefinitionVersionTag || '')
  );

  public readonly selectedProcessKey$ = new BehaviorSubject<string>('');
  public readonly processItems$: Observable<Array<ListItem>> = combineLatest([
    this.documentenApiLinkProcessService.getProcessDefinitions(),
    this.selectedProcessKey$,
  ]).pipe(
    map(([definitions, selectedProcessKey]) =>
      (definitions || [])
        .filter(definition => !!definition?.key)
        .map(process => ({
          content: process?.name || '-',
          id: process.key,
          selected: selectedProcessKey === process.key,
        }))
    ),
    tap(() => this.documentenApiVersionService.refresh())
  );

  public readonly disabled$ = new BehaviorSubject<boolean>(false);
  constructor(
    private readonly configService: ConfigService,
    private readonly route: ActivatedRoute,
    private readonly documentenApiLinkProcessService: DocumentenApiLinkProcessService,
    private readonly documentenApiVersionService: DocumentenApiVersionService
  ) {}

  public ngOnInit(): void {
    this.setDocumentenApiUploaderProvider(this.configService.config);
  }

  public selectProcess(item: {id: string}): void {
    const processDefinitionKey = item?.id;
    this.disabled$.next(true);
    const currentSelectionId = this.selectedProcessKey$.getValue();

    if (processDefinitionKey && processDefinitionKey !== currentSelectionId) {
      this.disabled$.next(true);

      combineLatest([this.caseDefinitionKey$, this.caseVersionTag$])
        .pipe(
          switchMap(([caseDefinitionKey, caseVersionTag]) =>
            this.documentenApiLinkProcessService.updateLinkedUploadProcess(
              caseDefinitionKey,
              caseVersionTag,
              processDefinitionKey
            )
          )
        )
        .subscribe(processLink => {
          this.selectedProcessKey$.next(processLink.processDefinitionKey);
          this.disabled$.next(false);
        });
    } else if (!processDefinitionKey) {
      combineLatest([this.caseDefinitionKey$, this.caseVersionTag$])
        .pipe(
          switchMap(([caseDefinitionKey, caseVersionTag]) =>
            this.documentenApiLinkProcessService.deleteLinkedUploadProcess(
              caseDefinitionKey,
              caseVersionTag
            )
          )
        )
        .subscribe(() => {
          this.selectedProcessKey$.next('');
          this.disabled$.next(false);
        });
    }
  }

  private setDocumentenApiUploaderProvider(config: ValtimoConfig): void {
    const hasDocumentenApiUploadProvider = config.uploadProvider === UploadProvider.DOCUMENTEN_API;

    this.documentenApiUploadProviders$.next(hasDocumentenApiUploadProvider);
    if (hasDocumentenApiUploadProvider) this.getDefaultSelection();
  }

  private getDefaultSelection(): void {
    combineLatest([this.caseDefinitionKey$, this.caseVersionTag$])
      .pipe(
        switchMap(([caseDefinitionKey, caseVersionTag]) =>
          this.documentenApiLinkProcessService.getLinkedUploadProcess(
            caseDefinitionKey,
            caseVersionTag
          )
        )
      )
      .subscribe(linkedUploadProcess => {
        if (linkedUploadProcess) {
          this.selectedProcessKey$.next(linkedUploadProcess.processDefinitionKey);
        }
      });
  }
}
