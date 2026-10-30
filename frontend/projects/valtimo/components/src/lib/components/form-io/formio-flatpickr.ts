/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import flatpickr from 'flatpickr';
import {Dutch} from 'flatpickr/dist/l10n/nl';
import {Formio} from '@formio/js';

/**
 * Formio only set the language on the first load.
 * This script can change the language of all active datepickers.
 * For all active datepickers, the new language is set and the component instance is reloaded.
 * The new language is immediately visible without a window reload.
 */
const DEFAULT_LOCALE_KEY = 'en';

const SUPPORTED_LOCALES: Record<string, object> = new Proxy(
  {
    en: (flatpickr as any).l10ns.default,
    nl: Dutch,
  },
  {
    get: (target, prop: string) => target[prop] ?? target[DEFAULT_LOCALE_KEY],
  }
);

let activeLocale: string = DEFAULT_LOCALE_KEY;

const activeInstances = new Set<any>();

function getLocaleConfig(locale: string): object {
  return SUPPORTED_LOCALES[locale];
}

export function setFormioFlatpickrLocale(langKey: string): void {
  activeLocale = langKey in SUPPORTED_LOCALES ? langKey : DEFAULT_LOCALE_KEY;
  const localeConfig = getLocaleConfig(activeLocale);
  activeInstances.forEach(instance => instance.set('locale', localeConfig));
}

export function registerFormioFlatpickr(): void {
  Object.entries(SUPPORTED_LOCALES).forEach(([key, config]) => {
    flatpickr.l10ns[key] = config as any;
  });

  const formioFlatpickr: any = function (element: unknown, config: object) {
    const result = (flatpickr as any)(element, {...config, locale: activeLocale});
    const instances = Array.isArray(result) ? result : [result];
    instances.forEach(instance => {
      if (!instance) {
        return;
      }
      activeInstances.add(instance);
      instance.config.onDestroy.push(() => activeInstances.delete(instance));
    });
    return result;
  };

  Object.assign(formioFlatpickr, flatpickr);

  (window as any).flatpickr = formioFlatpickr;

  (Formio as any).libraries['flatpickr-nl'] = {
    loaded: true,
    ready: Promise.resolve(Dutch),
  };
}
