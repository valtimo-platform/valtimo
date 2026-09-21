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
import {FormBuilder} from '@angular/forms';
import {of} from 'rxjs';
import {DocumentenApiMetadata} from '../../models';
import {DocumentenApiMetadataModalComponent} from './documenten-api-metadata-modal.component';

describe('DocumentenApiMetadataModalComponent', () => {
  let component: DocumentenApiMetadataModalComponent;
  let emitted: Array<DocumentenApiMetadata>;

  beforeEach(() => {
    component = new DocumentenApiMetadataModalComponent(
      {params: of({})} as any,
      {} as any,
      {} as any,
      new FormBuilder(),
      {loadUserProfile: () => Promise.resolve({email: 'ambtenaar@example.com'})} as any,
      {closeModal: () => {}} as any,
      {stream: () => of('')} as any,
      {caseDefinitionKey$: of('some-case')} as any,
      {} as any,
      {documentId$: of(null)} as any
    );

    component.documentenApiMetadataForm.patchValue({
      auteur: 'ambtenaar@example.com',
      creatiedatum: '2026-09-06',
      informatieobjecttype: 'http://localhost/catalogi/api/v1/informatieobjecttypen/1',
      taal: 'nld',
      titel: 'Paspoort',
    });

    emitted = [];
    component.metadata.subscribe(metadata => emitted.push(metadata));
  });

  it('emits the metadata when the form is submitted', () => {
    expect(component.documentenApiMetadataForm.valid).toBeTrue();

    component.save();

    expect(emitted.length).toBe(1);
  });

  it('does not emit the metadata again while an upload is already in flight', () => {
    component.save();

    component.uploading = true;
    component.save();
    component.save();

    expect(emitted.length).toBe(1);
  });
});
