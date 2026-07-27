import flatpickr from 'flatpickr';
import {Dutch} from 'flatpickr/dist/l10n/nl';
import {Formio} from 'formiojs';

/**
 * Fromio only set the language on the first load.
 * This script can change the language of all active datepickers.
 * For all active datepickers, the new language is set and the component instance is reloaded.
 * The new language is immediately visible without a window reload.
 */
let activeLocale: 'nl' | 'en' = 'nl';

const activeInstances = new Set<any>();

function getLocaleConfig(locale: 'nl' | 'en'): object {
  return locale === 'en' ? (flatpickr as any).l10ns.default : Dutch;
}

export function setFormioFlatpickrLocale(langKey: string): void {
  activeLocale = langKey === 'en' ? 'en' : 'nl';
  const localeConfig = getLocaleConfig(activeLocale);
  activeInstances.forEach(instance => instance.set('locale', localeConfig));
}

export function registerFormioFlatpickr(): void {
  flatpickr.l10ns.nl = Dutch;

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
