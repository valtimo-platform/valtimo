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
    `;
    document.head.appendChild(style);
  }
}

const ExpressionAutocompleteModule = {
  __init__: ['expressionAutocomplete'],
  expressionAutocomplete: ['type', ExpressionAutocomplete],
};

export {ExpressionAutocompleteModule, ExpressionAutocomplete};
