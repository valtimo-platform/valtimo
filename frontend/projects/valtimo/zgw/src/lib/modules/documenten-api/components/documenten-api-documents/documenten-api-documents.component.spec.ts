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
import {HttpErrorResponse} from '@angular/common/http';
import {NO_ERRORS_SCHEMA, Pipe, PipeTransform} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {ActivatedRoute, Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {PermissionService} from '@valtimo/access-control';
import {DocumentService} from '@valtimo/document';
import {DownloadService, UploadProviderService} from '@valtimo/resource';
import {UserProviderService} from '@valtimo/security';
import {ConfigService, GlobalNotificationService} from '@valtimo/shared';
import {IconService} from 'carbon-components-angular';
import {Observable, of, Subject, throwError} from 'rxjs';
import {DocumentenApiMetadata} from '../../models';
import {
  DocumentenApiColumnService,
  DocumentenApiDocumentService,
  DocumentenApiPreviewService,
  DocumentenApiVersionService,
} from '../../services';
import {CaseDetailTabDocumentenApiDocumentsComponent} from './documenten-api-documents.component';

@Pipe({name: 'translate', standalone: true})
class TranslatePipeStub implements PipeTransform {
  public transform(key: string): string {
    return key;
  }
}

describe('CaseDetailTabDocumentenApiDocumentsComponent', () => {
  const ALL_UPLOAD_FIELD_KEYS = [
    'aanvullendeDatum',
    'auteur',
    'vertrouwelijkheidaanduiding',
    'creatiedatum',
    'beschrijving',
    'titel',
    'informatieobjecttype',
    'bestandsnaam',
    'taal',
    'status',
    'trefwoorden',
  ];

  const sharedMetadata = {
    titel: 'Aanvraag',
    bestandsnaam: 'aanvraag.pdf',
    auteur: 'ambtenaar@example.com',
    creatiedatum: '2026-10-02',
    taal: 'nld',
    informatieobjecttype: 'http://localhost/catalogi/api/v1/informatieobjecttypen/1',
    vertrouwelijkheidaanduiding: 'intern',
    documentUrlProcessVariable: null,
  } as DocumentenApiMetadata;

  const aanvraag = new File(['a'], 'aanvraag.pdf', {type: 'application/pdf'});
  const bouwTekening = new File(['b'], 'bouw_tekening.pdf', {type: 'application/pdf'});
  const situatieFoto = new File(['c'], 'situatie-foto.jpg', {type: 'image/jpeg'});

  let component: CaseDetailTabDocumentenApiDocumentsComponent;
  let uploadFileWithMetadata: jasmine.Spy;
  let updateDocument: jasmine.Spy;
  let showToast: jasmine.Spy;
  let prefilledUploadFields: Array<{key: string; defaultValue?: string; visible: boolean}>;

  const selectFiles = (...files: Array<File>): void => component.onFileSelected({target: {files}});

  const uploadedFiles = (): Array<File> =>
    uploadFileWithMetadata.calls.allArgs().map(args => args[0]);

  const save = (metadata: DocumentenApiMetadata): void => component.metadataSet(metadata as any);

  const uploadedMetadata = (index: number): DocumentenApiMetadata =>
    uploadFileWithMetadata.calls.argsFor(index)[2];

  beforeEach(() => {
    prefilledUploadFields = [];
    uploadFileWithMetadata = jasmine.createSpy('uploadFileWithMetadata').and.returnValue(of(null));
    updateDocument = jasmine.createSpy('updateDocument').and.returnValue(of(null));
    showToast = jasmine.createSpy('showToast');

    TestBed.configureTestingModule({
      providers: [
        CaseDetailTabDocumentenApiDocumentsComponent,
        {
          provide: ConfigService,
          useValue: {
            config: {valtimoApi: {endpointUri: '/api/'}},
            getFeatureToggleObservable: () => of(false),
          },
        },
        {
          provide: DocumentenApiColumnService,
          useValue: {getConfiguredColumns: () => of([{key: 'titel'}])},
        },
        {
          provide: DocumentenApiDocumentService,
          useValue: {
            getPrefilledUploadFields: () => of(prefilledUploadFields),
            getFilteredZakenApiDocuments: () => of({content: [], totalElements: 0}),
            updateDocument,
          },
        },
        {provide: DocumentenApiPreviewService, useValue: {}},
        {provide: DocumentenApiVersionService, useValue: {getSupportedApiFeatures: () => of({})}},
        {provide: DocumentService, useValue: {getCaseSettings: () => of({})}},
        {provide: DownloadService, useValue: {}},
        {provide: IconService, useValue: {register: () => {}, registerAll: () => {}}},
        {provide: PermissionService, useValue: {}},
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({caseDefinitionKey: 'bouwvergunning', documentId: 'case-document-1'}),
            queryParamMap: of({params: {}}),
          },
        },
        {provide: Router, useValue: {navigate: () => Promise.resolve(true)}},
        {
          provide: TranslateService,
          useValue: {
            instant: (key: string, params?: {files?: string}) =>
              params?.files ? `${key}: ${params.files}` : key,
            stream: () => of(''),
          },
        },
        {
          provide: UploadProviderService,
          useValue: {uploadFileWithMetadata, checkUploadProcessLink: () => of(true)},
        },
        {provide: UserProviderService, useValue: {getUserSubject: () => of({roles: []})}},
        {provide: GlobalNotificationService, useValue: {showToast}},
      ],
    }).overrideComponent(CaseDetailTabDocumentenApiDocumentsComponent, {
      set: {imports: [CommonModule, TranslatePipeStub], schemas: [NO_ERRORS_SCHEMA]},
    });

    component = TestBed.inject(CaseDetailTabDocumentenApiDocumentsComponent);
    component.fileInput = {nativeElement: {value: ''}} as any;
  });

  it('uploads every selected file, one after another, from a single save', () => {
    const pending: Array<Subject<void>> = [];
    uploadFileWithMetadata.and.callFake((): Observable<void> => {
      const upload = new Subject<void>();
      pending.push(upload);
      return upload;
    });

    selectFiles(aanvraag, bouwTekening, situatieFoto);
    save(sharedMetadata);

    expect(uploadedFiles()).toEqual([aanvraag]);

    pending[0].next();
    pending[0].complete();
    expect(uploadedFiles()).toEqual([aanvraag, bouwTekening]);

    pending[1].next();
    pending[1].complete();
    pending[2].next();
    pending[2].complete();

    expect(uploadedFiles()).toEqual([aanvraag, bouwTekening, situatieFoto]);
    expect(component.showUploadModal$.getValue()).toBeFalse();
  });

  it('gives every file its own filename and title and the metadata entered once', () => {
    selectFiles(aanvraag, bouwTekening, situatieFoto);
    save(sharedMetadata);

    expect(uploadFileWithMetadata).toHaveBeenCalledTimes(3);
    expect([0, 1, 2].map(index => uploadedMetadata(index).bestandsnaam)).toEqual([
      'aanvraag.pdf',
      'bouw_tekening.pdf',
      'situatie-foto.jpg',
    ]);
    expect([0, 1, 2].map(index => uploadedMetadata(index).titel)).toEqual([
      'Aanvraag',
      'Bouw tekening',
      'Situatie-foto',
    ]);
    [0, 1, 2].forEach(index =>
      expect(uploadedMetadata(index)).toEqual(
        jasmine.objectContaining({
          auteur: 'ambtenaar@example.com',
          taal: 'nld',
          informatieobjecttype: 'http://localhost/catalogi/api/v1/informatieobjecttypen/1',
          vertrouwelijkheidaanduiding: 'intern',
        })
      )
    );
  });

  it('keeps the modal open naming the failed file, and retries only that file under its own name', () => {
    uploadFileWithMetadata.and.callFake((file: File) =>
      file === bouwTekening ? throwError(() => new HttpErrorResponse({status: 500})) : of(null)
    );

    selectFiles(aanvraag, bouwTekening, situatieFoto);
    save(sharedMetadata);

    expect(uploadedFiles()).toEqual([aanvraag, bouwTekening, situatieFoto]);
    expect(component.showUploadModal$.getValue()).toBeTrue();
    expect(component.uploadError()).toContain('bouw_tekening.pdf');
    expect(component.uploadError()).not.toContain('aanvraag.pdf');

    uploadFileWithMetadata.calls.reset();
    uploadFileWithMetadata.and.returnValue(of(null));
    save(sharedMetadata);

    expect(uploadedFiles()).toEqual([bouwTekening]);
    expect(uploadedMetadata(0).bestandsnaam).toBe('bouw_tekening.pdf');
    expect(uploadedMetadata(0).titel).toBe('Bouw tekening');
    expect(uploadedMetadata(0).taal).toBe('nld');
    expect(component.showUploadModal$.getValue()).toBeFalse();
  });

  it('adds the permission message when a file in the selection is refused', () => {
    uploadFileWithMetadata.and.callFake((file: File) =>
      file === situatieFoto ? throwError(() => new HttpErrorResponse({status: 403})) : of(null)
    );

    selectFiles(aanvraag, situatieFoto);
    save(sharedMetadata);

    expect(component.uploadError()).toContain('situatie-foto.jpg');
    expect(component.uploadError()).toContain('document.uploadPermissionDenied');
  });

  it('uploads the whole selection when every upload field is prefilled and hidden', () => {
    prefilledUploadFields = ALL_UPLOAD_FIELD_KEYS.map(key => ({key, visible: false}));

    selectFiles(aanvraag, bouwTekening, situatieFoto);
    save(sharedMetadata);

    expect(uploadedFiles()).toEqual([aanvraag, bouwTekening, situatieFoto]);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('reports failed files on the page when the form saved itself, and leaves nothing pending', () => {
    prefilledUploadFields = ALL_UPLOAD_FIELD_KEYS.map(key => ({key, visible: false}));
    uploadFileWithMetadata.and.callFake((file: File) =>
      file === bouwTekening ? throwError(() => new HttpErrorResponse({status: 500})) : of(null)
    );

    selectFiles(aanvraag, bouwTekening, situatieFoto);
    save(sharedMetadata);

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast.calls.argsFor(0)[0]).toEqual(
      jasmine.objectContaining({
        type: 'error',
        caption: jasmine.stringContaining('bouw_tekening.pdf'),
      })
    );

    uploadFileWithMetadata.calls.reset();
    save(sharedMetadata);

    expect(uploadFileWithMetadata).not.toHaveBeenCalled();
  });

  describe('when the form was closed and opened for another pick during a batch', () => {
    const bijlage = new File(['d'], 'bijlage.pdf', {type: 'application/pdf'});
    let firstUpload: Subject<null>;

    beforeEach(() => {
      firstUpload = new Subject<null>();
      selectFiles(aanvraag, bouwTekening);
    });

    const finishFirstBatch = (): void => {
      save(sharedMetadata);
      component.closeMetadataModal();
      selectFiles(situatieFoto, bijlage);
      firstUpload.next(null);
      firstUpload.complete();
    };

    const filesTheNextSaveUploads = (): Array<File> => {
      uploadFileWithMetadata.calls.reset();
      uploadFileWithMetadata.and.returnValue(of(null));
      save(sharedMetadata);
      return uploadedFiles();
    };

    it('does not start the newer batch while the earlier one is still uploading', () => {
      uploadFileWithMetadata.and.returnValue(firstUpload);
      save(sharedMetadata);
      component.closeMetadataModal();
      selectFiles(situatieFoto, bijlage);

      save(sharedMetadata);

      expect(uploadedFiles()).toEqual([aanvraag]);
    });

    it('leaves the newer selection open when the earlier batch succeeds', () => {
      uploadFileWithMetadata.and.returnValues(firstUpload, of(null));

      finishFirstBatch();

      expect(component.showUploadModal$.getValue()).toBeTrue();
      expect(component.fileToBeUploaded$.getValue()).toBe(situatieFoto);
      expect(filesTheNextSaveUploads()).toEqual([situatieFoto, bijlage]);
    });

    it('reports the earlier batch failures on the page and leaves the newer selection alone', () => {
      uploadFileWithMetadata.and.returnValues(
        firstUpload,
        throwError(() => new HttpErrorResponse({status: 500}))
      );

      finishFirstBatch();

      expect(component.showUploadModal$.getValue()).toBeTrue();
      expect(component.uploadError()).toBeNull();
      expect(showToast).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({caption: 'document.batchUploadFailed: bouw_tekening.pdf'})
      );
      expect(filesTheNextSaveUploads()).toEqual([situatieFoto, bijlage]);
    });
  });

  it('uploads a single selected file with the values from the form, as before', () => {
    const metadata = {...sharedMetadata, bestandsnaam: 'hernoemd.pdf', titel: 'Hernoemd'};

    selectFiles(aanvraag);
    save(metadata);

    expect(uploadFileWithMetadata).toHaveBeenCalledOnceWith(aanvraag, 'case-document-1', metadata);
    expect(component.showUploadModal$.getValue()).toBeFalse();
  });

  it('edits metadata, not uploads, after a selection was cancelled', () => {
    const existingDocument = {fileId: 'file-1', pluginConfigurationId: 'plugin-1'} as any;

    selectFiles(aanvraag, bouwTekening);
    component.closeMetadataModal();
    component.onEditMetadata(existingDocument);
    save(sharedMetadata);

    expect(uploadFileWithMetadata).not.toHaveBeenCalled();
    expect(updateDocument).toHaveBeenCalledOnceWith(
      existingDocument,
      sharedMetadata,
      'case-document-1'
    );
  });

  it('uploads only the newly picked file after a selection was cancelled', () => {
    selectFiles(aanvraag, bouwTekening);
    component.closeMetadataModal();
    selectFiles(situatieFoto);
    save(sharedMetadata);

    expect(uploadFileWithMetadata).toHaveBeenCalledOnceWith(
      situatieFoto,
      'case-document-1',
      sharedMetadata
    );
  });

  it('lets the Upload file picker select several files at once', () => {
    const fixture = TestBed.createComponent(CaseDetailTabDocumentenApiDocumentsComponent);
    // The stubbed services answer synchronously, so the loading flag flips within one check.
    fixture.detectChanges(false);
    fixture.detectChanges(false);

    const fileInput: HTMLInputElement = fixture.nativeElement.querySelector('input[type="file"]');

    expect(fileInput.multiple).toBeTrue();
  });
});
