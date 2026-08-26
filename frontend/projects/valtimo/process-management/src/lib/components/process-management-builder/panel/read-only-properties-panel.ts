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

// Runs after every other properties provider, so that all groups they contributed are covered.
const READ_ONLY_PRIORITY = 1;

/**
 * Strips the actions that add or delete list items - listeners, input/output mappings, extension
 * properties and the like. Both sit in a group or list item header, outside of any entry, so they
 * are not covered by the read-only pass over the entries below.
 */
const removeEditActions = (node: any): void => {
  if (!node || typeof node !== 'object') return;

  // Hides the "create new list item" button on a list group
  if (node.add) node.add = null;

  // Hides the "delete item" button on a list item
  if (node.remove) node.remove = null;

  if (Array.isArray(node.entries)) {
    node.entries.forEach((entry: any) => removeEditActions(entry));
  }

  if (Array.isArray(node.items)) {
    node.items.forEach((item: any) => removeEditActions(item));
  }
};

class ReadOnlyPropertiesProvider {
  static $inject = ['propertiesPanel'];

  constructor(propertiesPanel: any) {
    propertiesPanel.registerProvider(READ_ONLY_PRIORITY, this);
  }

  public getGroups(): (groups: any[]) => any[] {
    return (groups: any[]) => {
      groups.forEach(group => removeEditActions(group));
      return groups;
    };
  }
}

const ENTRY = '.bio-properties-panel-entry';

// Input types that support the readonly attribute. The remaining ones - checkboxes above all -
// have to be disabled instead, or they can still be toggled through their label or the keyboard.
const READ_ONLY_INPUT_TYPES = ['email', 'number', 'password', 'search', 'tel', 'text', 'url'];

/**
 * Marks the rendered controls of every entry as non-editable. The providers of
 * bpmn-js-properties-panel do not pass a disabled flag on to their entry components, so there is
 * no way to ask for this while the groups are being built. Text fields are made readonly rather
 * than disabled, so that their value can still be selected and copied.
 */
const makeControlsReadOnly = (container: HTMLElement): void => {
  container.querySelectorAll<HTMLInputElement>(`${ENTRY} input`).forEach(input => {
    if (READ_ONLY_INPUT_TYPES.includes(input.type)) {
      input.readOnly = true;
    } else {
      input.disabled = true;
    }
  });

  container
    .querySelectorAll<HTMLTextAreaElement>(`${ENTRY} textarea`)
    .forEach(textarea => (textarea.readOnly = true));

  container
    .querySelectorAll<HTMLSelectElement | HTMLButtonElement>(`${ENTRY} select, ${ENTRY} button`)
    .forEach(control => (control.disabled = true));

  // FEEL expressions are edited in a contenteditable rather than in a form control
  container
    .querySelectorAll(`${ENTRY} [contenteditable="true"]`)
    .forEach(editor => editor.setAttribute('contenteditable', 'false'));
};

class ReadOnlyPropertiesPanel {
  static $inject = ['config.propertiesPanel', 'eventBus'];

  private _observer: MutationObserver | null = null;

  constructor(config: any, eventBus: any) {
    const parent: HTMLElement | undefined = config?.parent;

    if (!parent) return;

    // The panel is re-rendered on every selection change and whenever a group is opened, so the
    // controls have to be marked again each time they reappear.
    this._observer = new MutationObserver(() => makeControlsReadOnly(parent));
    this._observer.observe(parent, {childList: true, subtree: true});

    eventBus.on('diagram.destroy', () => this._observer?.disconnect());
  }
}

const ReadOnlyPropertiesPanelModule = {
  __init__: ['readOnlyPropertiesProvider', 'readOnlyPropertiesPanel'],
  readOnlyPropertiesProvider: ['type', ReadOnlyPropertiesProvider],
  readOnlyPropertiesPanel: ['type', ReadOnlyPropertiesPanel],
};

export {ReadOnlyPropertiesPanel, ReadOnlyPropertiesPanelModule, ReadOnlyPropertiesProvider};
