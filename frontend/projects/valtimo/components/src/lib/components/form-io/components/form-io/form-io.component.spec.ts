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

import {ComponentFixture, fakeAsync, TestBed, tick, waitForAsync} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {ActivatedRoute} from '@angular/router';
import {FormioComponent as FormIoSourceComponent, FormioModule} from '@formio/angular';
import {TranslateService} from '@ngx-translate/core';
import {UserProviderService} from '@valtimo/security';
import {ConfigService} from '@valtimo/shared';
import {Components} from 'formiojs';
import {NGXLogger} from 'ngx-logger';
import {of} from 'rxjs';
import {take} from 'rxjs/operators';
import {ValtimoModalService} from '../../../../services';
import {FormIoLocalStorageService} from '../../services';
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
      imports: [FormioModule],
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

  const emitted = (observable: any): any => {
    let value: any;
    observable.pipe(take(1)).subscribe((emittedValue: any) => (value = emittedValue));
    return value;
  };

  // form.io only ever sees what <formio> chooses to forward, so the assertions below go through
  // the real wrapper instead of reading the component's own observables.
  const rendererOptions = (): any => {
    const wrapper = TestBed.createComponent(FormIoSourceComponent).componentInstance;
    wrapper.options = emitted(component.formioOptions$);
    wrapper.renderOptions = emitted(component.renderOptions$);
    return wrapper.getRendererOptions();
  };

  describe('the options form.io actually receives', () => {
    it("should carry the user's language", () => {
      expect(rendererOptions().language).toBe('nl');
    });

    it('should carry the language the user switched to', () => {
      translateServiceStub.currentLang = 'en';

      expect(rendererOptions().language).toBe('en');
    });

    it("should carry the Valtimo translations under the user's language", () => {
      expect(rendererOptions().i18n).toEqual({
        nl: {
          Submit: 'Versturen',
          'formioIbanComponent.errorMessage': 'Geen geldige IBAN.',
        },
      });
    });

    // A language without a bundle leaves i18next on a locale it has no strings for, and every
    // form.io label falls back to its raw key.
    it('should never set a language without a bundle for it', () => {
      const options = rendererOptions();

      expect(Object.keys(options.i18n)).toContain(options.language);
    });
  });

  describe('the language reaching the rendered <formio> element', () => {
    it('should be bound in the template, not only exposed by the component', fakeAsync(() => {
      fixture.debugElement.injector.get(FormIoLocalStorageService).setTokenInLocalStorage('token');
      component.form = {components: []};
      tick(1);
      fixture.detectChanges();

      const formio = fixture.debugElement.query(By.directive(FormIoSourceComponent));

      expect(formio).withContext('<formio> did not render').toBeTruthy();
      expect(formio.componentInstance.renderOptions).toEqual({language: 'nl'});
    }));
  });

  describe('a number field built from those options', () => {
    const buildNumberComponent = (): any =>
      new (Components.components as any).number(
        {type: 'number', key: 'amount', delimiter: true},
        rendererOptions(),
        {}
      );

    it('should use Dutch separators for a Dutch user', () => {
      const numberComponent = buildNumberComponent();

      expect(numberComponent.decimalSeparator).toBe(',');
      expect(numberComponent.delimiter).toBe('.');
    });

    it('should use English separators for an English user', () => {
      translateServiceStub.currentLang = 'en';

      const numberComponent = buildNumberComponent();

      expect(numberComponent.decimalSeparator).toBe('.');
      expect(numberComponent.delimiter).toBe(',');
    });
  });
});
