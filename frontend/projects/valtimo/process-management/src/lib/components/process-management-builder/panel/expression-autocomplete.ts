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

import {ProcessBeanDto} from '../../../models';

interface ParsedExpression {
  beanName: string | null;
  methodName: string | null;
  parameters: string[];
}

class ExpressionAutocomplete {
  static $inject = ['eventBus'];

  private processBeans: ProcessBeanDto[] = [];
  private panelContainer: HTMLElement | null = null;
  private stylesInjected = false;
  private observer: MutationObserver | null = null;

  constructor(eventBus: any) {
    this.injectStyles();
  }

  public setProcessBeans(beans: ProcessBeanDto[]): void {
    this.processBeans = beans;
  }

  public setPanelContainer(container: HTMLElement): void {
    this.panelContainer = container;
    this.startObserving();
    setTimeout(() => this.scanAndAttach(), 100);
  }

  private startObserving(): void {
    if (!this.panelContainer || this.observer) return;

    this.observer = new MutationObserver(() => {
      this.scanAndAttach();
    });

    this.observer.observe(this.panelContainer, {
      childList: true,
      subtree: true,
    });
  }

  private scanAndAttach(): void {
    if (!this.panelContainer) return;

    const allInputs = this.panelContainer.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input, textarea'
    );

    allInputs.forEach(input => {
      if (input.dataset.autocompleteAttached) return;
      if (this.isExpressionField(input)) {
        this.attachAutocomplete(input);
        input.dataset.autocompleteAttached = 'true';
      }
    });
  }

  private isExpressionField(input: HTMLInputElement | HTMLTextAreaElement): boolean {
    const type = input.type?.toLowerCase();
    if (input.tagName !== 'TEXTAREA' && !(input.tagName === 'INPUT' && (!type || type === 'text'))) {
      return false;
    }

    if (input.closest('.expression-editor-simple')) {
      return false;
    }

    const name = (input.name || input.id || '').toLowerCase();

    if (name.includes('resultvariable') || name.includes('result-variable')) {
      return false;
    }

    if (name.includes('expression') || name.includes('delegateexpression')) {
      return true;
    }

    const entry = input.closest('.bio-properties-panel-entry');
    if (entry) {
      const entryId = (entry.getAttribute('data-entry-id') || '').toLowerCase();

      if (entryId.includes('resultvariable') || entryId.includes('result-variable')) {
        return false;
      }

      if (entryId.includes('expression')) {
        return true;
      }
    }

    const label = input.closest('.bio-properties-panel-entry')?.querySelector('label');
    if (label) {
      const labelText = label.textContent?.toLowerCase() || '';

      if (labelText.includes('result variable') || labelText.includes('resultvariable')) {
        return false;
      }

      if (labelText.includes('expression') || labelText.includes('delegate')) {
        return true;
      }
    }

    return false;
  }

  private attachAutocomplete(input: HTMLInputElement | HTMLTextAreaElement): void {
    this.wrapWithEditor(input);
  }

  // --- Expression Editor (Dropdown/Manual toggle) ---

  private wrapWithEditor(input: HTMLInputElement | HTMLTextAreaElement): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'expression-editor-wrapper';

    const parsed = this.parseExpression(input.value);
    const canUseDropdown = !input.value || (parsed.beanName !== null && parsed.methodName !== null);
    const initialMode = canUseDropdown ? 'simple' : 'technical';
    wrapper.dataset.mode = initialMode;

    input.parentNode?.insertBefore(wrapper, input);

    const toggle = document.createElement('div');
    toggle.className = 'expression-editor-toggle';
    toggle.innerHTML = `
      <button type="button" class="expression-editor-toggle__btn${initialMode === 'simple' ? ' active' : ''}" data-mode="simple">Dropdown</button>
      <button type="button" class="expression-editor-toggle__btn${initialMode === 'technical' ? ' active' : ''}" data-mode="technical">Manual</button>
    `;

    const technicalContainer = document.createElement('div');
    technicalContainer.className = 'expression-editor-technical';
    technicalContainer.appendChild(input);
    technicalContainer.style.display = initialMode === 'technical' ? 'block' : 'none';

    const simpleContainer = document.createElement('div');
    simpleContainer.className = 'expression-editor-simple';
    simpleContainer.style.display = initialMode === 'simple' ? 'block' : 'none';

    wrapper.appendChild(toggle);
    wrapper.appendChild(technicalContainer);
    wrapper.appendChild(simpleContainer);

    toggle.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        this.setEditorMode(wrapper, input, (btn as HTMLButtonElement).dataset.mode || 'technical');
      });
    });

    if (initialMode === 'simple') {
      this.renderSimpleMode(simpleContainer, input);
    }
  }

  private setEditorMode(
    wrapper: HTMLElement,
    input: HTMLInputElement | HTMLTextAreaElement,
    mode: string
  ): void {
    wrapper.dataset.mode = mode;

    wrapper.querySelectorAll('.expression-editor-toggle__btn').forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLButtonElement).dataset.mode === mode);
    });

    const technicalContainer = wrapper.querySelector('.expression-editor-technical') as HTMLElement;
    const simpleContainer = wrapper.querySelector('.expression-editor-simple') as HTMLElement;

    const invalidArgsStr = wrapper.dataset.invalidArgs;
    const invalidArgs: number[] = invalidArgsStr ? JSON.parse(invalidArgsStr) : [];

    if (mode === 'simple') {
      technicalContainer.style.display = 'none';
      simpleContainer.style.display = 'block';
      input.classList.remove('validation-error-param');
      this.renderSimpleMode(simpleContainer, input);
      if (invalidArgs.length > 0) {
        setTimeout(() => {
          for (const idx of invalidArgs) {
            const paramInput = simpleContainer.querySelector(
              `.expression-editor-param input[data-param-index="${idx}"]`
            );
            if (paramInput) {
              paramInput.classList.add('validation-error-param');
            }
          }
        }, 0);
      }
    } else {
      technicalContainer.style.display = 'block';
      simpleContainer.style.display = 'none';
      if (invalidArgs.length > 0) {
        input.classList.add('validation-error-param');
      }
      setTimeout(() => input.blur(), 0);
    }
  }

  private renderSimpleMode(container: HTMLElement, input: HTMLInputElement | HTMLTextAreaElement): void {
    const parsed = this.parseExpression(input.value);

    container.innerHTML = `
      <div class="expression-editor-field" data-container="bean">
        <label>Service</label>
      </div>
      <div class="expression-editor-field" data-container="method"></div>
      <div data-container="params"></div>
    `;

    const beanContainer = container.querySelector('[data-container="bean"]') as HTMLElement;
    this.renderCustomSelect(
      beanContainer,
      this.processBeans.map(b => ({
        value: b.name,
        label: this.camelCaseToReadable(b.name),
        description: b.description,
      })),
      parsed.beanName,
      'Select service...',
      'bean',
      beanName => {
        this.renderMethodDropdown(container, beanName, null, input);
        this.renderParameterInputs(container, beanName, null, [], input);
        this.buildAndSetExpression(container, input);
      }
    );

    if (parsed.beanName) {
      this.renderMethodDropdown(container, parsed.beanName, parsed.methodName, input);
    }

    if (parsed.beanName && parsed.methodName) {
      this.renderParameterInputs(container, parsed.beanName, parsed.methodName, parsed.parameters, input);
    }
  }

  private renderCustomSelect(
    container: HTMLElement,
    options: {value: string; label: string; description?: string | null}[],
    selectedValue: string | null,
    placeholder: string,
    dataField: string,
    onChange: (value: string) => void
  ): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'expression-editor-custom-select';
    wrapper.dataset.field = dataField;
    wrapper.dataset.value = selectedValue || '';

    const nativeSelect = document.createElement('select');
    nativeSelect.className = 'bio-properties-panel-input';
    nativeSelect.innerHTML =
      `<option value="" disabled ${!selectedValue ? 'selected' : ''}>${this.escapeHtml(placeholder)}</option>` +
      options
        .map(
          opt =>
            `<option value="${this.escapeAttr(opt.value)}" ${opt.value === selectedValue ? 'selected' : ''}>${this.escapeHtml(opt.label)}</option>`
        )
        .join('');

    const selectedOption = options.find(o => o.value === selectedValue);
    if (selectedOption?.description) {
      nativeSelect.title = selectedOption.description;
    }

    const dropdown = document.createElement('div');
    dropdown.className = 'expression-editor-custom-select__dropdown';
    dropdown.style.display = 'none';

    let selectedIndex = options.findIndex(o => o.value === selectedValue);
    if (selectedIndex < 0) selectedIndex = 0;

    const renderItems = () => {
      dropdown.innerHTML = options
        .map(
          (opt, i) => `
        <div class="expression-editor-custom-select__item${opt.value === selectedValue ? ' selected' : ''}" data-index="${i}" data-value="${this.escapeAttr(opt.value)}">
          <div class="expression-editor-custom-select__label">${this.escapeHtml(opt.label)}</div>
          ${opt.description ? `<div class="expression-editor-custom-select__desc">${this.escapeHtml(opt.description)}</div>` : ''}
        </div>
      `
        )
        .join('');

      dropdown.querySelectorAll('.expression-editor-custom-select__item').forEach(item => {
        item.addEventListener('click', e => {
          e.stopPropagation();
          const value = (item as HTMLElement).dataset.value!;
          const selected = options.find(o => o.value === value);
          wrapper.dataset.value = value;
          nativeSelect.value = value;
          nativeSelect.title = selected?.description || '';
          dropdown.style.display = 'none';
          onChange(value);
        });
      });
    };

    renderItems();

    nativeSelect.addEventListener('mousedown', e => {
      e.preventDefault();
      nativeSelect.focus();
      const isOpen = dropdown.style.display !== 'none';
      dropdown.style.display = isOpen ? 'none' : 'block';
    });

    nativeSelect.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (dropdown.style.display === 'none') {
          dropdown.style.display = 'block';
        }
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        selectedIndex = Math.max(0, Math.min(options.length - 1, selectedIndex + delta));
        dropdown.querySelectorAll('.expression-editor-custom-select__item').forEach((item, i) => {
          item.classList.toggle('highlighted', i === selectedIndex);
        });
        dropdown.children[selectedIndex]?.scrollIntoView({block: 'nearest'});
      } else if (e.key === 'Enter' && dropdown.style.display !== 'none') {
        e.preventDefault();
        const opt = options[selectedIndex];
        if (opt) {
          wrapper.dataset.value = opt.value;
          nativeSelect.value = opt.value;
          nativeSelect.title = opt.description || '';
          dropdown.style.display = 'none';
          onChange(opt.value);
        }
      } else if (e.key === 'Escape') {
        dropdown.style.display = 'none';
      } else if (e.key === ' ' && dropdown.style.display === 'none') {
        e.preventDefault();
        dropdown.style.display = 'block';
      }
    });

    const closeHandler = (e: MouseEvent) => {
      if (!wrapper.contains(e.target as Node)) {
        dropdown.style.display = 'none';
      }
    };
    document.addEventListener('click', closeHandler);

    wrapper.appendChild(nativeSelect);
    wrapper.appendChild(dropdown);
    container.appendChild(wrapper);
  }

  private renderMethodDropdown(
    container: HTMLElement,
    beanName: string,
    selectedMethod: string | null,
    input: HTMLInputElement | HTMLTextAreaElement
  ): void {
    const methodContainer = container.querySelector('[data-container="method"]') as HTMLElement;
    if (!methodContainer) return;

    const bean = this.processBeans.find(b => b.name === beanName);
    if (!bean) {
      methodContainer.innerHTML = '';
      return;
    }

    methodContainer.innerHTML = '<label>Method</label>';

    this.renderCustomSelect(
      methodContainer,
      bean.methods.map(m => ({
        value: m.name,
        label: this.camelCaseToReadable(m.name),
        description: m.description,
      })),
      selectedMethod,
      'Select method...',
      'method',
      methodName => {
        this.renderParameterInputs(container, beanName, methodName, [], input);
        this.buildAndSetExpression(container, input);
      }
    );
  }

  private renderParameterInputs(
    container: HTMLElement,
    beanName: string,
    methodName: string | null,
    values: string[],
    input: HTMLInputElement | HTMLTextAreaElement
  ): void {
    const paramsContainer = container.querySelector('[data-container="params"]');
    if (!paramsContainer) return;

    if (!methodName) {
      paramsContainer.innerHTML = '';
      return;
    }

    const bean = this.processBeans.find(b => b.name === beanName);
    const method = bean?.methods.find(m => m.name === methodName);

    if (!method || method.parameters.length === 0) {
      paramsContainer.innerHTML = '';
      return;
    }

    paramsContainer.innerHTML = method.parameters
      .map(
        (p, i) => `
      <div class="expression-editor-param">
        <label>${this.escapeHtml(p.name)} <span class="type">(${this.escapeHtml(p.type)})</span></label>
        <input type="text" class="expression-editor-input" data-param-index="${i}" value="${this.escapeAttr(values[i] || '')}">
      </div>
    `
      )
      .join('');

    paramsContainer.querySelectorAll('input').forEach(paramInput => {
      paramInput.addEventListener('input', () => {
        this.buildAndSetExpression(container, input);
      });
    });
  }

  private buildAndSetExpression(
    simpleContainer: HTMLElement,
    input: HTMLInputElement | HTMLTextAreaElement
  ): void {
    const beanSelect = simpleContainer.querySelector('[data-field="bean"]') as HTMLElement;
    const methodSelect = simpleContainer.querySelector('[data-field="method"]') as HTMLElement;
    const paramInputs = simpleContainer.querySelectorAll(
      '[data-param-index]'
    ) as NodeListOf<HTMLInputElement>;

    const bean = beanSelect?.dataset.value;
    const method = methodSelect?.dataset.value;

    if (!bean || !method) {
      input.value = '';
      input.dispatchEvent(new Event('input', {bubbles: true}));
      return;
    }

    const params = Array.from(paramInputs).map(i => i.value);
    input.value = `\${${bean}.${method}(${params.join(', ')})}`;
    input.dispatchEvent(new Event('input', {bubbles: true}));
  }

  private parseExpression(expr: string): ParsedExpression {
    const match = expr.match(/^\$\{([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)\((.*)\)\}$/);
    if (!match) return {beanName: null, methodName: null, parameters: []};
    return {
      beanName: match[1],
      methodName: match[2],
      parameters: this.parseParameters(match[3]),
    };
  }

  private parseParameters(paramsStr: string): string[] {
    const params: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (const char of paramsStr) {
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
        current += char;
      } else if (inString && char === stringChar) {
        inString = false;
        current += char;
      } else if (!inString && (char === '(' || char === '[')) {
        depth++;
        current += char;
      } else if (!inString && (char === ')' || char === ']')) {
        depth--;
        current += char;
      } else if (!inString && char === ',' && depth === 0) {
        params.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) params.push(current.trim());
    return params;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private escapeAttr(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private camelCaseToReadable(text: string): string {
    return text
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, str => str.toUpperCase());
  }

  private injectStyles(): void {
    if (this.stylesInjected) return;
    this.stylesInjected = true;

    const style = document.createElement('style');
    style.textContent = `
      /* Expression Editor Toggle UI */
      .expression-editor-wrapper {
        width: 100%;
      }
      .expression-editor-toggle {
        display: flex;
        gap: 0;
        margin-bottom: 8px;
      }
      .expression-editor-toggle__btn {
        flex: 1;
        padding: 4px 8px;
        border: 1px solid #ccc;
        background: #fafafa;
        color: #333;
        cursor: pointer;
        font-size: 13px;
        font-family: inherit;
      }
      .expression-editor-toggle__btn:first-child {
        border-radius: 2px 0 0 2px;
      }
      .expression-editor-toggle__btn:last-child {
        border-radius: 0 2px 2px 0;
        border-left: none;
      }
      .expression-editor-toggle__btn.active {
        background: #2b79bd;
        color: white;
        border-color: #2b79bd;
      }
      .expression-editor-toggle__btn:hover:not(.active) {
        background: #fff;
      }
      .expression-editor-simple {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .expression-editor-field label,
      .expression-editor-param > label {
        display: block;
        font-size: var(--text-size-small, 12px);
        color: var(--label-color, #666);
        margin-bottom: 2px;
      }
      .expression-editor-field label .type,
      .expression-editor-param label .type {
        color: var(--description-color, #808080);
      }
      .expression-editor-select,
      .expression-editor-input {
        display: block;
        width: 100%;
        padding: 3px 6px 2px;
        border: 1px solid #ccc;
        border-radius: 2px;
        font-size: 14px;
        background-color: #fafafa;
        font-family: inherit;
        box-sizing: border-box;
      }
      .expression-editor-select:focus,
      .expression-editor-input:focus {
        outline: none;
        background-color: hsl(205, 100%, 95%);
        border-color: hsl(205, 100%, 50%);
      }
      /* Override bpmn-js input styles to prevent focus-within highlighting */
      .expression-editor-technical input,
      .expression-editor-technical textarea {
        background-color: #fafafa !important;
        border-color: #ccc !important;
      }
      /* Override native select and input styles in simple mode */
      .expression-editor-simple select.bio-properties-panel-input,
      .expression-editor-simple .expression-editor-input {
        background-color: #fafafa !important;
        border-color: #ccc !important;
      }
      .expression-editor-simple select.bio-properties-panel-input:focus,
      .expression-editor-simple .expression-editor-input:focus {
        background-color: hsl(205, 100%, 95%) !important;
        border-color: hsl(205, 100%, 50%) !important;
      }
      .expression-editor-technical input:focus,
      .expression-editor-technical textarea:focus {
        background-color: hsl(205, 100%, 95%) !important;
        border-color: hsl(205, 100%, 50%) !important;
      }
      .expression-editor-param {
        padding-left: 8px;
        border-left: 2px solid #ccc;
        margin-top: 4px;
      }
      .expression-editor-description {
        font-size: var(--text-size-small, 12px);
        color: var(--description-color, #808080);
        margin-top: 4px;
        font-style: italic;
      }

      /* Custom Select (Listbox) */
      .expression-editor-custom-select {
        position: relative;
        width: 100%;
      }
      .expression-editor-custom-select select {
        width: 100%;
      }
      .expression-editor-custom-select__dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        max-height: 200px;
        overflow-y: auto;
        background: #fff;
        border: 1px solid #ccc;
        border-radius: 2px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        z-index: 1000;
        margin-top: 2px;
      }
      .expression-editor-custom-select__item {
        padding: 8px;
        cursor: pointer;
        border-bottom: 1px solid #eee;
      }
      .expression-editor-custom-select__item:last-child {
        border-bottom: none;
      }
      .expression-editor-custom-select__item:hover,
      .expression-editor-custom-select__item.selected,
      .expression-editor-custom-select__item.highlighted {
        background: hsl(205, 100%, 95%);
      }
      .expression-editor-custom-select__label {
        font-weight: 500;
        font-size: 14px;
        color: #333;
      }
      .expression-editor-custom-select__desc {
        font-size: 11px;
        color: #666;
        margin-top: 2px;
      }
    `;
    document.head.appendChild(style);
  }
}

const ExpressionAutocompleteModule = {
  __init__: ['expressionAutocomplete'],
  expressionAutocomplete: ['type', ExpressionAutocomplete],
};

export {ExpressionAutocompleteModule, ExpressionAutocomplete};
