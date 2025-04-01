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

import {Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild} from '@angular/core';

import {
  AdditionalDocumentDate,
  ConfidentialityLevel,
  DocumentenApiMetadata,
  DocumentLanguage,
  DocumentStatus,
  SupportedDocumentenApiFeatures,
} from '../../models';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  from,
  map,
  Observable,
  of,
  startWith,
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
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  InputLabelModule,
  InputModule,
  ModalService,
  SelectModule,
  ValtimoModalService,
  VModalComponent,
  VModalModule,
} from '@valtimo/components';

import {
  ButtonModule,
  ComboBoxModule,
  DatePickerModule,
  DropdownModule,
  IconModule,
  InputModule as CarbonInputModule,
  ListItem,
  ModalModule,
  RadioModule,
  TagModule,
  TooltipModule,
} from 'carbon-components-angular';
import {DocumentenApiTagService} from '../../services/documenten-api-tag.service';
import moment from 'moment';
import {DocumentenApiUploadFieldDefaultValues} from '../../models/documenten-api-upload-field.model';
import {DocumentenApiVersionService} from '../../services';

@Component({
  selector: 'valtimo-documenten-api-metadata-modal',
  templateUrl: './documenten-api-metadata-modal.component.html',
  styleUrls: ['./documenten-api-metadata-modal.component.scss'],
  standalone: true,
  imports: [
    ButtonModule,
    CarbonInputModule,
    ComboBoxModule,
    CommonModule,
    DatePickerModule,
    DropdownModule,
    IconModule,
    InputLabelModule,
    InputModule,
    ModalModule,
    RadioModule,
    ReactiveFormsModule,
    SelectModule,
    TagModule,
    TooltipModule,
    TranslateModule,
    VModalModule,
  ],
})
export class DocumentenApiMetadataModalComponent implements OnInit, OnDestroy {
  @ViewChild('metadataModal') metadataModal: VModalComponent;

  @Input() disabled$!: Observable<boolean>;
  @Input() file$!: Observable<any>;

  @Input() hideFields: Array<string> = [];
  @Input() defaultValues: DocumentenApiUploadFieldDefaultValues = {};
  @Input() set disableAuthor(value: boolean) {
    if (value) {
      this.auteur.disable();
    } else {
      this.auteur.enable();
    }
  }
  @Input() set disableConfidentialityLevel(value: boolean) {
    if (value) {
      this.confidentialityLevelFormControl.disable();
    } else {
      this.confidentialityLevelFormControl.enable();
    }
  }
  @Input() set disableDescription(value: boolean) {
    if (value) {
      this.beschrijving.disable();
    } else {
      this.beschrijving.enable();
    }
  }
  @Input() set disableDocumentTitle(value: boolean) {
    if (value) {
      this.titel.disable();
    } else {
      this.titel.enable();
    }
  }
  @Input() set disableDocumentType(value: boolean) {
    if (value) {
      this.informatieobjecttypeFormControl.disable();
    } else {
      this.informatieobjecttypeFormControl.enable();
    }
  }
  @Input() set disableFilename(value: boolean) {
    if (value) {
      this.bestandsnaam.disable();
    } else {
      this.bestandsnaam.enable();
    }
  }
  @Input() set disableLanguage(value: boolean) {
    if (value) {
      this.languageFormControl.disable();
    } else {
      this.languageFormControl.enable();
    }
  }
  @Input() set disableStatus(value: boolean) {
    if (value) {
      this.statusFormControl.disable();
    } else {
      this.statusFormControl.enable();
    }
  }
  @Input() supportsTrefwoorden = false;
  @Input() set disableCreationDate(value: boolean) {
    if (value) {
      this.creatiedatum.disable();
    } else {
      this.creatiedatum.enable();
    }
  }
  @Input() isEditMode: boolean;

  public readonly open$ = new BehaviorSubject<boolean>(false);

  @Input() set open(value: boolean) {
    this.open$.next(value);

    if (value) {
      this.modalService.openModal(this.metadataModal);
    } else {
      this.modalService.closeModal();
    }
  }

  @Output() metadata: EventEmitter<DocumentenApiMetadata> = new EventEmitter();
  @Output() modalClose: EventEmitter<boolean> = new EventEmitter();

