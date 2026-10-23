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
import {FileItem} from 'carbon-components-angular';
import {of, throwError} from 'rxjs';
import {CaseDefinitionGroupImportModalComponent} from './case-definition-group-import-modal.component';

describe('CaseDefinitionGroupImportModalComponent', () => {
  let component: CaseDefinitionGroupImportModalComponent;
  let groupService: jasmine.SpyObj<any>;
  let notificationService: jasmine.SpyObj<any>;

  const selectFile = (): void => {
    const file = new File(['zip'], 'my-group.case-group.zip', {type: 'application/zip'});
    component.form.get('file')?.setValue(new Set([{file} as FileItem]));
  };

  beforeEach(() => {
    groupService = jasmine.createSpyObj('CaseDefinitionGroupManagementService', ['importGroup']);
    groupService.importGroup.and.returnValue(of(undefined));
    notificationService = jasmine.createSpyObj('GlobalNotificationService', ['showNotification']);
    component = new CaseDefinitionGroupImportModalComponent(
      new FormBuilder(),
      groupService,
      jasmine.createSpyObj('IconService', ['register']),
      notificationService,
      jasmine.createSpyObj('TranslateService', {instant: 'translated'})
    );
    component.ngOnInit();
  });

  afterEach(() => component.ngOnDestroy());

  it('tracks whether a file is selected', () => {
    expect(component.$hasFile()).toBeFalse();

    selectFile();

    expect(component.$hasFile()).toBeTrue();
  });

  it('does not import before the overwrite is confirmed', () => {
    selectFile();

    component.onImport();

    expect(groupService.importGroup).not.toHaveBeenCalled();
    expect(component.$showConfirmError()).toBeTrue();
  });

  it('clears the confirm error once confirmed', () => {
    selectFile();
    component.onImport();

    component.form.get('overwriteConfirmed')?.setValue(true);

    expect(component.$showConfirmError()).toBeFalse();
  });

  it('uploads the file as multipart form data and emits imported', () => {
    const closed: boolean[] = [];
    component.closeEvent.subscribe(value => closed.push(value));
    selectFile();
    component.form.get('overwriteConfirmed')?.setValue(true);

    component.onImport();

    const formData: FormData = groupService.importGroup.calls.mostRecent().args[0];
    expect((formData.get('file') as File).name).toBe('my-group.case-group.zip');
    expect(notificationService.showNotification).toHaveBeenCalled();
    expect(closed).toEqual([true]);
  });

  it('shows an error and keeps the modal open when the import fails', () => {
    const closed: boolean[] = [];
    component.closeEvent.subscribe(value => closed.push(value));
    groupService.importGroup.and.returnValue(throwError(() => new Error('400')));
    selectFile();
    component.form.get('overwriteConfirmed')?.setValue(true);

    component.onImport();

    expect(component.$importError()).toBeTrue();
    expect(component.$importing()).toBeFalse();
    expect(closed).toEqual([]);
  });

  it('emits not imported when cancelled', () => {
    const closed: boolean[] = [];
    component.closeEvent.subscribe(value => closed.push(value));

    component.onCloseModal();

    expect(closed).toEqual([false]);
  });
});
