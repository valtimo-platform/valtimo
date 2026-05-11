/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
import {Component, OnInit} from '@angular/core';
import {FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {Edit16, TrashCan16, WarningFilled16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {
  CdsThemeService,
  FormModule,
  RenderInBodyComponent,
  SpinnerModule,
  ValtimoCdsModalDirective,
} from '@valtimo/components';
import {DocumentDefinition, DocumentService} from '@valtimo/document';
import {
  CaseManagementParams,
  ConfigurationIssueService,
  DraftVersionService,
  getCaseManagementRouteParams,
} from '@valtimo/shared';
import {
  ButtonModule,
  DropdownModule,
  IconModule,
  IconService,
  InputModule,
  LayerModule,
  ListItem,
  ModalModule,
  TilesModule,
  ToggleModule,
} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable, switchMap, take, tap} from 'rxjs';
import {filter} from 'rxjs/operators';

import {CaseZakenApiSync, RoltypeOption} from '../../models';
import {CaseZakenApiSyncService} from '../../services';

interface RoltypeListItem extends ListItem {
  url: string;
}

@Component({
  selector: 'valtimo-case-zaken-api-sync',
  templateUrl: './case-zaken-api-sync.component.html',
  styleUrls: ['./case-zaken-api-sync.component.scss'],
  standalone: true,
  imports: [
    ButtonModule,
    CommonModule,
    DropdownModule,
    FormModule,
    FormsModule,
    IconModule,
    InputModule,
    LayerModule,
    ModalModule,
    ReactiveFormsModule,
    SpinnerModule,
    TilesModule,
    ToggleModule,
    TranslateModule,
    ValtimoCdsModalDirective,
    RenderInBodyComponent,
  ],
})
export class CaseZakenApiSyncComponent implements OnInit {
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  private readonly _params$: Observable<CaseManagementParams | undefined> =
    getCaseManagementRouteParams(this.route);
  public readonly _documentDefinition$: Observable<DocumentDefinition> = this._params$.pipe(
    switchMap(params =>
      this.documentService.getDocumentDefinitionByVersion(
        params?.caseDefinitionKey ?? '',
        params?.caseDefinitionVersionTag ?? ''
      )
    )
  );
  public readonly caseZakenApiSync$ = new BehaviorSubject<CaseZakenApiSync | null>(null);
  public readonly modalShowing$ = new BehaviorSubject<boolean>(false);
  public readonly currentTheme$ = this.cdsThemeService.currentTheme$;
  public readonly formGroup = new FormGroup({
    assigneeSyncEnabled: new FormControl(false),
    roltypeUrl: new FormControl('', Validators.required),
    noteSyncEnabled: new FormControl(false),
    noteSubject: new FormControl('Note created by Valtimo GZAC', Validators.required),
  });

  private readonly _roltypeOptions$ = new BehaviorSubject<RoltypeOption[]>([]);
  private readonly _selectedRoltypeUrl$ = new BehaviorSubject<string>('');
  public readonly roltypeListItems$: Observable<RoltypeListItem[]> = combineLatest([
    this._roltypeOptions$,
    this._selectedRoltypeUrl$,
  ]).pipe(
    map(([options, selectedUrl]) =>
      options.map(option => ({
        content: option.name,
        url: option.url,
        selected: option.url === selectedUrl,
      })),
    ),
  );

  public readonly hasConfigurationIssue$ =
    this.configurationIssueService.hasIssue$('zaken-api-sync');
  private readonly _isDraftVersion$: Observable<boolean> = this._params$.pipe(
    switchMap(params =>
      this.draftVersionService.isDraftVersion(
        params?.caseDefinitionKey ?? '',
        params?.caseDefinitionVersionTag ?? ''
      )
    )
  );
  public readonly canEdit$: Observable<boolean> = combineLatest([
    this._isDraftVersion$,
    this.hasConfigurationIssue$,
  ]).pipe(map(([isDraft, hasIssue]) => isDraft || hasIssue));

  constructor(
    private readonly route: ActivatedRoute,
    private readonly configurationIssueService: ConfigurationIssueService,
    private readonly draftVersionService: DraftVersionService,
    private readonly caseZakenApiSyncService: CaseZakenApiSyncService,
    private readonly documentService: DocumentService,
    private readonly cdsThemeService: CdsThemeService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([TrashCan16, Edit16, WarningFilled16]);
  }

  public ngOnInit(): void {
    this.loadCaseZakenApiSync();
    this.loadRoltypeOptions();
  }

  public loadCaseZakenApiSync(): void {
    this._documentDefinition$
      .pipe(
        filter(documentDefinition => !!documentDefinition?.id?.blueprintId),
        switchMap((documentDefinition: DocumentDefinition) =>
          this.caseZakenApiSyncService.getCaseZakenApiSync(
            documentDefinition.id.blueprintId.blueprintKey,
            documentDefinition.id.blueprintId.blueprintVersionTag
          )
        )
      )
      .subscribe(caseZakenApiSync => {
        this.loading$.next(false);
        if (caseZakenApiSync) {
          this.formGroup.patchValue({
            assigneeSyncEnabled: caseZakenApiSync.assigneeSyncEnabled,
            roltypeUrl: caseZakenApiSync.roltypeUrl,
            noteSyncEnabled: caseZakenApiSync.noteSyncEnabled,
            noteSubject: caseZakenApiSync.noteSubject,
          });
          this._selectedRoltypeUrl$.next(caseZakenApiSync.roltypeUrl);
        }
        this.caseZakenApiSync$.next(caseZakenApiSync);
      });
  }

  private loadRoltypeOptions(): void {
    this._documentDefinition$
      .pipe(
        filter(documentDefinition => !!documentDefinition?.id?.blueprintId),
        take(1),
        switchMap((documentDefinition: DocumentDefinition) =>
          this.caseZakenApiSyncService.getAvailableRoltypes(
            documentDefinition.id.blueprintId.blueprintKey,
            documentDefinition.id.blueprintId.blueprintVersionTag
          )
        )
      )
      .subscribe(options => this._roltypeOptions$.next(options));
  }

  public onRoltypeSelected(event: {item?: RoltypeListItem}): void {
    const url = event.item?.url ?? '';
    this.formGroup.patchValue({roltypeUrl: url});
    this._selectedRoltypeUrl$.next(url);
  }

  public remove(): void {
    this._documentDefinition$
      .pipe(
        take(1),
        switchMap(documentDefinition =>
          this.caseZakenApiSyncService.deleteCaseZakenApiSync(
            documentDefinition.id.blueprintId.blueprintKey,
            documentDefinition.id.blueprintId.blueprintVersionTag
          )
        ),
        tap(() => {
          this.caseZakenApiSync$.next(null);
        })
      )
      .subscribe();
  }

  public submit(): void {
    const formValues = this.formGroup.getRawValue();
    this._documentDefinition$
      .pipe(
        take(1),
        switchMap(documentDefinition =>
          this.caseZakenApiSyncService.updateCaseZakenApiSync(
            documentDefinition.id.blueprintId.blueprintKey,
            documentDefinition.id.blueprintId.blueprintVersionTag,
            {
              assigneeSyncEnabled: !!formValues.assigneeSyncEnabled,
              roltypeUrl: formValues.roltypeUrl ?? '',
              noteSyncEnabled: !!formValues.noteSyncEnabled,
              noteSubject: formValues.noteSubject ?? '',
            }
          )
        )
      )
      .subscribe(() => {
        this.loadCaseZakenApiSync();
        this.hideModal();
      });
  }

  public onModalClose(): void {
    this.hideModal();
  }

  public showModal(): void {
    this.modalShowing$.next(true);
  }

  private hideModal(): void {
    this.modalShowing$.next(false);
  }
}