  public filenameExtension: string = '';
  public documentenApiMetadataForm: FormGroup = this.fb.group({
    bestandsnaam: this.fb.control(''),
    titel: this.fb.control('', Validators.required),
    auteur: this.fb.control('', Validators.required),
    beschrijving: this.fb.control(''),
    taal: this.fb.control('', Validators.required),
    informatieobjecttype: this.fb.control('', Validators.required),
    status: this.fb.control(''),
    vertrouwelijkheidaanduiding: this.fb.control(''),
    creatiedatum: this.fb.control('', Validators.required),
    ontvangstdatum: this.fb.control(''),
    verzenddatum: this.fb.control(''),
    trefwoorden: this.fb.control([]),
  });

  public get confidentialityLevelFormControl(): AbstractControl<string> {
    return this.documentenApiMetadataForm.get('vertrouwelijkheidaanduiding');
  }
  public get confidentialityLevelDisabled$(): Observable<boolean> {
    return this.confidentialityLevelFormControl.valueChanges.pipe(
      startWith(null),
      map(() => this.confidentialityLevelFormControl.disabled)
    );
  }

  public get informatieobjecttypeFormControl(): AbstractControl<string> {
    return this.documentenApiMetadataForm.get('informatieobjecttype');
  }
  public get informatieobjecttypeDisabled$(): Observable<boolean> {
    return this.informatieobjecttypeFormControl.valueChanges.pipe(
      startWith(null),
      map(() => this.informatieobjecttypeFormControl.disabled)
    );
  }

  public get languageFormControl(): AbstractControl<string> {
    return this.documentenApiMetadataForm.get('taal');
  }

  public get languageDisabled$(): Observable<boolean> {
    return this.languageFormControl.valueChanges.pipe(
      startWith(null),
      map(() => this.languageFormControl.disabled)
    );
  }

  public get statusFormControl(): AbstractControl<string> {
    return this.documentenApiMetadataForm.get('status');
  }
  public get statusDisabled$(): Observable<boolean> {
    return this.statusFormControl.valueChanges.pipe(
      startWith(null),
      map(() => this.informatieobjecttypeFormControl.disabled)
    );
  }

  public get tagFormControl(): AbstractControl<string[]> {
    return this.documentenApiMetadataForm.get('trefwoorden');
  }

  public get creatiedatum(): AbstractControl<string> {
    return this.documentenApiMetadataForm.get('creatiedatum');
  }

  public get titel(): AbstractControl<string> {
    return this.documentenApiMetadataForm.get('titel');
  }

  public get beschrijving(): AbstractControl<string> {
    return this.documentenApiMetadataForm.get('beschrijving');
  }

  public get auteur(): AbstractControl<string> {
    return this.documentenApiMetadataForm.get('auteur');
  }

  public get bestandsnaam(): AbstractControl<string> {
    return this.documentenApiMetadataForm.get('bestandsnaam');
  }

  public readonly editDisabled$ = new BehaviorSubject<boolean>(false);

  public readonly CONFIDENTIALITY_LEVELS: Array<ConfidentialityLevel> = [
    'openbaar',
    'beperkt_openbaar',
    'intern',
    'zaakvertrouwelijk',
    'vertrouwelijk',
    'confidentieel',
    'geheim',
    'zeer_geheim',
  ];
  public readonly confidentialityLevelItems$: Observable<Array<ListItem>> = combineLatest([
    this.confidentialityLevelFormControl.valueChanges.pipe(
      startWith(this.confidentialityLevelFormControl.value)
    ),
    this.translateService.stream('key'),
  ]).pipe(
    map(([currentConfidentialityLevel]) =>
      this.CONFIDENTIALITY_LEVELS.map(confidentialityLevel => ({
        id: confidentialityLevel,
        content: this.translateService.instant(`document.${confidentialityLevel}`),
        selected: currentConfidentialityLevel === confidentialityLevel,
      }))
    )
  );

