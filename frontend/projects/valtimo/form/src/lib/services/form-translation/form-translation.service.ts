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

import {Injectable} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {ExtendedComponentSchema, FormioForm} from '@formio/angular';
import {FormMappingService} from '../form-mapping/form-mapping.service';

@Injectable({
  providedIn: 'root',
})
export class FormTranslationService {
  constructor(
    private readonly translateService: TranslateService,
    private readonly formMappingService: FormMappingService
  ) {}

  translateForm(form: FormioForm): FormioForm {
    const translateFunction = (component: ExtendedComponentSchema): ExtendedComponentSchema => {
      const labelTranslation = this.getTranslation(`${component.label}`);
      const titleTranslation = this.getTranslation(`${component.title}`);
      const contentTranslation = this.getTranslation(`${component.content}`);
      const placeholderTranslation = this.getTranslation(`${component.placeholder}`);
      const tooltipTranslation = this.getTranslation(`${component.tooltip}`);

      return {
        ...component,
        ...(labelTranslation && {label: `${labelTranslation}`}),
        ...(titleTranslation && {title: `${titleTranslation}`}),
        ...(contentTranslation && {content: `${contentTranslation}`}),
        ...(placeholderTranslation && {placeholder: `${placeholderTranslation}`}),
        ...(tooltipTranslation && {tooltip: `${tooltipTranslation}`}),
      };
    };

    return this.formMappingService.mapComponents(form, translateFunction);
  }

  private getTranslation(translationKey: string): string | boolean {
    const translation = this.translateService.instant(translationKey);

    if (translation !== translationKey) {
      return translation;
    }

    return false;
  }
}
