/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {Components} from 'formiojs';
import {distinctUntilChanged, map, tap} from 'rxjs/operators';
import {TranslateService} from '@ngx-translate/core';
import {FormioOptions} from '@formio/angular/formio.common';
import {FormIoStateService} from './services/form-io-state.service';
import {BehaviorSubject, Observable} from 'rxjs';
import {
  addValueResolverSelectorToEditform,
  modiyEditFormApiKeyInput,
} from './form-io-builder.utils';

@Component({
  selector: 'valtimo-form-io-builder',
  templateUrl: './form-io-builder.component.html',
  styleUrls: ['./form-io-builder.component.css'],
})
export class FormioBuilderComponent implements OnInit {
  public readonly form$ = new BehaviorSubject<object | null>(null);

  @Input() public set form(value: object) {
    const currentFormValue = this.form$.getValue();
    if (value && !currentFormValue) this.form$.next(value);
  }

  // eslint-disable-next-line @angular-eslint/no-output-native
  @Output() public change: EventEmitter<any> = new EventEmitter();

  public readonly triggerRebuild: EventEmitter<FormioOptions> = new EventEmitter();

  public readonly currentLanguage$ = this.translateService.stream('key').pipe(
    map(() => this.translateService.currentLang),
    distinctUntilChanged()
  );

  public readonly formioOptions$: Observable<FormioOptions> = this.currentLanguage$.pipe(
    map(language => {
      const formioTranslations = this.translateService.instant('formioTranslations');
      const options =
        typeof formioTranslations === 'object'
          ? {
              language,
              i18n: {
                [language]: this.stateService.flattenTranslationsObject(formioTranslations),
              },
            }
          : {};

      return options;
    }),
    tap(options => this.triggerRebuild.emit(options))
  );

  public readonly editFormModified$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly translateService: TranslateService,
    private readonly stateService: FormIoStateService
  ) {}

  public ngOnInit() {
    this.modifyEditForm();
  }

  public onChange(event) {
    this.change.emit(event);
  }

  private modifyEditForm = (): void => {
    const originalEditForm = Components.baseEditForm;
    Components.baseEditForm = function (...extend) {
      const editForm = originalEditForm(...extend);
      modiyEditFormApiKeyInput(editForm);
      addValueResolverSelectorToEditform(editForm);

      return editForm;
    };

    setTimeout(() => this.editFormModified$.next(true));
  };
}
