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

import {ReadOnlyPropertiesPanel, ReadOnlyPropertiesProvider} from './read-only-properties-panel';

describe('ReadOnlyPropertiesProvider', () => {
  let propertiesPanel: jasmine.SpyObj<any>;
  let provider: ReadOnlyPropertiesProvider;

  beforeEach(() => {
    propertiesPanel = jasmine.createSpyObj('propertiesPanel', ['registerProvider']);
    provider = new ReadOnlyPropertiesProvider(propertiesPanel);
  });

  it('should register itself after every other properties provider', () => {
    const [priority] = propertiesPanel.registerProvider.calls.mostRecent().args;

    expect(priority).toBeLessThan(500);
  });

  it('should remove the add action of a list group and the delete action of its items', () => {
    const groups = [
      {
        id: 'CamundaPlatform__ExecutionListener',
        add: () => {},
        items: [
          {
            id: 'executionListener-0',
            remove: () => {},
            entries: [{id: 'executionListener-0-eventType'}, {id: 'executionListener-0-class'}],
          },
        ],
      },
    ];

    provider.getGroups()(groups as any[]);

    const group = groups[0] as any;

    expect(group.add).toBeNull();
    expect(group.items[0].remove).toBeNull();
  });

  it('should remove the delete action of a list item nested in an entry', () => {
    const groups = [
      {
        id: 'CamundaPlatform__InputOutput',
        entries: [{id: 'inputParameter-0', items: [{id: 'mapping-0', remove: () => {}}]}],
      },
    ];

    provider.getGroups()(groups as any[]);

    expect((groups[0] as any).entries[0].items[0].remove).toBeNull();
  });

  it('should return the groups it was given', () => {
    const groups = [{id: 'general', entries: []}];

    expect(provider.getGroups()(groups)).toBe(groups);
  });
});

describe('ReadOnlyPropertiesPanel', () => {
  let parent: HTMLElement;

  // The panel marks the controls from a MutationObserver callback, which runs after the render
  const rendered = (html: string): Promise<void> => {
    parent.innerHTML = html;
    return new Promise(resolve => setTimeout(resolve));
  };

  beforeEach(() => {
    parent = document.createElement('div');
    document.body.appendChild(parent);
    new ReadOnlyPropertiesPanel({parent}, {on: () => {}});
  });

  afterEach(() => {
    parent.remove();
  });

  it('should keep a checkbox from being toggled through its label', async () => {
    await rendered(`
      <div class="bio-properties-panel-entry">
        <input id="asynchronousContinuationBefore" type="checkbox" />
        <label for="asynchronousContinuationBefore">Before</label>
      </div>
    `);

    const checkbox = parent.querySelector('input') as HTMLInputElement;

    expect(checkbox.disabled).toBe(true);

    (parent.querySelector('label') as HTMLLabelElement).click();

    expect(checkbox.checked).toBe(false);
  });

  it('should keep a text field from being typed into after tabbing to it', async () => {
    await rendered(`
      <div class="bio-properties-panel-entry">
        <input id="expression" type="text" value="an expression" />
      </div>
    `);

    const input = parent.querySelector('input') as HTMLInputElement;

    // readonly rather than disabled, so the expression can still be selected and copied
    expect(input.readOnly).toBe(true);
    expect(input.disabled).toBe(false);
  });

  it('should make the textarea, select, button and FEEL editor of an entry non-editable', async () => {
    await rendered(`
      <div class="bio-properties-panel-entry">
        <textarea id="documentation"></textarea>
        <select id="implementationType"></select>
        <button class="bio-properties-panel-feel-icon"></button>
        <div class="cm-content" contenteditable="true"></div>
      </div>
    `);

    expect((parent.querySelector('textarea') as HTMLTextAreaElement).readOnly).toBe(true);
    expect((parent.querySelector('select') as HTMLSelectElement).disabled).toBe(true);
    expect((parent.querySelector('button') as HTMLButtonElement).disabled).toBe(true);
    expect(parent.querySelector('.cm-content')?.getAttribute('contenteditable')).toBe('false');
  });

  it('should leave controls outside of an entry alone', async () => {
    await rendered(`
      <div class="bio-properties-panel-group-header">
        <button class="bio-properties-panel-arrow"></button>
      </div>

      <div class="process-link-properties-panel">
        <button class="cds--btn"></button>
      </div>
    `);

    const buttons = [...parent.querySelectorAll('button')];

    expect(buttons.length).toBe(2);
    expect(buttons.every(button => !button.disabled)).toBe(true);
  });
});
