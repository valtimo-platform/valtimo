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
import {TranslateService} from '@ngx-translate/core';
import {FileItem} from 'carbon-components-angular';
import {firstValueFrom, of, throwError} from 'rxjs';
import {CaseManagementUploadComponent} from './case-management-upload.component';
import {UPLOAD_STEP} from './case-management-upload.constants';

describe('CaseManagementUploadComponent', () => {
  let component: CaseManagementUploadComponent;
  let caseManagementService: jasmine.SpyObj<any>;

  const PREVIEW = {
    key: 'plan',
    name: 'Plan',
    versionTag: '1.0.0',
    isFinal: false,
    pluginConfigurations: [],
  };

  const createFile = (): File => new File(['zip'], 'plan.zip', {type: 'application/zip'});

  const setup = (): void => {
    caseManagementService = jasmine.createSpyObj('CaseManagementService', [
      'previewImport',
      'getCaseDefinitionVersions',
    ]);
    caseManagementService.previewImport.and.returnValue(of(PREVIEW));
    caseManagementService.getCaseDefinitionVersions.and.returnValue(of([]));

    component = new CaseManagementUploadComponent(
      caseManagementService,
      new FormBuilder(),
      {instant: (key: string) => key} as unknown as TranslateService,
      {} as any,
      {} as any,
      {} as any
    );
    component.ngOnInit();
  };

  const select = (file: File): void => {
    component.form
      .get('file')
      .setValue(new Set<FileItem>([{file, state: 'edit', uploaded: false}]));
  };

  afterEach(() => component.ngOnDestroy());

  describe('with a preset file', () => {
    beforeEach(setup);

    it('previews the file and lands on the configure step', async () => {
      component.open = true;
      component.presetFile = createFile();

      component.ngOnChanges({
        open: {currentValue: true} as any,
        presetFile: {currentValue: component.presetFile} as any,
      });

      expect(caseManagementService.previewImport).toHaveBeenCalledTimes(1);
      expect(component.activeStep$.value).toBe(UPLOAD_STEP.CONFIGURE);
      expect(component.configureForm.getRawValue()).toEqual({
        name: 'Plan',
        caseDefinitionKey: 'plan',
      });
    });

    it('applies the same file only once', () => {
      component.open = true;
      component.presetFile = createFile();

      component.ngOnChanges({open: {currentValue: true} as any});
      component.ngOnChanges({open: {currentValue: true} as any});

      expect(caseManagementService.previewImport).toHaveBeenCalledTimes(1);
    });

    it('does not apply while closed', () => {
      component.presetFile = createFile();

      component.ngOnChanges({presetFile: {currentValue: component.presetFile} as any});

      expect(caseManagementService.previewImport).not.toHaveBeenCalled();
    });

    it('disables back on the configure step', async () => {
      component.open = true;
      component.presetFile = createFile();
      component.ngOnChanges({open: {currentValue: true} as any});

      expect(await firstValueFrom(component.backButtonEnabled$)).toBeFalse();

      component.activeStep$.next(UPLOAD_STEP.PLUGINS);

      expect(await firstValueFrom(component.backButtonEnabled$)).toBeTrue();
    });

    it('stays on the file select step when the preview fails', () => {
      caseManagementService.previewImport.and.returnValue(throwError(() => new Error('invalid')));
      component.open = true;
      component.presetFile = createFile();

      component.ngOnChanges({open: {currentValue: true} as any});

      expect(component.activeStep$.value).toBe(UPLOAD_STEP.FILE_SELECT);
      const [fileItem] = component.form.get('file').value as Set<FileItem>;
      expect(fileItem.invalid).toBeTrue();
    });
  });

  describe('without a preset file', () => {
    beforeEach(setup);

    it('does not preview on open', () => {
      component.open = true;

      component.ngOnChanges({open: {currentValue: true} as any});

      expect(caseManagementService.previewImport).not.toHaveBeenCalled();
      expect(component.activeStep$.value).toBe(UPLOAD_STEP.FILE_SELECT);
    });

    it('stays on the file select step after a manual selection', async () => {
      select(createFile());

      expect(caseManagementService.previewImport).toHaveBeenCalledTimes(1);
      expect(component.activeStep$.value).toBe(UPLOAD_STEP.FILE_SELECT);
      expect(await firstValueFrom(component.backButtonEnabled$)).toBeFalse();

      component.activeStep$.next(UPLOAD_STEP.CONFIGURE);

      expect(await firstValueFrom(component.backButtonEnabled$)).toBeTrue();
    });
  });
});
