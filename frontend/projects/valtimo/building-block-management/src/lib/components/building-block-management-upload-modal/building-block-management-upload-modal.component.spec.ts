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

import {TestBed} from '@angular/core/testing';
import {FormBuilder} from '@angular/forms';
import {TranslateService} from '@ngx-translate/core';
import {FileItem} from 'carbon-components-angular';
import {of} from 'rxjs';
import {UPLOAD_STEP} from '../../constants';
import {ImportedBuildingBlockDefinition} from '../../models';
import {BuildingBlockManagementService} from '../../services';
import {BuildingBlockManagementUploadModalComponent} from './building-block-management-upload-modal.component';

describe('BuildingBlockManagementUploadModalComponent', () => {
  let component: BuildingBlockManagementUploadModalComponent;
  let service: BuildingBlockManagementService;

  const createFile = (): File => new File(['zip'], 'block.zip', {type: 'application/zip'});

  const selectedFile = (): File | undefined => {
    const [fileItem] = component.form.get('file').value as Set<FileItem>;
    return fileItem?.file;
  };

  const imported = [{key: 'income-check', versionTag: '1.0.0'}];

  beforeEach(() => {
    service = new BuildingBlockManagementService();
    component = TestBed.runInInjectionContext(
      () =>
        new BuildingBlockManagementUploadModalComponent(
          {importBuildingBlockDefinition: () => of(imported)} as any,
          service,
          new FormBuilder(),
          {register: () => {}} as any,
          {stream: () => of('')} as unknown as TranslateService
        )
    );
    component.ngOnInit();
  });

  afterEach(() => component.ngOnDestroy());

  it('fills the file control from a preset file', () => {
    const file = createFile();

    service.showUploadModal(file);

    expect(selectedFile()).toBe(file);
  });

  it('applies a preset file only once while open', () => {
    const file = createFile();
    service.showUploadModal(file);
    const first = component.form.get('file').value;

    service.setUsedKeys(['a']);

    expect(component.form.get('file').value).toBe(first);
  });

  it('leaves the file control empty without a preset file', () => {
    service.showUploadModal();

    expect(selectedFile()).toBeUndefined();
  });

  it('clears the preset file when the modal is hidden', async () => {
    service.showUploadModal(createFile());

    service.hideUploadModal();

    const preset = await new Promise<File | null>(resolve =>
      service.presetUploadFile$.subscribe(resolve)
    );
    expect(preset).toBeNull();
  });

  it('reports the imported building blocks when closed after a successful import', () => {
    const finished: Array<Array<ImportedBuildingBlockDefinition>> = [];
    service.importFinished$.subscribe(definitions => finished.push(definitions));
    service.showUploadModal(createFile());
    component.onCheckedChange(true);

    component.onNextClick(UPLOAD_STEP.FILE_SELECT);
    component.onCloseModal(true);

    expect(finished).toEqual([imported]);
  });

  it('reports nothing when closed without importing', () => {
    const finished: Array<Array<ImportedBuildingBlockDefinition>> = [];
    service.importFinished$.subscribe(definitions => finished.push(definitions));

    component.onCloseModal(false);

    expect(finished).toEqual([]);
  });
});
