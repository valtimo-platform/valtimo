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

import {Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild} from '@angular/core';

import {
  AdditionalDocumentDate,
  ConfidentialityLevel,
  DocumentenApiMetadata,
  DocumentLanguage,
  DocumentStatus,
} from '../../models';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  from,
  map,
  Observable,
  of,
  Subject,
  Subscription,
  switchMap,
  take,
} from 'rxjs';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {ActivatedRoute} from '@angular/router';
import {DocumentService} from '@valtimo/document';
import {KeycloakService} from 'keycloak-angular';
import {tap} from 'rxjs/operators';
import {CommonModule} from '@angular/common';
import {
  ButtonModule,
  DatePickerModule,
  FormModule,
  InputLabelModule,
  InputModule,
  ModalService,
  SelectItem,
  SelectModule,
  TitleModule,
  ValtimoModalService,
  VModalComponent,
  VModalModule,
} from '@valtimo/components';

@Component({
  selector: 'valtimo-documenten-api-metadata-modal',
  templateUrl: './documenten-api-metadata-modal.component.html',
  styleUrls: ['./documenten-api-metadata-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    VModalModule,
    TitleModule,
    ButtonModule,
    TranslateModule,
    FormModule,
    InputModule,
    SelectModule,
    DatePickerModule,
    InputLabelModule,
  ],
})
export class DocumentenApiMetadataModalComponent implements OnInit, OnDestroy {
  @ViewChild('documentenApiMetadataModal') documentenApiMetadataModal: VModalComponent;

  @Input() show$!: Observable<null>;
  @Input() hide$!: Observable<null>;
  @Input() disabled$!: Observable<boolean>;
  @Input() file$!: Observable<File>;

  @Input() documentTitle = '';
  @Input() disableDocumentTitle: boolean;
  @Input() filename: string;
  @Input() disableFilename: boolean;
  @Input() author: string;
  @Input() disableAuthor: boolean;
  @Input() status: string;
  @Input() disableStatus: boolean;
  @Input() language: string;
  @Input() disableLanguage: boolean;
  @Input() documentType: string;
  @Input() disableDocumentType: boolean;
  @Input() description: string;
  @Input() disableDescription: boolean;
  @Input() confidentialityLevel: string;
  @Input() disableConfidentialityLevel: boolean;
  @Input() trefwoorden: boolean;
  @Input() disableTrefwoorden: boolean;

  @Output() metadata: EventEmitter<DocumentenApiMetadata> = new EventEmitter();

