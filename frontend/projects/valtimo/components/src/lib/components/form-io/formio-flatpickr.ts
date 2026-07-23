import flatpickr from 'flatpickr';
import {Dutch} from 'flatpickr/dist/l10n/nl';
import {Formio} from 'formiojs';

/**
 * Registreert de gebundelde flatpickr (incl. Nederlandse locale) bij Form.io,
 * zodat de datepickers van datetime-componenten de Valtimo-taal (nl/en)
 * volgen en er niets meer van cdn.form.io geladen wordt.
 *
 * Achtergrond: formiojs (CalendarWidget) laadt flatpickr, de bijbehorende CSS
 * en het locale-bestand normaal gesproken runtime van cdn.form.io via
 * Formio.requireLibrary. Door window.flatpickr vooraf te zetten gebruikt
 * requireLibrary de gebundelde versie (4.6.13, gelijk aan wat de CDN zou
 * leveren) en wordt de CDN-stylesheet overgeslagen; de flatpickr-CSS staat
 * al in angular.json.
 *
 * Form.io is de enige die flatpickr via window resolvet — Valtimo en Carbon
 * gebruiken hun eigen import. We zetten daarom een wrapper op window die elke
 * door Form.io aangemaakte kalender de marker-class 'formio-calendar' geeft,
 * zodat de CSS-correcties in styles.scss (op de globale .flatpickr-*-regels
 * van @carbon/styles) de Carbon-datepickers van Valtimo zelf niet raken.
 *
 * Let op: voor het locale-bestand ('flatpickr-nl') roept requireLibrary de
 * onload-callback — die de kalender initialiseert — alleen aan als de library
 * als 'loaded' geregistreerd staat. Alleen window['flatpickr-nl'] zetten is
 * dus niet genoeg; we seeden daarom Formio.libraries direct.
 *
 * Let op 2: config.locale niet vertrouwen. formio's DateTimeComponent
 * berekent widget.locale (op basis van options.language) eenmalig in zijn
 * constructor — dat wordt niet altijd opnieuw doorgerekend bij een taalwissel
 * in Valtimo. We houden de actieve taal daarom zelf bij (zie
 * setFormioFlatpickrLocale) en negeren config.locale.
 */
let activeLocale: 'nl' | 'en' = 'nl';

export function setFormioFlatpickrLocale(langKey: string): void {
  activeLocale = langKey === 'en' ? 'en' : 'nl';
}

export function registerFormioFlatpickr(): void {
  flatpickr.l10ns.nl = Dutch;


  const formioFlatpickr: any = function (element: unknown, config: object) {
    const result = (flatpickr as any)(element, {...config, locale: activeLocale});
    const instances = Array.isArray(result) ? result : [result];
    instances.forEach(instance => instance?.calendarContainer?.classList.add('formio-calendar'));
    return result;
  };

  Object.assign(formioFlatpickr, flatpickr);

  (window as any).flatpickr = formioFlatpickr;

  (Formio as any).libraries['flatpickr-nl'] = {
    loaded: true,
    ready: Promise.resolve(Dutch),
  };
}
