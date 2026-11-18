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
import {FormIoCurrencyComponent} from './currency.component';

describe('FormIoCurrencyComponent', () => {
  let component: FormIoCurrencyComponent;
  let fixture: ComponentFixture<FormIoCurrencyComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [FormIoCurrencyComponent],
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
  const renderedValueOf = (target: ComponentFixture<FormIoCurrencyComponent>): string =>
    target.componentInstance.currencyElement.nativeElement.value.replace(/\s/g, ' ');

  const renderedValue = (): string => renderedValueOf(fixture);

  // Stands in for a user edit: AutoNumeric updates its raw value while typing and fires a native
  // change event on blur or enter. An empty string stands in for the user clearing the input.
  const enterValue = (value: number | ''): void => {
    (component as any)._autoNumeric.set(value);
    component.currencyElement.nativeElement.dispatchEvent(new Event('change', {bubbles: true}));
  };

  const emittedValues = (): Array<number> => {
    const values: Array<number> = [];
    component.valueChange.subscribe(value => values.push(value));
    return values;
  };

  const applyInputs = (value?: number, locale = 'nl-NL', currency = 'EUR'): void => {
    fixture.componentRef.setInput('currencyLocale', locale);
    fixture.componentRef.setInput('currencyCurrency', currency);

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

    it('should render a currency symbol, when there is no value', () => {
      applyInputs();

      expect(renderedValue()).toBe('€ ');
    });
  });

  describe('a default value rendered by the value input alone', () => {
    it('should render a whole amount in full', () => {
      fixture.componentRef.setInput('value', 100);

      expect(renderedValue()).toBe('€ 100,00');
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

      expect(renderedValueOf(earlyFixture)).toBe('€ 100,00');
    });

    it('should not write anything back to the model', () => {
      const values: Array<number> = [];
      earlyFixture.componentInstance.valueChange.subscribe(value => values.push(value));

      earlyFixture.detectChanges();

      expect(values).toEqual([]);
    });
  });

  describe('the configured locale', () => {
    it('should render an amount the way en-US writes it', () => {
      applyInputs(1234.56, 'en-US', 'USD');

      expect(renderedValue()).toBe('$1,234.56');
    });

    it('should render an amount the way de-DE writes it', () => {
      applyInputs(1234.56, 'de-DE', 'EUR');

      expect(renderedValue()).toBe('1.234,56 €');
    });

    it('should render a negative amount the way nl-NL writes it', () => {
      applyInputs(-1234.56);

      expect(renderedValue()).toBe('€ -1.234,56');
    });

    it('should rerender the amount when the locale changes', () => {
      applyInputs(1234.56);
      applyInputs(undefined, 'en-GB', 'GBP');

      expect(renderedValue()).toBe('£1,234.56');
    });

    it('should not write anything back to the model when the locale changes', () => {
      applyInputs(1234.56);
      const values = emittedValues();

      applyInputs(undefined, 'en-GB', 'GBP');

      expect(values).toEqual([]);
    });
  });

  describe('a value entered by the user', () => {
    it('should be written to the model as a number', () => {
      applyInputs(100);
      const values = emittedValues();

      enterValue(1234.5);

      expect(values).toEqual([1234.5]);
      expect(component.value).toBe(1234.5);
    });

    it('should be written to the model as null when emptied and empty values are allowed', () => {
      fixture.componentRef.setInput('allowEmptyValue', true);
      applyInputs(100);
      const values = emittedValues();

      enterValue('');

      expect(values).toEqual([null]);
      expect(renderedValue()).toBe('€ ');
    });
  });

  // AutoNumeric fires a native input event on every keystroke, before any blur or change.
  describe('a value being typed', () => {
    const typeKeystroke = (rawValue: number, displayed?: string): void => {
      const element = component.currencyElement.nativeElement;
      (component as any)._autoNumeric.set(rawValue);
      if (displayed !== undefined) element.value = displayed;
      element.dispatchEvent(new Event('input', {bubbles: true}));
    };

    it('should write every keystroke to the model before the input loses focus', () => {
      applyInputs();
      const values = emittedValues();

      typeKeystroke(1);
      typeKeystroke(12);
      typeKeystroke(123);

      expect(values).toEqual([1, 12, 123]);
    });

    it('should not reformat the input when the model echoes the typed value back', () => {
      applyInputs();
      typeKeystroke(1234.5, '€ 1.234,5');

      fixture.componentRef.setInput('value', 1234.5);
      fixture.detectChanges();

      expect(renderedValue()).toBe('€ 1.234,5');
    });
  });

  describe('the input attributes the browser uses to offer previous values', () => {
    const input = (): HTMLInputElement => component.currencyElement.nativeElement;

    it('should name the input after the Formio key', () => {
      fixture.componentRef.setInput('key', 'amount');
      fixture.detectChanges();

      expect(input().getAttribute('name')).toBe('data[amount]');
      expect(input().getAttribute('autocomplete')).toBe('on');
    });

    it('should give every instance a unique id, even with the same key', () => {
      const other = TestBed.createComponent(FormIoCurrencyComponent);
      fixture.componentRef.setInput('key', 'amount');
      other.componentRef.setInput('key', 'amount');
      fixture.detectChanges();
      other.detectChanges();

      expect(input().id).toContain('amount');
      expect(input().id).not.toBe(other.componentInstance.currencyElement.nativeElement.id);

      other.componentInstance.ngOnDestroy();
    });
  });

  // Browser autofill writes the value straight to the DOM and only fires native input/change
  // events, without any of the keyboard events AutoNumeric listens to.
  describe('a value filled in by the browser', () => {
    const autofill = (value: string, eventType = 'input'): void => {
      const element = component.currencyElement.nativeElement;
      element.value = value;
      element.dispatchEvent(new Event(eventType, {bubbles: true}));
    };

    it('should write a formatted autofilled amount to the model', () => {
      applyInputs();
      const values = emittedValues();

      autofill('€ 1.234,56');

      expect(values).toEqual([1234.56]);
      expect(component.value).toBe(1234.56);
      expect(renderedValue()).toBe('€ 1.234,56');
    });

    it('should write an unformatted autofilled amount to the model and format it', () => {
      applyInputs(100);
      const values = emittedValues();

      autofill('250');

      expect(values).toEqual([250]);
      expect(renderedValue()).toBe('€ 250,00');
    });

    it('should pick up an amount filled in with only a change event', () => {
      applyInputs();
      const values = emittedValues();

      autofill('€ 42,00', 'change');

      expect(values).toEqual([42]);
    });

    it('should not emit when the input event carries the value AutoNumeric already holds', () => {
      applyInputs(100);
      const values = emittedValues();

      autofill(component.currencyElement.nativeElement.value);

      expect(values).toEqual([]);
    });

    it('should read a dot as the decimal character in a locale that groups with dots', () => {
      applyInputs();
      const values = emittedValues();

      autofill('250.5');

      expect(values).toEqual([250.5]);
      expect(renderedValue()).toBe('€ 250,50');
    });

    it('should still read a dot followed by three digits as a thousands separator', () => {
      applyInputs();
      const values = emittedValues();

      autofill('1.234');

      expect(values).toEqual([1234]);
    });

    it('should read a comma as the decimal character in a locale that groups with commas', () => {
      applyInputs(undefined, 'en-US', 'USD');
      const values = emittedValues();

      autofill('250,5');

      expect(values).toEqual([250.5]);
    });

    it('should restore the current amount when the autofilled text is not a number', () => {
      applyInputs(100);
      const values = emittedValues();

      autofill('abc', 'input');
      autofill('abc', 'change');

      expect(values).toEqual([]);
      expect(renderedValue()).toBe('€ 100,00');
    });

    it('should format an unformatted autofilled amount equal to the current one', () => {
      applyInputs(999.5, 'en-US', 'USD');

      autofill('999.50', 'input');
      autofill('999.50', 'change');

      expect(renderedValue()).toBe('$999.50');
    });
  });
});