  public readonly ADDITONAL_DOCUMENT_DATE_OPTIONS: Array<{
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
  public readonly clearStatusSelection$ = new Subject<null>();
  public readonly additionalDocumentDate$ = new BehaviorSubject<AdditionalDocumentDate>('neither');
  public readonly STATUSES: Array<DocumentStatus> = [
    'in_bewerking',
    'ter_vaststelling',
    'definitief',
    'gearchiveerd',
  ];
  public readonly RECEIPT_STATUSES: Array<DocumentStatus> = ['definitief', 'gearchiveerd'];
  public readonly formData$ = new BehaviorSubject<DocumentenApiMetadata>(null);
  public readonly statusItems$: Observable<Array<ListItem>> = combineLatest([
    this.additionalDocumentDate$,
    this.statusFormControl.valueChanges.pipe(startWith(this.statusFormControl.value)),
    this.translateService.stream('key'),
  ]).pipe(
    tap(([additionalDocumentDate, currentStatus]) => {
      this.formData$
        .pipe(
          filter(formData => !!formData),
          take(1)
        )
        .subscribe(formData => {
          if (
            additionalDocumentDate === 'received' &&
            (formData.status === 'in_bewerking' || formData.status === 'ter_vaststelling')
          ) {
            this.clearStatusSelection$.next(null);
          }
        });
    }),
    map(([additionalDocumentDate, currentStatus]) =>
      (additionalDocumentDate === 'received' ? this.RECEIPT_STATUSES : this.STATUSES).map(
        status => ({
          id: status,
          content: this.translateService.instant(`document.${status}`),
          selected: currentStatus === status,
        })
      )
    )
  );

  public readonly tagItems$: Observable<Array<ListItem>> = combineLatest([
    this.valtimoModalService.documentDefinitionName$,
    this.tagFormControl.valueChanges.pipe(startWith(this.tagFormControl.value)),
  ]).pipe(
    filter(([documentDefinitionName]) => !!documentDefinitionName),
    switchMap(([documentDefinitionName, tagFormControlValue]) =>
      combineLatest([
        this.documentenApiTagService.getTags(documentDefinitionName),
        of(tagFormControlValue),
      ])
    ),
    map(([tags, tagFormControlValue]) =>
      tags.map(tag => ({
        id: tag.value,
        content: tag.value,
        selected: !!tagFormControlValue ? tagFormControlValue.includes(tag.value) : false,
      }))
    )
  );

  public readonly LANGUAGES: Array<DocumentLanguage> = ['nld', 'eng', 'deu'];
  public languageItems$: Observable<Array<ListItem>> = combineLatest([
    this.languageFormControl.valueChanges.pipe(startWith(this.languageFormControl.value)),
    this.translateService.stream('key'),
  ]).pipe(
    map(([currentLanguage]) => {
      return this.LANGUAGES.map(
        (language: any) =>
          ({
            content: this.translateService.instant(`document.${language}`),
            id: language,
            selected: currentLanguage === language,
          }) as ListItem
      );
    })
  );

  public readonly documentTypeItems$: Observable<Array<ListItem>> = combineLatest([
    this.valtimoModalService.documentDefinitionName$,
    this.informatieobjecttypeFormControl.valueChanges.pipe(
      startWith(this.informatieobjecttypeFormControl.value)
    ),
  ]).pipe(
    switchMap(([documentDefinitionName, informatieobjecttypeValue]) =>
      combineLatest([
        this.documentService.getDocumentTypes(documentDefinitionName),
        of(informatieobjecttypeValue),
      ])
    ),
    map(([documentTypes, informatieobjecttypeValue]) =>
      documentTypes.map((type: any) => ({
        id: type.url,
        content: type.name,
        selected: informatieobjecttypeValue === type.url,
      }))
    )
  );
  public readonly userEmail$ = from(this.keycloakService.loadUserProfile()).pipe(
    map(userProfile => userProfile?.email || '')
  );

  private readonly _supportedDocumentenApiFeatures$: Observable<SupportedDocumentenApiFeatures> =
    this.valtimoModalService.documentDefinitionName$.pipe(
      switchMap(documentDefinitionName =>
        this.documentenApiVersionService.getSupportedApiFeatures(documentDefinitionName)
      )
    );

  private _subscriptions = new Subscription();
  private _fileSubscription!: Subscription;
  private _fileNameAndAuthorSubscription!: Subscription;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly documentService: DocumentService,
    private readonly documentenApiTagService: DocumentenApiTagService,
    private readonly fb: FormBuilder,
    private readonly keycloakService: KeycloakService,
    private readonly modalService: ModalService,
    private readonly translateService: TranslateService,
    private readonly valtimoModalService: ValtimoModalService,
    private readonly documentenApiVersionService: DocumentenApiVersionService
  ) {}

