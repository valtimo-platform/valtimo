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
import {ActivatedRoute} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {UserProviderService} from '@valtimo/security';
import {ConfigService} from '@valtimo/shared';
import {Components} from 'formiojs';
import {NGXLogger} from 'ngx-logger';
import {of} from 'rxjs';
import {take} from 'rxjs/operators';
import {ValtimoModalService} from '../../../../services';
import {FormioComponent} from './form-io.component';

describe('FormioComponent', () => {
  let component: FormioComponent;
  let fixture: ComponentFixture<FormioComponent>;

  const FORMIO_TRANSLATIONS = {
    Submit: 'Versturen',
    formioIbanComponent: {errorMessage: 'Geen geldige IBAN.'},
  };

  const translateServiceStub = {
    currentLang: 'nl',
    stream: () => of('key'),
    instant: (key: string) => (key === 'formioTranslations' ? FORMIO_TRANSLATIONS : key),
    onLangChange: of({}),
  };

  const configServiceStub = {
    config: {},
    getFeatureToggle: () => false,
  };

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [FormioComponent],
      providers: [
        {provide: TranslateService, useValue: translateServiceStub},
        {provide: ConfigService, useValue: configServiceStub},
        {provide: UserProviderService, useValue: {getToken: () => new Promise(() => {})}},
        {provide: NGXLogger, useValue: {debug: () => {}}},
        {provide: ValtimoModalService, useValue: {scrollToTop: () => {}}},
        {provide: ActivatedRoute, useValue: {params: of({})}},
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    translateServiceStub.currentLang = 'nl';
    fixture = TestBed.createComponent(FormioComponent);
    component = fixture.componentInstance;
  });

  const emittedOptions = (): any => {
    let options: any;
    component.formioOptions$.pipe(take(1)).subscribe(emitted => (options = emitted));
    return options;
  };

  describe('the form.io options handed to the renderer', () => {
    it("should carry the user's language", () => {
      expect(emittedOptions().language).toBe('nl');
    });

    it('should carry the language the user switched to', () => {
      translateServiceStub.currentLang = 'en';

      expect(emittedOptions().language).toBe('en');
    });

    it("should carry the Valtimo translations under the user's language", () => {
      expect(emittedOptions().i18n).toEqual({
        nl: {
          Submit: 'Versturen',
          'formioIbanComponent.errorMessage': 'Geen geldige IBAN.',
        },
      });
    });
  });

  describe('a number field built from those options', () => {
    const buildNumberComponent = (options: any): any =>
      new (Components.components as any).number(
        {type: 'number', key: 'amount', delimiter: true},
        options,
        {}
      );

    it('should use Dutch separators for a Dutch user', () => {
      const numberComponent = buildNumberComponent(emittedOptions());

      expect(numberComponent.decimalSeparator).toBe(',');
      expect(numberComponent.delimiter).toBe('.');
    });

    it('should use English separators for an English user', () => {
      translateServiceStub.currentLang = 'en';

      const numberComponent = buildNumberComponent(emittedOptions());

      expect(numberComponent.decimalSeparator).toBe('.');
      expect(numberComponent.delimiter).toBe(',');
    });
  });
});
