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

import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {ReactiveFormsModule} from '@angular/forms';
import {FormIoCurrencyComponent} from './currency.component';

describe('FormIoCurrencyComponent', () => {
  let component: FormIoCurrencyComponent;
  let fixture: ComponentFixture<FormIoCurrencyComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [FormIoCurrencyComponent],
      imports: [ReactiveFormsModule],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FormIoCurrencyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  // The formatter separates the symbol with a non-breaking space, which is not what these assert on.
  const renderedValue = (): string =>
    (component.currencyForm.value.currencyValue ?? '').replace(/\s/g, ' ');

  const emittedValues = (): Array<number> => {
    const values: Array<number> = [];
    component.valueChange.subscribe(value => values.push(value));
    return values;
  };

  const applyInputs = (value?: number): void => {
    fixture.componentRef.setInput('currencyLocale', 'nl-NL');
    fixture.componentRef.setInput('currencyCurrency', 'EUR');

    if (value !== undefined) {
      fixture.componentRef.setInput('value', value);
    }

    fixture.detectChanges();
  };

  describe('a default value rendered once the currency inputs arrive', () => {
    it('should render a whole amount in full', () => {
      applyInputs(100);

      expect(renderedValue()).toBe('€ 100,00');
    });

    it('should render a small whole amount in full', () => {
      applyInputs(10);

      expect(renderedValue()).toBe('€ 10,00');
    });

    it('should render an amount that already has decimals unchanged', () => {
      applyInputs(1234.56);

      expect(renderedValue()).toBe('€ 1.234,56');
    });

    it('should not write the rendered amount back to the model', () => {
      const values = emittedValues();

      applyInputs(100);

      expect(values).toEqual([]);
    });

    it('should render an empty input when there is no value', () => {
      applyInputs();

      expect(renderedValue()).toBe('');
    });
  });

  describe('a default value rendered by the value input alone', () => {
    it('should render a whole amount in full', () => {
      fixture.componentRef.setInput('value', 100);

      expect(renderedValue()).toBe('€ 100,00');
    });
  });

  describe('an amount typed by the user', () => {
    const inputElement = (): HTMLInputElement => component.currencyElement.nativeElement;

    const type = (text: string): void => {
      inputElement().value = text;
      inputElement().setSelectionRange(text.length, text.length);
      inputElement().dispatchEvent(new Event('input'));
    };

    const focus = (): void => {
      inputElement().dispatchEvent(new Event('focus'));
    };

    const blur = (): void => {
      inputElement().dispatchEvent(new Event('blur'));
    };

    const shownText = (): string => inputElement().value.replace(/\s/g, ' ');

    const lastEmitted = (values: Array<number>): number => values[values.length - 1];

    const applyLocale = (locale: string, currency: string, allowEmptyValue = false): void => {
      fixture.componentRef.setInput('currencyLocale', locale);
      fixture.componentRef.setInput('currencyCurrency', currency);
      fixture.componentRef.setInput('allowEmptyValue', allowEmptyValue);
      fixture.detectChanges();
    };

    beforeEach(() => applyLocale('nl-NL', 'EUR'));

    it('should take typed digits as whole euros', () => {
      const values = emittedValues();

      focus();
      type('51');

      expect(lastEmitted(values)).toBe(51);
    });

    it('should start the cents at the decimal separator', () => {
      const values = emittedValues();

      focus();
      type('51,2');

      expect(lastEmitted(values)).toBe(51.2);
    });

    it('should show the amount formatted once the field loses focus', () => {
      focus();
      type('51');
      blur();

      expect(shownText()).toBe('€ 51,00');
    });

    it('should format a larger amount with grouping and two decimals on blur', () => {
      focus();
      type('1234,5');
      blur();

      expect(shownText()).toBe('€ 1.234,50');
    });

    it('should keep the typed text as typed while the field has focus', () => {
      focus();
      type('5');
      type('51');
      type('512');

      expect(shownText()).toBe('512');
    });

    it('should accept a negative amount', () => {
      const values = emittedValues();

      focus();
      type('-51,5');
      blur();

      expect(lastEmitted(values)).toBe(-51.5);
      expect(shownText()).toBe('€ -51,50');
    });

    it('should drop characters that are not part of an amount', () => {
      const values = emittedValues();

      focus();
      type('5a1-,2,34');

      expect(shownText()).toBe('51,23');
      expect(lastEmitted(values)).toBe(51.23);
    });

    it('should only accept a minus sign as the first character', () => {
      const values = emittedValues();

      focus();
      type('5-1');

      expect(shownText()).toBe('51');
      expect(lastEmitted(values)).toBe(51);
    });

    it('should respect the separators of an en-US locale', () => {
      applyLocale('en-US', 'USD');
      const values = emittedValues();

      focus();
      type('1,234.5');
      blur();

      expect(lastEmitted(values)).toBe(1234.5);
      expect(shownText()).toBe('$1,234.50');
    });

    it('should turn a formatted amount into plain editable text on focus', () => {
      fixture.componentRef.setInput('value', 1234.5);

      focus();

      expect(shownText()).toBe('1234,50');
    });

    it('should show an empty field on focus when the value is zero', () => {
      fixture.componentRef.setInput('value', 0);

      focus();

      expect(shownText()).toBe('');
    });

    it('should not emit when the field is focused and left without typing', () => {
      fixture.componentRef.setInput('value', 1234.5);
      const values = emittedValues();

      focus();
      blur();

      expect(values).toEqual([]);
      expect(shownText()).toBe('€ 1.234,50');
    });

    it('should extend the euros when typing after a focused stored amount', () => {
      fixture.componentRef.setInput('value', 51);
      const values = emittedValues();

      focus();
      type(inputElement().value + '2');

      expect(lastEmitted(values)).toBe(512);
    });

    it('should emit zero for a cleared field when empty values are not allowed', () => {
      const values = emittedValues();

      focus();
      type('5');
      type('');

      expect(lastEmitted(values)).toBe(0);
    });

    it('should emit null for a cleared field when empty values are allowed', () => {
      applyLocale('nl-NL', 'EUR', true);
      const values = emittedValues();

      focus();
      type('5');
      type('');

      expect(lastEmitted(values)).toBeNull();
    });

    it('should leave the typed text alone when the same value is set while focused', () => {
      focus();
      type('51,');

      fixture.componentRef.setInput('value', 51);

      expect(shownText()).toBe('51,');
    });

    it('should show a different value set while focused as plain editable text', () => {
      focus();
      type('51');

      fixture.componentRef.setInput('value', 60.5);

      expect(shownText()).toBe('60,50');
    });

    it('should show a value set while focused formatted after blur', () => {
      focus();
      type('51');
      fixture.componentRef.setInput('value', 60.5);

      blur();

      expect(shownText()).toBe('€ 60,50');
    });
  });

  // Angular elements applies the inputs it cached while the element was unconnected and only then
  // runs the first change detection, so ngOnChanges lands before ngAfterViewInit created the mask.
  describe('a default value that arrives before the view exists', () => {
    let earlyFixture: ComponentFixture<FormIoCurrencyComponent>;

    beforeEach(() => {
      earlyFixture = TestBed.createComponent(FormIoCurrencyComponent);
      earlyFixture.componentRef.setInput('currencyLocale', 'nl-NL');
      earlyFixture.componentRef.setInput('currencyCurrency', 'EUR');
      earlyFixture.componentRef.setInput('allowEmptyValue', false);
      earlyFixture.componentRef.setInput('value', 100);
    });

    afterEach(() => {
      earlyFixture.componentInstance.ngOnDestroy();
    });

    it('should render the amount in full', () => {
      earlyFixture.detectChanges();

      expect(
        (earlyFixture.componentInstance.currencyForm.value.currencyValue ?? '').replace(/\s/g, ' ')
      ).toBe('€ 100,00');
    });

    it('should not write anything back to the model', () => {
      const values: Array<number> = [];
      earlyFixture.componentInstance.valueChange.subscribe(value => values.push(value));

      earlyFixture.detectChanges();

      expect(values).toEqual([]);
    });
  });
});
