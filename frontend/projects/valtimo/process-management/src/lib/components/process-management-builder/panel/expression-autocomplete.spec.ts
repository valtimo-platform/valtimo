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

import {ExpressionAutocomplete} from './expression-autocomplete';

describe('ExpressionAutocomplete', () => {
  let handlers: Record<string, (event: any) => void>;
  let autocomplete: ExpressionAutocomplete;
  let panel: HTMLElement;

  const selectElement = (id: string): void =>
    handlers['selection.changed']?.({newSelection: [{id}]});

  const renderExpressionEntry = (value: string): HTMLElement => {
    panel.innerHTML = `
      <div class="bio-properties-panel-entry" data-entry-id="expression">
        <input type="text" name="expression">
      </div>
    `;
    (panel.querySelector('input') as HTMLInputElement).value = value;
    (autocomplete as any).scanAndAttach();
    return panel.querySelector('.expression-editor-wrapper') as HTMLElement;
  };

  const clickToggle = (wrapper: HTMLElement, mode: 'simple' | 'technical'): void =>
    (
      wrapper.querySelector(`.expression-editor-toggle__btn[data-mode="${mode}"]`) as HTMLElement
    ).click();

  beforeEach(() => {
    handlers = {};
    const eventBus = {
      on: (event: string, handler: (e: any) => void) => (handlers[event] = handler),
    };
    autocomplete = new ExpressionAutocomplete(eventBus);
    autocomplete.setProcessBeans([
      {
        name: 'caseService',
        className: 'CaseService',
        description: null,
        methods: [
          {
            name: 'getCase',
            description: null,
            example: null,
            returnType: 'Case',
            parameters: [{name: 'id', type: 'String'}],
          },
        ],
      },
    ]);
    panel = document.createElement('div');
    (autocomplete as any).panelContainer = panel;
  });

  it('GH-937 should open a chained expression in manual mode', () => {
    selectElement('ServiceTask_1');

    const wrapper = renderExpressionEntry("${caseService.getCase('1').getName()}");

    expect(wrapper.dataset['mode']).toBe('technical');
  });

  it('GH-937 should keep manual mode after the properties panel re-renders', () => {
    selectElement('ServiceTask_1');
    const wrapper = renderExpressionEntry("${caseService.getCase('1')}");
    clickToggle(wrapper, 'technical');

    const rerenderedWrapper = renderExpressionEntry("${caseService.getCase('1')}");

    expect(rerenderedWrapper.dataset['mode']).toBe('technical');
  });

  it('should not carry manual mode over to another element', () => {
    selectElement('ServiceTask_1');
    clickToggle(renderExpressionEntry("${caseService.getCase('1')}"), 'technical');

    selectElement('ServiceTask_2');
    const wrapper = renderExpressionEntry("${caseService.getCase('2')}");

    expect(wrapper.dataset['mode']).toBe('simple');
  });

  it('should return to dropdown mode after switching back from manual', () => {
    selectElement('ServiceTask_1');
    const wrapper = renderExpressionEntry("${caseService.getCase('1')}");
    clickToggle(wrapper, 'technical');
    clickToggle(wrapper, 'simple');

    const rerenderedWrapper = renderExpressionEntry("${caseService.getCase('1')}");

    expect(rerenderedWrapper.dataset['mode']).toBe('simple');
  });
});