  readonly CONFIDENTIALITY_LEVELS: Array<ConfidentialityLevel> = [
    'openbaar',
    'beperkt_openbaar',
    'intern',
    'zaakvertrouwelijk',
    'vertrouwelijk',
    'confidentieel',
    'geheim',
    'zeer_geheim',
  ];
  readonly confidentialityLevelItems$: Observable<Array<SelectItem>> = this.translateService
    .stream('key')
    .pipe(
      map(() =>
        this.CONFIDENTIALITY_LEVELS.map(confidentialityLevel => ({
          id: confidentialityLevel,
          text: this.translateService.instant(`document.${confidentialityLevel}`),
        }))
      )
    );
  readonly ADDITONAL_DOCUMENT_DATE_OPTIONS: Array<{
    value: AdditionalDocumentDate;
    translationKey: string;
  }> = [
    {
      value: 'neither',
      translationKey: 'document.noAdditionalDate',
    },
    {
      value: 'sent',
      translationKey: 'document.sendDate',
    },
    {
      value: 'received',
      translationKey: 'document.receiptDate',
    },
  ];
  readonly clearStatusSelection$ = new Subject<null>();
  readonly additionalDocumentDate$ = new BehaviorSubject<AdditionalDocumentDate>('neither');
  readonly STATUSES: Array<DocumentStatus> = [
    'in_bewerking',
    'ter_vaststelling',
    'definitief',
    'gearchiveerd',
  ];
  readonly RECEIPT_STATUSES: Array<DocumentStatus> = ['definitief', 'gearchiveerd'];
  readonly formData$ = new BehaviorSubject<DocumentenApiMetadata>(null);
  readonly statusItems$: Observable<Array<SelectItem>> = combineLatest([
    this.additionalDocumentDate$,
    this.translateService.stream('key'),
  ]).pipe(
    tap(([additionalDocumentDate]) => {
      this.formData$.pipe(take(1)).subscribe(formData => {
        if (
          additionalDocumentDate === 'received' &&
          (formData.status === 'in_bewerking' || formData.status === 'ter_vaststelling')
        ) {
          this.clearStatusSelection$.next(null);
        }
      });
    }),
    map(([additionalDocumentDate]) =>
      (additionalDocumentDate === 'received' ? this.RECEIPT_STATUSES : this.STATUSES).map(
        status => ({
          id: status,
          text: this.translateService.instant(`document.${status}`),
        })
      )
    )
  );
  readonly LANGUAGES: Array<DocumentLanguage> = ['nld', 'eng', 'deu'];
  readonly languageItems$: Observable<Array<SelectItem>> = this.translateService.stream('key').pipe(
    map(() =>
      this.LANGUAGES.map(language => ({
        id: language,
        text: this.translateService.instant(`document.${language}`),
      }))
    )
  );
  readonly documentTypeItems$: Observable<Array<SelectItem>> = combineLatest([
    this.route?.params || of(null),
    this.route?.firstChild?.params || of(null),
    this.valtimoModalService.documentDefinitionName$,
  ]).pipe(
    filter(
      ([params, firstChildParams, documentDefinitionName]) =>
        !!(
          params?.documentDefinitionName ||
          firstChildParams?.documentDefinitionName ||
          documentDefinitionName
        )
    ),
    switchMap(([params, firstChildParams, documentDefinitionName]) =>
      this.documentService.getDocumentTypes(
        params?.documentDefinitionName ||
          firstChildParams?.documentDefinitionName ||
          documentDefinitionName
      )
    ),
    map(documentTypes => documentTypes.map(type => ({id: type.url, text: type.name})))
  );
  readonly showForm$: Observable<boolean> = this.modalService.modalVisible$;
  readonly valid$ = new BehaviorSubject<boolean>(false);
  readonly userEmail$ = from(this.keycloakService.loadUserProfile()).pipe(
    map(userProfile => userProfile?.email || '')
  );

  private showSubscription!: Subscription;
  private hideSubscription!: Subscription;

  constructor(
    private readonly modalService: ModalService,
    private readonly translateService: TranslateService,
    private readonly route: ActivatedRoute,
    private readonly documentService: DocumentService,
    private readonly keycloakService: KeycloakService,
    private readonly valtimoModalService: ValtimoModalService
  ) {}

  ngOnInit(): void {
    this.openShowSubscription();
    this.openHideSubscription();
  }

  ngOnDestroy(): void {
    this.showSubscription?.unsubscribe();
    this.hideSubscription?.unsubscribe();
  }

  hide(): void {
    this.formData$.next(null);
    this.valid$.next(false);
    this.additionalDocumentDate$.next('neither');
    this.modalService.closeModal();
  }

  cancel(): void {
    this.hide();
  }

  save(): void {
    combineLatest([this.valid$, this.formData$])
      .pipe(take(1))
      .subscribe(([valid, formData]) => {
        if (valid) {
          this.metadata.emit(formData);
        }
      });
  }

  formValueChange(data: DocumentenApiMetadata): void {
    this.formData$.next(data);
    this.setValid(data);
  }

  setAdditionalDate(value: AdditionalDocumentDate): void {
    this.additionalDocumentDate$.next(value);
  }

  private setValid(data: DocumentenApiMetadata): void {
    this.valid$.next(
      !!(
        data.filename &&
        data.title &&
        data.author &&
        data.creationDate &&
        data.status &&
        data.language &&
        data.informatieobjecttype &&
        data.description &&
        data.confidentialityLevel
      )
    );
  }

  private openShowSubscription(): void {
    this.showSubscription = this.show$.subscribe(() => {
      this.modalService.openModal(this.documentenApiMetadataModal);
    });
  }

  private openHideSubscription(): void {
    this.hideSubscription = this.hide$.subscribe(() => {
      this.hide();
    });
  }
}
