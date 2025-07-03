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
import {Component, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {CaseSettings, DocumentService, ProcessDefinitionCaseDefinition} from '@valtimo/document';
import {GlobalNotificationService} from '@valtimo/shared';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  of,
  Subscription,
  switchMap,
} from 'rxjs';
import {CaseListService} from '../../services';
import {CaseProcessStartModalComponent} from '../case-process-start-modal/case-process-start-modal.component';

declare const $;

@Component({
  standalone: false,
  selector: 'valtimo-case-list-actions',
  templateUrl: './case-list-actions.component.html',
  styleUrls: ['./case-list-actions.component.scss'],
})
export class CaseListActionsComponent implements OnInit {
  @ViewChild('processStartModal') processStart: CaseProcessStartModalComponent;

  private readonly _loading$ = new BehaviorSubject<boolean>(true);
  @Input() set loading(value: boolean) {
    this._loading$.next(value);
  }

  @Output() public readonly formFlowComplete = new EventEmitter();
  @Output() public readonly startButtonDisableEvent = new EventEmitter<boolean>();

  private readonly _caseSettings$ = new BehaviorSubject<CaseSettings | null>(null);

  public readonly caseSettings$ = this._caseSettings$.pipe(filter(settings => !!settings));

  private get _caseSettings(): CaseSettings | null {
    return this._caseSettings$.getValue();
  }

  public readonly associatedProcessDocumentDefinitions$: Observable<
    Array<ProcessDefinitionCaseDefinition>
  > = this.listService.caseDefinitionKey$.pipe(
    switchMap(caseDefinitionKey =>
      combineLatest([
        caseDefinitionKey
          ? this.documentService.findProcessDefinitionCaseDefinitionsByCanInitializeDocument(
              caseDefinitionKey,
              true
            )
          : of([]),
        this._loading$,
        this.caseSettings$,
      ])
    ),
    map(([processDocumentDefinitions, loading, caseSettings]) => {
      this._cachedAssociatedProcessDocumentDefinitions = processDocumentDefinitions;
      this.startButtonDisableEvent.emit(
        loading || (processDocumentDefinitions.length === 0 && !caseSettings?.hasExternalStartForm)
      );
      return processDocumentDefinitions.filter(definition => definition.canInitializeDocument);
    })
  );

  private selectedProcessDefinitionCaseDefinition: ProcessDefinitionCaseDefinition | null = null;
  public readonly startSelectionModalOpen$ = new BehaviorSubject<boolean>(false);

  private _cachedAssociatedProcessDocumentDefinitions: Array<ProcessDefinitionCaseDefinition> = [];

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly documentService: DocumentService,
    private readonly listService: CaseListService,
    private readonly notificationService: GlobalNotificationService,
    private readonly router: Router,
    private readonly translateService: TranslateService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this.listService.caseDefinitionKey$
        .pipe(
          switchMap(caseDefinitionKey => this.documentService.getCaseSettings(caseDefinitionKey))
        )
        .subscribe(caseSettings => {
          this._caseSettings$.next(caseSettings);
        })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public startCase(): void {
    const associatedProcessDocumentDefinitions = this._cachedAssociatedProcessDocumentDefinitions;
    const hasExternalStartForm = this._caseSettings?.hasExternalStartForm;

    if (associatedProcessDocumentDefinitions.length > 1) {
      this.startSelectionModalOpen$.next(true);
    } else {
      this.selectedProcessDefinitionCaseDefinition = associatedProcessDocumentDefinitions[0];
      this.showStartProcessModal();
      if (hasExternalStartForm && associatedProcessDocumentDefinitions.length === 0) {
        this.openExternalCaseStartForm();
      } else if (associatedProcessDocumentDefinitions.length === 1 && !hasExternalStartForm) {
        this.selectedProcessDefinitionCaseDefinition = associatedProcessDocumentDefinitions[0];
        this.showStartProcessModal();
      } else if (associatedProcessDocumentDefinitions.length > 0) {
        this.startSelectionModalOpen$.next(true);
      }
    }
  }

  public selectProcess(processDefinitionCaseDefinition: ProcessDefinitionCaseDefinition): void {
    this.selectedProcessDefinitionCaseDefinition = processDefinitionCaseDefinition;
    this.startSelectionModalOpen$.next(false);
    this.showStartProcessModal();
  }

  public onFormFlowComplete(): void {
    this.formFlowComplete.emit(null);
  }

  public onNoProcessLinked(processDefinitionKey: string): void {
    this.notificationService.ngOnDestroy();

    this.notificationService.showActionable({
      type: 'warning',
      lowContrast: true,
      title: this.translateService.instant('case.noLinkedStartProcessNotification'),
      actions: [
        {
          text: this.translateService.instant('case.configure'),
          click: () =>
            this.router.navigate([
              `/case-management/case/${this._caseSettings?.caseDefinitionKey}/version/${this._caseSettings?.caseDefinitionVersionTag}/processes/${processDefinitionKey}`,
            ]),
        },
      ],
    });
  }

  public onCloseSelect(): void {
    this.startSelectionModalOpen$.next(false);
  }

  public openExternalCaseStartForm(closeModal = false): void {
    window.open(this._caseSettings?.externalStartFormUrl, '_blank');

    if (closeModal) this.startSelectionModalOpen$.next(false);
  }

  private showStartProcessModal(): void {
    if (this.selectedProcessDefinitionCaseDefinition !== null) {
      this.processStart.openModal(this.selectedProcessDefinitionCaseDefinition);
      this.selectedProcessDefinitionCaseDefinition = null;
    }
  }
}
