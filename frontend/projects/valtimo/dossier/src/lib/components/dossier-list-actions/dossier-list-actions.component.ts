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
import {Component, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {CARBON_CONSTANTS} from '@valtimo/components';
import {CaseSettings, DocumentService, ProcessDocumentDefinition} from '@valtimo/document';
import {NotificationService} from 'carbon-components-angular';
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
import {DossierListService} from '../../services';
import {DossierProcessStartModalComponent} from '../dossier-process-start-modal/dossier-process-start-modal.component';

declare const $;

@Component({
  selector: 'valtimo-dossier-list-actions',
  templateUrl: './dossier-list-actions.component.html',
  styleUrls: ['./dossier-list-actions.component.scss'],
  providers: [NotificationService],
})
export class DossierListActionsComponent implements OnInit {
  @ViewChild('processStartModal') processStart: DossierProcessStartModalComponent;

  private readonly _loading$ = new BehaviorSubject<boolean>(true);
  @Input() set loading(value: boolean) {
    this._loading$.next(value);
  }

  @Output() public readonly formFlowComplete = new EventEmitter();
  @Output() public readonly startButtonDisableEvent = new EventEmitter<boolean>();

  private readonly _caseSettings$: BehaviorSubject<CaseSettings> = new BehaviorSubject(null);

  public readonly caseSettings$ = this._caseSettings$.pipe(filter(settings => !!settings));

  private get _caseSettings(): CaseSettings | null {
    return this._caseSettings$.getValue();
  }

  public readonly associatedProcessDocumentDefinitions$: Observable<
    Array<ProcessDocumentDefinition>
  > = this.listService.documentDefinitionName$.pipe(
    switchMap(documentDefinitionName =>
      combineLatest([
        documentDefinitionName
          ? this.documentService.findProcessDocumentDefinitionsByCanInitializeDocument(
              documentDefinitionName,
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
        loading || (processDocumentDefinitions.length === 0 && !caseSettings.hasExternalStartForm)
      );
      return processDocumentDefinitions.filter(definition => definition.canInitializeDocument);
    })
  );

  public readonly startSelectionModalOpen$ = new BehaviorSubject<boolean>(false);

  private selectedProcessDocumentDefinition: ProcessDocumentDefinition | null = null;
  private _cachedAssociatedProcessDocumentDefinitions: Array<ProcessDocumentDefinition> = [];

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly documentService: DocumentService,
    private readonly listService: DossierListService,
    private readonly notificationService: NotificationService,
    private readonly router: Router,
    private readonly translateService: TranslateService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this.listService.documentDefinitionName$
        .pipe(
          switchMap(documentDefinitionName =>
            this.documentService.getCaseSettings(documentDefinitionName)
          )
        )
        .subscribe(caseSettings => {
          this._caseSettings$.next(caseSettings);
        })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public startDossier(): void {
    const associatedProcessDocumentDefinitions = this._cachedAssociatedProcessDocumentDefinitions;
    const hasExternalStartForm = this._caseSettings?.hasExternalStartForm;

    if (associatedProcessDocumentDefinitions.length > 1) {
      this.startSelectionModalOpen$.next(true);
    } else {
      if (hasExternalStartForm && associatedProcessDocumentDefinitions.length === 0) {
        this.openExternalCaseStartForm();
      } else if (associatedProcessDocumentDefinitions.length === 1 && !hasExternalStartForm) {
        this.selectedProcessDocumentDefinition = associatedProcessDocumentDefinitions[0];
        this.showStartProcessModal();
      } else if (associatedProcessDocumentDefinitions.length > 0) {
        this.startSelectionModalOpen$.next(true);
      }
    }
  }

  public selectProcess(processDocumentDefinition: ProcessDocumentDefinition): void {
    this.selectedProcessDocumentDefinition = processDocumentDefinition;
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
      title: this.translateService.instant('dossier.noLinkedStartProcessNotification'),
      actions: [
        {
          text: this.translateService.instant('dossier.configure'),
          click: () => this.router.navigate(['/process-links']),
        },
      ],
      duration: CARBON_CONSTANTS.notificationDuration,
    });
  }

  public openExternalCaseStartForm(closeModal = false): void {
    window.open(this._caseSettings?.externalStartFormUrl, '_blank');

    if (closeModal) this.startSelectionModalOpen$.next(false);
  }

  public onCloseSelect(): void {
    this.startSelectionModalOpen$.next(false);
  }

  private showStartProcessModal(): void {
    if (this.selectedProcessDocumentDefinition !== null) {
      this.processStart.openModal(this.selectedProcessDocumentDefinition);
      this.selectedProcessDocumentDefinition = null;
    }
  }
}
