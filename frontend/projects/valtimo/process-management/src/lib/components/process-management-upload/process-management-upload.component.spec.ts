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
import {ProcessDefinitionImportPreview} from '../../models';
import {ProcessManagementUploadComponent} from './process-management-upload.component';

describe('ProcessManagementUploadComponent', () => {
  let component: ProcessManagementUploadComponent;
  let processManagementService: jasmine.SpyObj<any>;
  let processManagementStateService: jasmine.SpyObj<any>;
  let notificationService: jasmine.SpyObj<any>;

  const PREVIEW_WITH_PLUGINS: ProcessDefinitionImportPreview = {
    processDefinitionKeys: ['my-process'],
    existingProcessDefinitionKeys: [],
    pluginConfigurations: [
      {
        pluginConfigurationId: '5474fe57-532a-4050-8d89-32e62ca3e895',
        pluginDefinitionKey: 'documentenapi',
        pluginActionDefinitionKey: 'store-uploaded-document',
        processDefinitionKey: 'my-process',
        activityId: 'upload-document',
        existsInTargetEnvironment: true,
      },
    ],
    missingReferences: [],
    canImport: true,
  };

  const zipFile = () => new File(['zip'], 'my-process.process.zip', {type: 'application/zip'});

  const selectFile = (file: File) => component.form.get('file')?.setValue(new Set([{file}] as any));

  beforeEach(() => {
    processManagementService = jasmine.createSpyObj(
      'ProcessManagementService',
      ['previewProcessDefinitionImport', 'importProcessDefinition'],
      {$context: () => 'independent'}
    );
    processManagementStateService = jasmine.createSpyObj(
      'ProcessManagementStateService',
      ['closeModal', 'reloadDefinitions'],
      {openModal$: of(true)}
    );
    notificationService = jasmine.createSpyObj('GlobalNotificationService', ['showNotification']);

    component = new ProcessManagementUploadComponent(
      new FormBuilder(),
      notificationService,
      processManagementService,
      processManagementStateService,
      jasmine.createSpyObj('ProcessLinkService', ['createProcessDefinition']),
      {
        instant: (key: string, params?: Record<string, string>) =>
          params ? `${key} ${Object.values(params).join(', ')}` : key,
      } as any,
      {markForCheck: () => {}} as any
    );
  });

  it('should show the review step when the package contains plugin configurations', () => {
    processManagementService.previewProcessDefinitionImport.and.returnValue(
      of(PREVIEW_WITH_PLUGINS)
    );
    selectFile(zipFile());

    component.uploadProcessBpmn();

    expect(component.activeStep$.value).toBe('review' as any);
    expect(processManagementService.importProcessDefinition).not.toHaveBeenCalled();
  });

  /**
   * Leaving the file select step destroys cds-file-uploader, which empties the form control. The
   * import must still use the file that was selected.
   */
  it('should import the selected file after the file uploader emptied the form control', () => {
    processManagementService.previewProcessDefinitionImport.and.returnValue(
      of(PREVIEW_WITH_PLUGINS)
    );
    processManagementService.importProcessDefinition.and.returnValue(
      of({processDefinitionKeys: ['my-process'], missingReferences: []})
    );
    const file = zipFile();
    selectFile(file);
    component.uploadProcessBpmn();

    // The file uploader clears the control when it is destroyed
    component.form.get('file')?.setValue(new Set());

    component.importProcessPackage();

    expect(processManagementService.importProcessDefinition).toHaveBeenCalled();
    const formData = processManagementService.importProcessDefinition.calls.mostRecent()
      .args[0] as FormData;
    expect((formData.get('file') as File).name).toBe('my-process.process.zip');
  });

  it('should import straight away when there is nothing to review', () => {
    processManagementService.previewProcessDefinitionImport.and.returnValue(
      of({
        processDefinitionKeys: ['my-process'],
        existingProcessDefinitionKeys: [],
        pluginConfigurations: [],
        missingReferences: [],
        canImport: true,
      })
    );
    processManagementService.importProcessDefinition.and.returnValue(
      of({processDefinitionKeys: ['my-process'], missingReferences: []})
    );
    selectFile(zipFile());

    component.uploadProcessBpmn();

    expect(processManagementService.importProcessDefinition).toHaveBeenCalled();
    expect(processManagementStateService.reloadDefinitions).toHaveBeenCalled();
  });

  it('should ask to replace when the process of the package already exists', () => {
    processManagementService.previewProcessDefinitionImport.and.returnValue(
      of({...PREVIEW_WITH_PLUGINS, existingProcessDefinitionKeys: ['my-process']})
    );
    processManagementService.importProcessDefinition.and.returnValue(
      of({processDefinitionKeys: ['my-process'], missingReferences: []})
    );
    selectFile(zipFile());
    component.uploadProcessBpmn();

    component.importProcessPackage();

    expect(component.showReplaceConfirmationModal$.value).toBeTrue();
    expect(component.replaceModalContent).toContain('my-process');
    expect(processManagementService.importProcessDefinition).not.toHaveBeenCalled();
  });

  it('should import the package once replacing is confirmed', () => {
    processManagementService.previewProcessDefinitionImport.and.returnValue(
      of({...PREVIEW_WITH_PLUGINS, existingProcessDefinitionKeys: ['my-process']})
    );
    processManagementService.importProcessDefinition.and.returnValue(
      of({processDefinitionKeys: ['my-process'], missingReferences: []})
    );
    selectFile(zipFile());
    component.uploadProcessBpmn();
    component.importProcessPackage();

    component.confirmReplace();

    expect(processManagementService.importProcessDefinition).toHaveBeenCalled();
  });

  it('should not import the package when replacing is not confirmed', () => {
    processManagementService.previewProcessDefinitionImport.and.returnValue(
      of({...PREVIEW_WITH_PLUGINS, existingProcessDefinitionKeys: ['my-process']})
    );
    selectFile(zipFile());
    component.uploadProcessBpmn();
    component.importProcessPackage();

    component.clearReplaceModal();

    expect(processManagementService.importProcessDefinition).not.toHaveBeenCalled();
    expect(component.activeStep$.value).toBe('review' as any);
  });

  it('should show the summary when the import reports missing references', () => {
    processManagementService.previewProcessDefinitionImport.and.returnValue(
      of(PREVIEW_WITH_PLUGINS)
    );
    processManagementService.importProcessDefinition.and.returnValue(
      of({
        processDefinitionKeys: ['my-process'],
        missingReferences: [
          {
            type: 'SUB_PROCESS',
            reference: 'other-process',
            activityId: 'CallActivity_1',
            processDefinitionKey: 'my-process',
            blocksImport: false,
          },
        ],
      })
    );
    selectFile(zipFile());
    component.uploadProcessBpmn();

    component.importProcessPackage();

    expect(component.activeStep$.value).toBe('summary' as any);
    expect(processManagementStateService.closeModal).not.toHaveBeenCalled();
  });

  it('should deploy a bpmn file through the existing deployment flow', () => {
    const processLinkService = jasmine.createSpyObj('ProcessLinkService', [
      'createProcessDefinition',
    ]);
    processLinkService.createProcessDefinition.and.returnValue(of({}));
    component = new ProcessManagementUploadComponent(
      new FormBuilder(),
      notificationService,
      processManagementService,
      processManagementStateService,
      processLinkService,
      {
        instant: (key: string, params?: Record<string, string>) =>
          params ? `${key} ${Object.values(params).join(', ')}` : key,
      } as any,
      {markForCheck: () => {}} as any
    );
    selectFile(new File(['<bpmn/>'], 'my-process.bpmn', {type: 'text/xml'}));

    component.uploadProcessBpmn();

    expect(processManagementService.previewProcessDefinitionImport).not.toHaveBeenCalled();
  });

  it('should group missing references by type', () => {
    const groups = component.getMissingReferenceGroups([
      {
        type: 'FORM',
        reference: 'form-a',
        activityId: null,
        processDefinitionKey: null,
        blocksImport: true,
      },
      {
        type: 'FORM',
        reference: 'form-b',
        activityId: null,
        processDefinitionKey: null,
        blocksImport: true,
      },
      {
        type: 'SUB_PROCESS',
        reference: 'sub-a',
        activityId: null,
        processDefinitionKey: null,
        blocksImport: false,
      },
    ]);

    expect(groups).toEqual([
      {type: 'FORM', references: ['form-a', 'form-b']},
      {type: 'SUB_PROCESS', references: ['sub-a']},
    ]);
  });
});
