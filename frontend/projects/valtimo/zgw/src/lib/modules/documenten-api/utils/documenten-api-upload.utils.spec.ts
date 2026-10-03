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

import {DocumentenApiMetadata} from '../models';
import {
  DOCUMENTEN_API_UPLOAD_KEYS,
  DocumentenApiUploadFields,
} from '../models/documenten-api-upload-field.model';
import {
  areAllUploadFieldsHidden,
  filenameToTitle,
  getBatchFileMetadata,
} from './documenten-api-upload.utils';

describe('documenten-api-upload.utils', () => {
  const sharedMetadata = {
    titel: 'Paspoort',
    bestandsnaam: 'paspoort.pdf',
    auteur: 'ambtenaar@example.com',
    creatiedatum: '2026-10-02',
    taal: 'nld',
    informatieobjecttype: 'http://localhost/catalogi/api/v1/informatieobjecttypen/1',
    status: 'in_bewerking',
    vertrouwelijkheidaanduiding: 'intern',
    beschrijving: 'Aangeleverd door de aanvrager',
    trefwoorden: ['aanvraag'],
    documentUrlProcessVariable: null,
  } as DocumentenApiMetadata;
  const file = new File(['%PDF'], 'bouw_tekening.v2.pdf', {type: 'application/pdf'});

  describe('getBatchFileMetadata', () => {
    it('gives a batch file its own filename and a title derived from it', () => {
      const metadata = getBatchFileMetadata(file, sharedMetadata, null);

      expect(metadata.bestandsnaam).toBe('bouw_tekening.v2.pdf');
      expect(metadata.titel).toBe('Bouw tekening v2');
    });

    it('titles a batch file whose name is only an extension after its file name', () => {
      const dotfile = new File(['KEY=value'], '.env', {type: 'text/plain'});

      expect(getBatchFileMetadata(dotfile, sharedMetadata, null).titel).toBe('.env');
    });

    it('applies every shared value to the batch file', () => {
      const metadata = getBatchFileMetadata(file, sharedMetadata, null);

      expect(metadata).toEqual(
        jasmine.objectContaining({
          auteur: 'ambtenaar@example.com',
          creatiedatum: '2026-10-02',
          taal: 'nld',
          informatieobjecttype: 'http://localhost/catalogi/api/v1/informatieobjecttypen/1',
          status: 'in_bewerking',
          vertrouwelijkheidaanduiding: 'intern',
          beschrijving: 'Aangeleverd door de aanvrager',
          trefwoorden: ['aanvraag'],
        })
      );
    });

    it('ignores an editable default filename and title, which the user cannot change per file', () => {
      const uploadFields: DocumentenApiUploadFields = {
        bestandsnaam: {
          key: DOCUMENTEN_API_UPLOAD_KEYS.BESTANDSNAAM,
          defaultValue: 'bijlage',
          visible: true,
          readonly: false,
        },
        titel: {
          key: DOCUMENTEN_API_UPLOAD_KEYS.TITEL,
          defaultValue: 'Bijlage',
          visible: true,
          readonly: false,
        },
      };

      const metadata = getBatchFileMetadata(file, sharedMetadata, uploadFields);

      expect(metadata.bestandsnaam).toBe('bouw_tekening.v2.pdf');
      expect(metadata.titel).toBe('Bouw tekening v2');
    });

    it('applies a readonly default title and filename, keeping the file its own extension', () => {
      const uploadFields: DocumentenApiUploadFields = {
        bestandsnaam: {
          key: DOCUMENTEN_API_UPLOAD_KEYS.BESTANDSNAAM,
          defaultValue: 'bijlage.docx',
          visible: true,
          readonly: true,
        },
        titel: {
          key: DOCUMENTEN_API_UPLOAD_KEYS.TITEL,
          defaultValue: 'Bijlage',
          visible: true,
          readonly: true,
        },
      };

      const metadata = getBatchFileMetadata(file, sharedMetadata, uploadFields);

      expect(metadata.bestandsnaam).toBe('bijlage.pdf');
      expect(metadata.titel).toBe('Bijlage');
    });

    it('applies a hidden default title, which the user could not see or change', () => {
      const uploadFields: DocumentenApiUploadFields = {
        titel: {
          key: DOCUMENTEN_API_UPLOAD_KEYS.TITEL,
          defaultValue: 'Bijlage',
          visible: false,
          readonly: false,
        },
      };

      expect(getBatchFileMetadata(file, sharedMetadata, uploadFields).titel).toBe('Bijlage');
    });
  });

  describe('filenameToTitle', () => {
    it('derives a title the way a single upload prefills it', () => {
      expect(filenameToTitle('bouw_tekening.v2.pdf')).toBe('Bouw tekening v2');
      expect(filenameToTitle(undefined)).toBeNull();
    });
  });

  describe('areAllUploadFieldsHidden', () => {
    it('is true only when every upload form field is hidden', () => {
      const allKeys = [
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

      expect(areAllUploadFieldsHidden(allKeys)).toBeTrue();
      expect(areAllUploadFieldsHidden(allKeys.filter(key => key !== 'taal'))).toBeFalse();
      expect(areAllUploadFieldsHidden([])).toBeFalse();
    });
  });
});
