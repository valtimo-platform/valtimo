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
import {
  TaskListSearchField,
  TaskListSearchFieldDataType,
  TaskListSearchFieldFieldType,
  TaskListSearchFieldMatchType,
} from '@valtimo/task';
import {of} from 'rxjs';
import {TaskManagementSearchFieldsModalComponent} from './task-management-search-fields-modal.component';

describe('TaskManagementSearchFieldsModalComponent', () => {
  let component: TaskManagementSearchFieldsModalComponent;
  let emitted: Array<Partial<TaskListSearchField> | null>;

  beforeEach(() => {
    component = new TaskManagementSearchFieldsModalComponent(
      {} as any,
      {registerAll: () => {}} as any,
      new FormBuilder(),
      {stream: () => of(''), instant: (key: string) => key} as any
    );
    component.ngOnInit();

    component.form.patchValue({
      key: 'firstName',
      path: 'doc:/firstName',
      dataType: {content: 'text', id: TaskListSearchFieldDataType.TEXT, selected: true},
      matchType: {content: 'like', id: TaskListSearchFieldMatchType.LIKE, selected: true},
      fieldType: {content: 'single', id: TaskListSearchFieldFieldType.SINGLE, selected: true},
    });

    emitted = [];
    component.closeEvent.subscribe(searchField => emitted.push(searchField));
  });

  it('can be saved without a title', () => {
    expect(component.form.valid).toBeTrue();

    component.onSave();

    expect(emitted).toEqual([jasmine.objectContaining({key: 'firstName', path: 'doc:/firstName'})]);
    expect(emitted[0]?.title).toBeUndefined();
  });

  it('keeps the title when one is filled in', () => {
    component.form.patchValue({title: 'First name'});

    component.onSave();

    expect(emitted[0]?.title).toBe('First name');
  });
});
