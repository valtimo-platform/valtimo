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

import {ProcessBeanDto, ProcessBeanMethodDto} from '../../../models';

interface AutocompleteSuggestion {
  label: string;
  insertText: string;
  detail?: string;
  documentation?: string;
  isHint?: boolean; // True for parameter hints (non-selectable, HTML in documentation)
}

interface ParsedExpression {
  beanName: string | null;
  methodName: string | null;
  parameters: string[];
}

class ExpressionAutocomplete {
  static $inject = ['eventBus'];

  private processBeans: ProcessBeanDto[] = [];
  private activeInput: HTMLInputElement | HTMLTextAreaElement | null = null;
  private dropdown: HTMLDivElement | null = null;
  private suggestions: AutocompleteSuggestion[] = [];
  private selectedIndex = 0;
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
    // Only attach to expression and delegate expression fields
    const type = input.type?.toLowerCase();
    if (input.tagName !== 'TEXTAREA' && !(input.tagName === 'INPUT' && (!type || type === 'text'))) {
      return false;
    }

    // Exclude inputs inside simple mode editor (our own dropdowns/params)
    if (input.closest('.expression-editor-simple')) {
      return false;
    }

    // Check input name/id for expression-related patterns
    const name = (input.name || input.id || '').toLowerCase();

    // Exclude result variable fields
    if (name.includes('resultvariable') || name.includes('result-variable')) {
      return false;
    }

    if (name.includes('expression') || name.includes('delegateexpression')) {
      return true;
    }

    // Check parent entry container for expression-related data attributes or classes
    const entry = input.closest('.bio-properties-panel-entry');
    if (entry) {
      const entryId = (entry.getAttribute('data-entry-id') || '').toLowerCase();

      // Exclude result variable entries
      if (entryId.includes('resultvariable') || entryId.includes('result-variable')) {
        return false;
      }

      if (entryId.includes('expression')) {
        return true;
      }
    }

    // Check associated label text
    const label = input.closest('.bio-properties-panel-entry')?.querySelector('label');
    if (label) {
      const labelText = label.textContent?.toLowerCase() || '';

      // Exclude result variable fields
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
    // Wrap with editor UI (toggle between technical/simple modes)
    this.wrapWithEditor(input);

    // Attach autocomplete to original input (works in technical mode)
    input.addEventListener('input', () => this.onInput(input));
    input.addEventListener('keydown', (e: KeyboardEvent) => this.onKeyDown(e, input));
    input.addEventListener('blur', () => setTimeout(() => this.hideDropdown(), 150));
    input.addEventListener('focus', () => this.onInput(input));
  }

  private onInput(input: HTMLInputElement | HTMLTextAreaElement): void {
    this.activeInput = input;
    const value = input.value;
    const cursorPos = input.selectionStart || 0;

    // Get the text before cursor
    const textBeforeCursor = value.substring(0, cursorPos);

    // Check if we're inside an expression context
    const suggestions = this.getSuggestions(textBeforeCursor);

    if (suggestions.length > 0) {
      this.suggestions = suggestions;
      this.selectedIndex = 0;
      this.showDropdown(input);
    } else {
      this.hideDropdown();
    }
  }

  private getSuggestions(textBeforeCursor: string): AutocompleteSuggestion[] {
    // Find the last ${ to determine context
    const lastExprStart = textBeforeCursor.lastIndexOf('${');
    if (lastExprStart === -1) return [];

    // Check if expression is closed
    const afterExprStart = textBeforeCursor.substring(lastExprStart);
    if (afterExprStart.includes('}')) return [];

    // Get the expression content (after ${)
    const exprContent = afterExprStart.substring(2);

    // Check if we're after a dot (method or parameter completion)
    const dotIndex = exprContent.lastIndexOf('.');
    if (dotIndex !== -1) {
      const afterDot = exprContent.substring(dotIndex + 1);
      const openParenIndex = afterDot.indexOf('(');

      // Check if we're inside method parentheses (parameter hint)
      if (openParenIndex !== -1) {
        const beanName = exprContent.substring(0, dotIndex).trim();
        const methodName = afterDot.substring(0, openParenIndex).trim();
        const insideParens = afterDot.substring(openParenIndex + 1);

        // Count commas to determine parameter index (simple approach)
        const paramIndex = this.countCommas(insideParens);

        return this.getParameterHint(beanName, methodName, paramIndex);
      }

      // Method name completion
      const beanName = exprContent.substring(0, dotIndex).trim();
      const methodPrefix = afterDot.toLowerCase();
      return this.getMethodSuggestions(beanName, methodPrefix);
    }

    // Bean name completion
    const beanPrefix = exprContent.toLowerCase();
    return this.getBeanSuggestions(beanPrefix);
  }

