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
import {CARBON_CONSTANTS} from '@valtimo/components';
import {DocumentService, ProcessDefinitionCaseDefinition} from '@valtimo/document';
import {BehaviorSubject, combineLatest, map, Observable, of, switchMap} from 'rxjs';
import {CaseListService} from '../../services';
import {CaseProcessStartModalComponent} from '../case-process-start-modal/case-process-start-modal.component';
import {GlobalNotificationService} from '@valtimo/layout';

declare const $;

@Component({
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
      ])
    ),
    map(([processDocumentDefinitions, loading]) => {
      this._cachedAssociatedProcessDocumentDefinitions = processDocumentDefinitions;
      this.startButtonDisableEvent.emit(processDocumentDefinitions.length === 0 || loading);
      return processDocumentDefinitions.filter(definition => definition.canInitializeDocument);
    })
  );

  private selectedProcessDefinitionCaseDefinition: ProcessDefinitionCaseDefinition | null = null;
  public readonly startSelectionModalOpen$ = new BehaviorSubject<boolean>(false);

  private modalListenerAdded = false;
  private _cachedAssociatedProcessDocumentDefinitions: Array<ProcessDefinitionCaseDefinition> = [];

  constructor(
    private readonly documentService: DocumentService,
    private readonly listService: CaseListService,
    private readonly notificationService: GlobalNotificationService,
    private readonly router: Router,
    private readonly translateService: TranslateService
  ) {}

  public ngOnInit(): void {
    this.modalListenerAdded = false;
  }

  public startCase(): void {
    const associatedProcessDocumentDefinitions = this._cachedAssociatedProcessDocumentDefinitions;

    if (associatedProcessDocumentDefinitions.length > 1) {
      this.startSelectionModalOpen$.next(true);
    } else {
      this.selectedProcessDefinitionCaseDefinition = associatedProcessDocumentDefinitions[0];
      this.showStartProcessModal();
    }
  }

  public selectProcess(processDefinitionCaseDefinition: ProcessDefinitionCaseDefinition): void {
    this.selectedProcessDefinitionCaseDefinition = processDefinitionCaseDefinition[0];
    this.startSelectionModalOpen$.next(false);
    this.showStartProcessModal();
  }

  public onFormFlowComplete(): void {
    this.formFlowComplete.emit(null);
  }

  public onNoProcessLinked(): void {
    this.notificationService.ngOnDestroy();

    this.notificationService.showActionable({
      type: 'warning',
      lowContrast: true,
      title: this.translateService.instant('case.noLinkedStartProcessNotification'),
      actions: [
        {
          text: this.translateService.instant('case.configure'),
          click: () => this.router.navigate(['/process-links']),
        },
      ],
      duration: CARBON_CONSTANTS.notificationDuration,
    });
  }

  public onCloseSelect(): void {
    this.startSelectionModalOpen$.next(false);
  }

  private showStartProcessModal(): void {
    if (this.selectedProcessDefinitionCaseDefinition !== null) {
      this.processStart.openModal(this.selectedProcessDefinitionCaseDefinition);
      this.selectedProcessDefinitionCaseDefinition = null;
    }
  }
}
