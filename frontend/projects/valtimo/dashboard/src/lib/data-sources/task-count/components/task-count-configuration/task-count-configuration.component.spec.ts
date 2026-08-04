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

import {TestBed} from '@angular/core/testing';
import {of} from 'rxjs';
import {TaskCountConfigurationComponent} from './task-count-configuration.component';
import {ConfigurationOutput} from '../../../../models';
import {TaskCountConfiguration} from '../../models';

describe('TaskCountConfigurationComponent', () => {
  const documentServiceMock = {getAllDefinitions: () => of({content: []})};
  const translateServiceMock = {
    stream: () => of(''),
    instant: (key: string) => key,
    currentLang: 'en',
  };
  const widgetTranslationServiceMock = {instant: (key: string) => key, translate: () => of('')};
  const iconServiceMock = {registerAll: () => {}};

  function createComponent(): TaskCountConfigurationComponent {
    return TestBed.runInInjectionContext(
      () =>
        new TaskCountConfigurationComponent(
          documentServiceMock as any,
          translateServiceMock as any,
          widgetTranslationServiceMock as any,
          iconServiceMock as any
        )
    );
  }

  function captureOutput(component: TaskCountConfigurationComponent): {
    current: ConfigurationOutput<TaskCountConfiguration> | undefined;
  } {
    const holder: {current: ConfigurationOutput<TaskCountConfiguration> | undefined} = {
      current: undefined,
    };
    component.configurationEvent.subscribe(output => (holder.current = output));
    return holder;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('prefills a legacy queryConditions config and emits the canonical leaf shape', () => {
    const component = createComponent();
    const output = captureOutput(component);

    component.prefillConfiguration = {
      queryConditions: [{queryPath: 'task:assignee', queryOperator: '==', queryValue: 'x'}],
    } as any;
    component.ngOnInit();

    expect(output.current?.valid).toBe(true);
    expect(output.current?.data.conditions).toEqual([
      {path: 'task:assignee', operator: '==', value: 'x'},
    ]);
  });

  it('prefills a flat leaf plus an or-group', () => {
    const component = createComponent();
    const output = captureOutput(component);

    component.prefillConfiguration = {
      conditions: [
        {path: 'task:assignee', operator: '!=', value: 'x'},
        {
          or: [
            {path: 'task:name', operator: '==', value: 'A'},
            {path: 'task:name', operator: '==', value: 'B'},
          ],
        },
      ],
    } as any;
    component.ngOnInit();

    expect(component.$orGroups().length).toBe(1);
    expect(output.current?.data.conditions).toEqual([
      {path: 'task:assignee', operator: '!=', value: 'x'},
      {
        or: [
          {path: 'task:name', operator: '==', value: 'A'},
          {path: 'task:name', operator: '==', value: 'B'},
        ],
      },
    ]);
  });

  it('preserves passthrough nodes (and-groups, in-arrays) across an edit-save round-trip', () => {
    const component = createComponent();
    const output = captureOutput(component);

    const andGroup = {and: [{path: 'task:name', operator: '==', value: 'A'}]};
    const inLeaf = {path: 'task:name', operator: 'in', value: ['A', 'B']};

    component.prefillConfiguration = {
      conditions: [andGroup, inLeaf, {path: 'task:assignee', operator: '!=', value: 'x'}],
    } as any;
    component.ngOnInit();

    expect(component.$hasUnsupportedConditions()).toBe(true);

    // Simulate an edit in the admin UI (adding an empty or-group).
    component.addOrGroup();

    const conditions = output.current?.data.conditions as any[];
    expect(conditions).toContain(andGroup);
    expect(conditions).toContain(inLeaf);
    expect(conditions).toContain(
      jasmine.objectContaining({path: 'task:assignee', operator: '!=', value: 'x'})
    );
  });

  it('is invalid when a flat row is partially filled', () => {
    const component = createComponent();
    const output = captureOutput(component);

    component.flatConditionsValueChange([{key: 'task:name', dropdown: '', value: ''}]);

    expect(output.current?.valid).toBe(false);
    expect(output.current?.data.conditions).toEqual([]);
  });

  it('excludes an empty or-group from the emitted conditions and stays valid', () => {
    const component = createComponent();
    const output = captureOutput(component);

    component.addOrGroup();

    expect(output.current?.valid).toBe(true);
    expect(output.current?.data.conditions).toEqual([]);
  });

  it('emits the selected case definition name', () => {
    const component = createComponent();
    const output = captureOutput(component);

    component.caseDefinitionSelected({
      item: {content: 'leerlingzaken', caseDefinitionName: 'leerlingzaken'} as any,
    });

    expect(output.current?.data.caseDefinitionName).toBe('leerlingzaken');
  });

  it('emits an undefined case definition name for the "all case types" option', () => {
    const component = createComponent();
    const output = captureOutput(component);

    component.caseDefinitionSelected({
      item: {content: 'All case types', caseDefinitionName: undefined} as any,
    });

    expect(output.current?.data.caseDefinitionName).toBeUndefined();
  });
});