  private countCommas(text: string): number {
    // Simple comma counting - doesn't handle nested parentheses or strings perfectly
    // but good enough for most cases
    let count = 0;
    let depth = 0;
    for (const char of text) {
      if (char === '(' || char === '[' || char === '{') {
        depth++;
      } else if (char === ')' || char === ']' || char === '}') {
        depth--;
      } else if (char === ',' && depth === 0) {
        count++;
      }
    }
    return count;
  }

  private getParameterHint(beanName: string, methodName: string, paramIndex: number): AutocompleteSuggestion[] {
    const bean = this.processBeans.find(b => b.name === beanName);
    if (!bean) return [];

    const method = bean.methods.find(m => m.name === methodName);
    if (!method || method.parameters.length === 0) return [];

    // Clamp parameter index to valid range
    const safeIndex = Math.min(paramIndex, method.parameters.length - 1);
    const currentParam = method.parameters[safeIndex];

    // Build signature with current parameter highlighted using HTML
    const signatureParts = method.parameters.map((p, i) => {
      const paramStr = `${p.name}: ${p.type}`;
      return i === safeIndex ? `<strong>${paramStr}</strong>` : paramStr;
    });

    return [{
      label: `Parameter ${safeIndex + 1}/${method.parameters.length}: ${currentParam.name}`,
      insertText: '', // No insertion for parameter hints
      detail: currentParam.type,
      documentation: `${method.name}(${signatureParts.join(', ')})`,
      isHint: true, // Flag to indicate this is a hint, not a suggestion
    }];
  }

  private getBeanSuggestions(prefix: string): AutocompleteSuggestion[] {
    return this.processBeans
      .filter(bean => bean.name.toLowerCase().startsWith(prefix))
      .slice(0, 10)
      .map(bean => ({
        label: bean.name,
        insertText: `${bean.name}.`,
        detail: bean.description || undefined,
      }));
  }

  private getMethodSuggestions(beanName: string, methodPrefix: string): AutocompleteSuggestion[] {
    const bean = this.processBeans.find(b => b.name === beanName);
    if (!bean) return [];

    return bean.methods
      .filter(method => method.name.toLowerCase().startsWith(methodPrefix))
      .slice(0, 15)
      .map(method => ({
        label: method.name,
        insertText: this.buildMethodInsertText(method),
        detail: method.description || `-> ${method.returnType}`,
        documentation: method.example || undefined,
      }));
  }

  private buildMethodInsertText(method: ProcessBeanMethodDto): string {
    return `${method.name}()}`;
  }

