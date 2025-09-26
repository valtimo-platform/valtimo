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
import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {CaseManagementParams, getCaseManagementRouteParams} from '@valtimo/case-management';
import {ConfigService, UploadProvider, ValtimoConfig} from '@valtimo/config';
import {ComboBoxModule, LayerModule, ListItem} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  map,
  Observable,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {DocumentenApiLinkProcessService, DocumentenApiVersionService} from '../../services';

@Component({
  selector: 'valtimo-case-management-link-process',
  templateUrl: './case-management-link-process.component.html',
  styleUrl: './case-management-link-process.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, ComboBoxModule, LayerModule],
})
export class CaseManagementLinkProcessComponent implements OnInit, OnDestroy {
  @Input() isReadOnly$: Observable<boolean>;

  public readonly documentenApiUploadProviders$ = new BehaviorSubject<boolean>(false);
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

  private readonly _caseParams$: Observable<CaseManagementParams | undefined> =
    getCaseManagementRouteParams(this.route);
  private readonly _subscriptions = new Subscription();

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

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public selectProcess(item: {id: string}): void {
    const processDefinitionKey = item?.id;
    this.disabled$.next(true);
    const currentSelectionId = this.selectedProcessKey$.getValue();

    if (processDefinitionKey && processDefinitionKey !== currentSelectionId)
      this.updateProcess(processDefinitionKey);
    else if (!processDefinitionKey) this.deleteProcess();
  }

  private deleteProcess(): void {
    this._caseParams$
      .pipe(
        take(1),
        switchMap((params: CaseManagementParams | undefined) =>
          this.documentenApiLinkProcessService.deleteLinkedUploadProcess(
            params?.caseDefinitionKey ?? '',
            params?.caseDefinitionVersionTag ?? ''
          )
        )
      )
      .subscribe(() => {
        this.selectedProcessKey$.next('');
        this.disabled$.next(false);
      });
  }

  private updateProcess(processDefinitionKey: string): void {
    this._caseParams$
      .pipe(
        take(1),
        switchMap((params: CaseManagementParams | undefined) =>
          this.documentenApiLinkProcessService.updateLinkedUploadProcess(
            params?.caseDefinitionKey ?? '',
            params?.caseDefinitionVersionTag ?? '',
            processDefinitionKey
          )
        )
      )
      .subscribe(processLink => {
        this.selectedProcessKey$.next(processLink.processDefinitionKey);
        this.disabled$.next(false);
      });
  }

  private setDocumentenApiUploaderProvider(config: ValtimoConfig): void {
    const hasDocumentenApiUploadProvider = config.uploadProvider === UploadProvider.DOCUMENTEN_API;

    this.documentenApiUploadProviders$.next(hasDocumentenApiUploadProvider);
    if (hasDocumentenApiUploadProvider) this.getDefaultSelection();
  }

  private getDefaultSelection(): void {
    this._subscriptions.add(
      this._caseParams$
        .pipe(
          switchMap((params: CaseManagementParams | undefined) =>
            this.documentenApiLinkProcessService.getLinkedUploadProcess(
              params?.caseDefinitionKey ?? '',
              params?.caseDefinitionVersionTag ?? ''
            )
          )
        )
        .subscribe(linkedUploadProcess => {
          this.selectedProcessKey$.next(linkedUploadProcess?.processDefinitionKey ?? '');
        })
    );
  }
}
