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

  // Stands in for a user edit: a raw value change that does not come from rendering an input.
  const enterValue = (value: number | null): void => {
    (component as any)._autoNumeric.set(value);
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

      enterValue(null);

      expect(values).toEqual([null]);
      expect(renderedValue()).toBe('');
    });
  });
});