  private onKeyDown(e: KeyboardEvent, input: HTMLInputElement | HTMLTextAreaElement): void {
    if (!this.dropdown || this.suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.suggestions.length - 1);
        this.updateDropdownSelection();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.updateDropdownSelection();
        break;
      case 'Enter':
      case 'Tab':
        if (this.suggestions.length > 0) {
          e.preventDefault();
          this.applySuggestion(input, this.suggestions[this.selectedIndex]);
        }
        break;
      case 'Escape':
        this.hideDropdown();
        break;
    }
  }

  private applySuggestion(
    input: HTMLInputElement | HTMLTextAreaElement,
    suggestion: AutocompleteSuggestion
  ): void {
    // Parameter hints have empty insertText - just hide the dropdown
    if (!suggestion.insertText) {
      this.hideDropdown();
      return;
    }

    const value = input.value;
    const cursorPos = input.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);

    // Find what to replace
    const lastExprStart = textBeforeCursor.lastIndexOf('${');
    const afterExprStart = textBeforeCursor.substring(lastExprStart + 2);
    const dotIndex = afterExprStart.lastIndexOf('.');

    let replaceStart: number;
    let replaceEnd: number = cursorPos;

    if (dotIndex !== -1) {
      // Replace method name - also remove any existing arguments/parentheses
      replaceStart = lastExprStart + 2 + dotIndex + 1;

      // Look for existing method call to replace (find closing paren and optional })
      const afterReplaceStart = value.substring(replaceStart);
      const parenMatch = afterReplaceStart.match(/^[a-zA-Z_][a-zA-Z0-9_]*\([^)]*\)\}?/);
      if (parenMatch) {
        replaceEnd = replaceStart + parenMatch[0].length;
      }
    } else {
      // Replace bean name - also remove any existing method call
      replaceStart = lastExprStart + 2;

      // Look for existing bean.method(args)} pattern to replace entirely
      const afterReplaceStart = value.substring(replaceStart);
      const beanMethodMatch = afterReplaceStart.match(/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*\([^)]*\)\}?)?/);
      if (beanMethodMatch) {
        replaceEnd = replaceStart + beanMethodMatch[0].length;
      }
    }

    const beforeReplace = value.substring(0, replaceStart);
    const afterReplace = value.substring(replaceEnd);

    input.value = beforeReplace + suggestion.insertText + afterReplace;

    // Position cursor - if method insertion (ends with ()}), place cursor inside parens
    const isMethodInsertion = suggestion.insertText.endsWith('()}');
    let newCursorPos = replaceStart + suggestion.insertText.length;
    if (isMethodInsertion) {
      newCursorPos -= 2; // Position before the closing paren
    }
    input.setSelectionRange(newCursorPos, newCursorPos);

    // Trigger input event so bpmn-js picks up the change
    input.dispatchEvent(new Event('input', {bubbles: true}));

    // Show follow-up suggestions: parameter hints after method, method list after bean
    const isBeanInsertion = suggestion.insertText.endsWith('.');
    if (isMethodInsertion || isBeanInsertion) {
      setTimeout(() => this.onInput(input), 0);
    } else {
      this.hideDropdown();
    }
  }

  private showDropdown(input: HTMLInputElement | HTMLTextAreaElement): void {
    if (!this.dropdown) {
      this.dropdown = document.createElement('div');
      this.dropdown.className = 'expression-autocomplete-dropdown';
      document.body.appendChild(this.dropdown);
    }

    // Position dropdown below input
    const rect = input.getBoundingClientRect();
    this.dropdown.style.position = 'fixed';
    this.dropdown.style.left = `${rect.left}px`;
    this.dropdown.style.top = `${rect.bottom + 2}px`;
    this.dropdown.style.width = `${Math.max(rect.width, 300)}px`;
    this.dropdown.style.display = 'block';

    this.renderDropdown();
  }

  private hideDropdown(): void {
    if (this.dropdown) {
      this.dropdown.style.display = 'none';
    }
    this.suggestions = [];
    this.activeInput = null;
  }

  private renderDropdown(): void {
    if (!this.dropdown) return;

    this.dropdown.innerHTML = this.suggestions
      .map(
        (suggestion, index) => {
          const isHint = suggestion.isHint;
          const itemClass = `expression-autocomplete-item${index === this.selectedIndex ? ' selected' : ''}${isHint ? ' hint' : ''}`;
          // For hints, don't escape the documentation (it contains HTML for highlighting)
          const docHtml = suggestion.documentation
            ? (isHint ? suggestion.documentation : this.escapeHtml(suggestion.documentation))
            : '';

          return `
            <div class="${itemClass}" data-index="${index}">
              <div class="expression-autocomplete-item__label">${this.escapeHtml(suggestion.label)}</div>
              ${suggestion.detail ? `<div class="expression-autocomplete-item__detail">${this.escapeHtml(suggestion.detail)}</div>` : ''}
              ${docHtml ? `<div class="expression-autocomplete-item__doc">${docHtml}</div>` : ''}
            </div>
          `;
        }
      )
      .join('');

    // Add click handlers
    this.dropdown.querySelectorAll('.expression-autocomplete-item').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        const index = parseInt((item as HTMLElement).dataset.index || '0', 10);
        if (this.activeInput) {
          this.applySuggestion(this.activeInput, this.suggestions[index]);
        }
      });
    });
  }

  private updateDropdownSelection(): void {
    if (!this.dropdown) return;

    this.dropdown.querySelectorAll('.expression-autocomplete-item').forEach((item, index) => {
      item.classList.toggle('selected', index === this.selectedIndex);
    });

    // Scroll selected item into view
    const selectedItem = this.dropdown.querySelector('.expression-autocomplete-item.selected');
    selectedItem?.scrollIntoView({block: 'nearest'});
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

  // --- Expression Editor (Technical/Simple toggle) ---

  private wrapWithEditor(input: HTMLInputElement | HTMLTextAreaElement): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'expression-editor-wrapper';

    // Determine initial mode: dropdown if expression parses or is empty, manual otherwise
    const parsed = this.parseExpression(input.value);
    const canUseDropdown = !input.value || (parsed.beanName !== null && parsed.methodName !== null);
    const initialMode = canUseDropdown ? 'simple' : 'technical';
    wrapper.dataset.mode = initialMode;

    // Insert wrapper before input, move input inside
    input.parentNode?.insertBefore(wrapper, input);

    // Toggle buttons
    const toggle = document.createElement('div');
    toggle.className = 'expression-editor-toggle';
    toggle.innerHTML = `
      <button type="button" class="expression-editor-toggle__btn${initialMode === 'simple' ? ' active' : ''}" data-mode="simple">Dropdown</button>
      <button type="button" class="expression-editor-toggle__btn${initialMode === 'technical' ? ' active' : ''}" data-mode="technical">Manual</button>
    `;

    // Technical container (original input)
    const technicalContainer = document.createElement('div');
    technicalContainer.className = 'expression-editor-technical';
    technicalContainer.appendChild(input);
    technicalContainer.style.display = initialMode === 'technical' ? 'block' : 'none';

    // Simple container
    const simpleContainer = document.createElement('div');
    simpleContainer.className = 'expression-editor-simple';
    simpleContainer.style.display = initialMode === 'simple' ? 'block' : 'none';

    wrapper.appendChild(toggle);
    wrapper.appendChild(technicalContainer);
    wrapper.appendChild(simpleContainer);

    // Wire toggle clicks
    toggle.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        this.setEditorMode(wrapper, input, (btn as HTMLButtonElement).dataset.mode || 'technical');
      });
    });

    // Render simple mode if it's the initial mode
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

    // Update toggle buttons
    wrapper.querySelectorAll('.expression-editor-toggle__btn').forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLButtonElement).dataset.mode === mode);
    });

    const technicalContainer = wrapper.querySelector('.expression-editor-technical') as HTMLElement;
    const simpleContainer = wrapper.querySelector('.expression-editor-simple') as HTMLElement;

    if (mode === 'simple') {
      technicalContainer.style.display = 'none';
      simpleContainer.style.display = 'block';
      this.renderSimpleMode(simpleContainer, input);
    } else {
      technicalContainer.style.display = 'block';
      simpleContainer.style.display = 'none';
      // Prevent input from getting focus when switching to manual
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

    // Render bean custom select
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

    // Render method dropdown if bean selected
    if (parsed.beanName) {
      this.renderMethodDropdown(container, parsed.beanName, parsed.methodName, input);
    }

    // Render params if method selected
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

    // Native select for appearance (shows native arrow)
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

    // Custom dropdown overlay for descriptions
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

    // Intercept native select to show custom dropdown instead
    nativeSelect.addEventListener('mousedown', e => {
      e.preventDefault();
      nativeSelect.focus();
      const isOpen = dropdown.style.display !== 'none';
      dropdown.style.display = isOpen ? 'none' : 'block';
    });

    // Keyboard navigation
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

    // Close on outside click
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

    // Wire change handlers
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

  private injectStyles(): void {
    if (this.stylesInjected) return;
    this.stylesInjected = true;

    const style = document.createElement('style');
    style.textContent = `
      .expression-autocomplete-dropdown {
        z-index: 10000;
        max-height: 300px;
        overflow-y: auto;
        background-color: var(--cds-layer, #ffffff);
        border: 1px solid var(--cds-border-subtle, #e0e0e0);
        border-radius: 4px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
      }
      .expression-autocomplete-item {
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid var(--cds-border-subtle, #e0e0e0);
      }
      .expression-autocomplete-item:last-child {
        border-bottom: none;
      }
      .expression-autocomplete-item:hover,
      .expression-autocomplete-item.selected {
        background-color: var(--cds-layer-hover, #e8e8e8);
      }
      .expression-autocomplete-item__label {
        font-weight: 600;
        font-size: 13px;
        color: var(--cds-text-primary, #161616);
      }
      .expression-autocomplete-item__detail {
        font-size: 12px;
        color: var(--cds-text-secondary, #525252);
        font-family: monospace;
        margin-top: 2px;
      }
      .expression-autocomplete-item__doc {
        font-size: 11px;
        color: var(--cds-text-helper, #6f6f6f);
        margin-top: 4px;
        font-style: italic;
      }
      .expression-autocomplete-item.hint {
        background-color: var(--cds-layer-accent, #e0e0e0);
        cursor: default;
      }
      .expression-autocomplete-item.hint:hover {
        background-color: var(--cds-layer-accent, #e0e0e0);
      }
      .expression-autocomplete-item.hint .expression-autocomplete-item__doc {
        font-family: monospace;
        font-style: normal;
        font-size: 12px;
      }
      .expression-autocomplete-item.hint .expression-autocomplete-item__doc strong {
        color: var(--cds-text-primary, #161616);
        background-color: var(--cds-highlight, #d0e2ff);
        padding: 1px 4px;
        border-radius: 2px;
      }

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