  public ngOnInit(): void {
    this.openFileSubscription();
    this.openDisabledSubscription();
    this.openFilenameSubscription();
    this.openDocumentDefinitionSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this._fileSubscription?.unsubscribe();
    this._fileNameAndAuthorSubscription?.unsubscribe();
    this.editDisabled$.next(false);
  }

  public languageSelected(event: {item: {id: string}}) {
    if (event.item.id) {
      this.documentenApiMetadataForm.patchValue({
        taal: event.item.id,
      });
    }
  }

  public tagsSelected(event: Array<ListItem>) {
    this.tagFormControl.patchValue(event.filter(tag => tag.selected).map(tag => tag.id));
  }

  public confidentialityLevelSelected(event: {id: string}) {
    if (event.id) {
      this.documentenApiMetadataForm.patchValue({
        vertrouwelijkheidaanduiding: event.id,
      });
    }
  }

  public statusSelected(event: {id: string}) {
    if (event.id) {
      this.documentenApiMetadataForm.patchValue({
        status: event.id,
      });
    }
  }

  public informatieobjecttypeSelected(event: {item: {id: string}}) {
    if (event.item.id) {
      this.documentenApiMetadataForm.patchValue({
        informatieobjecttype: event.item.id,
      });
    }
  }

  public prefillForm(file) {
    this.prefillFilenameAndAuthor();

    if (file) {
      const {
        beschrijving,
        taal,
        informatieobjecttype,
        status,
        vertrouwelijkheidaanduiding,
        ontvangstdatum,
        verzenddatum,
        trefwoorden,
      } = file;

      if (verzenddatum) this.additionalDocumentDate$.next('sent');
      else if (ontvangstdatum) this.additionalDocumentDate$.next('received');
      else this.additionalDocumentDate$.next('neither');

      const prefillStatus = status || this.defaultValues.status;
      const validPrefillStatus = this.STATUSES.includes(prefillStatus) ? prefillStatus : '';

      this.documentenApiMetadataForm.patchValue({
        beschrijving: beschrijving || this.defaultValues.beschrijving,
        taal: taal || this.defaultValues.taal,
        informatieobjecttype: informatieobjecttype || this.defaultValues.informatieobjecttype,
        status: validPrefillStatus,
        vertrouwelijkheidaanduiding:
          vertrouwelijkheidaanduiding || this.defaultValues.vertrouwelijkheidaanduiding,
        ontvangstdatum: ontvangstdatum ? new Date(ontvangstdatum) : null,
        verzenddatum: verzenddatum ? new Date(verzenddatum) : null,
        trefwoorden: trefwoorden || this.defaultValues.trefwoorden,
      });
    }
  }

  public save(): void {
    this.formatDate('creatiedatum');
    this.formatDate('verzenddatum');
    this.formatDate('ontvangstdatum');

    const rawValue = this.documentenApiMetadataForm.getRawValue();
    const mappedRawValue = Object.keys(rawValue).reduce(
      (acc, currentKey) =>
        rawValue[currentKey] !== undefined ? {...acc, [currentKey]: rawValue[currentKey]} : acc,
      {}
    ) as DocumentenApiMetadata;

    if (this.documentenApiMetadataForm.valid) this.metadata.emit(mappedRawValue);

    this.closeModal();
  }

  public closeModal(): void {
    this.modalService.closeModal(() => {
      this.additionalDocumentDate$.next('neither');
      this.modalClose.emit();
      this.clearForm();
    });
  }

  private clearForm(): void {
    this.documentenApiMetadataForm.reset();
  }

