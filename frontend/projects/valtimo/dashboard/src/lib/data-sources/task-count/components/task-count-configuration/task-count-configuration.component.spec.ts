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

  function createComponent(): TaskCountConfigurationComponent {
    return TestBed.runInInjectionContext(
      () =>
        new TaskCountConfigurationComponent(
          documentServiceMock as any,
          translateServiceMock as any,
          widgetTranslationServiceMock as any
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

  it('emits the configuration on init', () => {
    const component = createComponent();
    const output = captureOutput(component);

    component.ngOnInit();

    expect(output.current).toEqual({
      valid: true,
      data: {caseDefinitionName: undefined, conditions: []},
    });
  });

  it('prefills the root group from the conditions of the stored configuration', () => {
    const component = createComponent();
    const output = captureOutput(component);

    component.prefillConfiguration = {
      caseDefinitionName: 'leerlingzaken',
      conditions: [
        {
          or: [
            {path: 'task:name', operator: '==', value: 'A'},
            {path: 'task:name', operator: '==', value: 'B'},
          ],
        },
      ],
    };
    component.ngOnInit();

    expect(component.$rootGroup().operator).toBe('or');
    expect(output.current?.data).toEqual({
      caseDefinitionName: 'leerlingzaken',
      conditions: [
        {
          or: [
            {path: 'task:name', operator: '==', value: 'A'},
            {path: 'task:name', operator: '==', value: 'B'},
          ],
        },
      ],
    });
  });

  it('falls back to the legacy queryConditions key when prefilling', () => {
    const component = createComponent();

    component.prefillConfiguration = {
      queryConditions: [{queryPath: 'task:assignee', queryOperator: '==', queryValue: 'x'}],
    };

    expect(component.$rootGroup().rows).toEqual([
      {key: 'task:assignee', dropdown: '==', value: 'x'},
    ]);
  });

  it('ignores an absent prefill configuration', () => {
    const component = createComponent();

    component.prefillConfiguration = undefined as any;

    expect(component.$rootGroup()).toEqual({
      operator: 'and',
      rows: [],
      groups: [],
      unsupportedNodes: [],
    });
  });

  it('reports whether the tree still holds unsupported conditions after every change', () => {
    const component = createComponent();
    const inLeaf = {path: 'task:name', operator: 'in', value: ['A', 'B']};

    component.prefillConfiguration = {conditions: [{or: [inLeaf]}]};
    component.ngOnInit();

    expect(component.$hasUnsupportedConditions()).toBe(true);

    // The child component mutates the group tree in place, so the flag has to be recomputed on
    // change rather than derived once.
    component.$rootGroup().unsupportedNodes = [];
    component.conditionsChange();

    expect(component.$hasUnsupportedConditions()).toBe(false);
  });

  it('reports the validity of the condition rows', () => {
    const component = createComponent();
    const output = captureOutput(component);

    component.$rootGroup().rows = [{key: 'task:name', dropdown: '', value: ''}];
    component.conditionsChange();

    expect(output.current?.valid).toBe(false);
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