  private prefillFilenameAndAuthor() {
    this._fileNameAndAuthorSubscription?.unsubscribe();
    this._fileNameAndAuthorSubscription = combineLatest([this.file$, this.userEmail$])
      .pipe(
        tap(([file, userEmail]) => {
          const filename = file?.bestandsnaam || this.defaultValues.bestandsnaam || file?.name;
          this.filenameExtension = filename?.split('.')?.pop() || '';
          if (this.filenameExtension.length === filename?.length) {
            this.filenameExtension = '';
          }
          this.documentenApiMetadataForm.patchValue({
            bestandsnaam: filename,
            auteur: file?.auteur || this.defaultValues.auteur || userEmail,
            creatiedatum: file?.creatiedatum || new Date(Date.now()),
            titel:
              file?.titel ||
              this.defaultValues.titel ||
              this.filenameToTitle(file?.name || this.defaultValues.bestandsnaam),
          });
          if (this.areAllFieldsHidden()) {
            this.save();
          }
        })
      )
      .subscribe();
  }

  private filenameToTitle(filename?: string) {
    if (!filename) {
      return null;
    }

    filename = filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]+/g, ' ');
    return filename.charAt(0).toUpperCase() + filename.slice(1);
  }

  private formatDate(controlName: string): void {
    const control = this.documentenApiMetadataForm.controls[controlName];
    if (control.value) {
      this.documentenApiMetadataForm.patchValue({
        [controlName]: this.toFormattedDate(control.value),
      });
    }
  }

  private toFormattedDate(date: any): string {
    return moment(new Date(date)).format('YYYY-MM-DD');
  }

  private openFileSubscription(): void {
    this._fileSubscription?.unsubscribe();
    if (this.file$) {
      this._fileSubscription = combineLatest([
        this.file$,
        this._supportedDocumentenApiFeatures$,
      ]).subscribe(([file, support]) => {
        if (file) {
          this.prefillForm(file);
          this.editDisabled$.next(
            !support.supportsUpdatingDefinitiveDocument &&
              file.status === 'definitief' &&
              this.isEditMode
          );
        }
      });
    }
  }

  public openDisabledSubscription(): void {
    this._subscriptions.add(
      this.disabled$?.subscribe(disabled => {
        if (disabled) {
          this.documentenApiMetadataForm.disable();
        } else {
          this.documentenApiMetadataForm.enable();
        }
      })
    );
  }

  private openFilenameSubscription() {
    this._subscriptions.add(
      this.bestandsnaam.valueChanges.subscribe(bestandsnaam => {
        if (bestandsnaam && this.filenameExtension) {
          let correctBestandsnaam =
            bestandsnaam.replace(/\.[^/.]+$/, '') + '.' + this.filenameExtension;
          if (correctBestandsnaam != bestandsnaam) {
            this.documentenApiMetadataForm.patchValue({
              bestandsnaam: correctBestandsnaam,
            });
          }
        }
      })
    );
  }

  private openDocumentDefinitionSubscription() {
    this._subscriptions.add(
      combineLatest([this.route?.params || of(null), this.route?.firstChild?.params || of(null)])
        .pipe(
          map(
            ([params, firstChildParams]) =>
              (params?.documentDefinitionName || firstChildParams?.documentDefinitionName) as string
          ),
          filter(documentDefinitionName => !!documentDefinitionName)
        )
        .subscribe(documentDefinitionName =>
          this.valtimoModalService.setDocumentDefinitionName(documentDefinitionName)
        )
    );
  }

  private setAdditionalDate(value: AdditionalDocumentDate): void {
    this.additionalDocumentDate$.next(value);
  }

  private areAllFieldsHidden(): boolean {
    return (
      this.hideFields.includes('aanvullendeDatum') &&
      this.hideFields.includes('auteur') &&
      this.hideFields.includes('vertrouwelijkheidaanduiding') &&
      this.hideFields.includes('creatiedatum') &&
      this.hideFields.includes('beschrijving') &&
      this.hideFields.includes('titel') &&
      this.hideFields.includes('informatieobjecttype') &&
      this.hideFields.includes('bestandsnaam') &&
      this.hideFields.includes('taal') &&
      this.hideFields.includes('status') &&
      this.hideFields.includes('trefwoorden')
    );
  }
}
