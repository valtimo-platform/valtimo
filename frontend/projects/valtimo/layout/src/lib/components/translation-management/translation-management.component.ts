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

import {Component, Inject, OnInit} from '@angular/core';
import {BehaviorSubject, combineLatest, map, Observable, switchMap, take, tap} from 'rxjs';
import {TranslateService} from '@ngx-translate/core';
import {Localization, LocalizationService, MergedLocalizations} from '@valtimo/config';
import {
  ArbitraryInputTitles,
  MultiInputKeyValue,
  MultiInputOutput,
  PageHeaderService,
} from '@valtimo/components';
import {isEqual} from 'lodash';
import {DOCUMENT} from '@angular/common';

@Component({
  selector: 'valtimo-translation-management',
  templateUrl: './translation-management.component.html',
  styleUrls: ['./translation-management.component.scss'],
})
export class TranslationManagementComponent implements OnInit {
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly allChangedValuesValid$ = new BehaviorSubject<boolean>(false);
  public readonly disabled$ = new BehaviorSubject<boolean>(false);

  private readonly _languageOptions$ = new BehaviorSubject<Array<string>>(undefined);
  private readonly _refreshLocalizations$ = new BehaviorSubject<null>(null);
  private readonly _localizationTranslations$ = this._refreshLocalizations$.pipe(
    tap(() => this.loading$.next(true)),
    switchMap(() => this.localizationService.getMergedLocalizations()),
    tap(() => this.loading$.next(false))
  );

  private _defaultValues: Array<MultiInputKeyValue> = [];

  private readonly _changedValues$ = new BehaviorSubject<MultiInputOutput>(undefined);

  public readonly showConfirmationModal$ = new BehaviorSubject<boolean>(false);

  public readonly valuesChanged$: Observable<boolean> = this._changedValues$.pipe(
    map(changedValues => !isEqual(changedValues, this._defaultValues))
  );

  public readonly localizationTranslationValues$: Observable<Array<MultiInputKeyValue>> =
    combineLatest([
      this._languageOptions$,
      this._localizationTranslations$,
      this.translateService.stream('key'),
    ]).pipe(
      map(([languageOptions, localizationTranslations]) =>
        this.mapMergedLocalizationsToMultiInput(languageOptions, localizationTranslations)
      ),
      tap(defaultValues => {
        this._defaultValues = defaultValues;
      })
    );

  public readonly multiInputTiles$: Observable<ArbitraryInputTitles> = combineLatest([
    this._languageOptions$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([languageOptions]) => {
      const objToReturn = {};
      objToReturn[0] = this.translateService.instant('listColumn.key');

      languageOptions.forEach((languageOption, index) => {
        objToReturn[index + 1] = this.translateService.instant(
          `settings.language.options.${languageOption}`
        );
      });

      return objToReturn;
    })
  );

  public readonly amountOfArbitraryValues$: Observable<number> = this.multiInputTiles$.pipe(
    map(multiInputTitles => Object.keys(multiInputTitles).length)
  );

  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  constructor(
    private readonly translateService: TranslateService,
    private readonly localizationService: LocalizationService,
    private readonly pageHeaderService: PageHeaderService,
    @Inject(DOCUMENT) private readonly document: Document
  ) {}

  public ngOnInit(): void {
    this.setLanguages();
  }

  public validChange(valid: boolean): void {
    this.allChangedValuesValid$.next(valid);
  }

  public valueChange(value: MultiInputOutput): void {
    this._changedValues$.next(value);
  }

  public saveAndRefresh(): void {
    this.saveChanges(true);
  }

  public saveAndStay(): void {
    this.saveChanges();
  }

  public cancel(): void {
    this.hideModal();
  }

  public showModal(): void {
    this.showConfirmationModal$.next(true);
  }

  public saveChanges(reload = false): void {
    this.disable();

    combineLatest([this._changedValues$, this._languageOptions$])
      .pipe(
        take(1),
        map(([changedValues, languageOptions]) =>
          this.getLocalizationsForUpdateRequest(changedValues, languageOptions)
        ),
        switchMap(updatedLocalizations =>
          this.localizationService.updateLocalizations(updatedLocalizations)
        )
      )
      .subscribe(() => {
        if (reload) {
          this.document?.defaultView?.location?.reload();
        } else {
          this._refreshLocalizations$.next(null);
          this.enable();
        }
      });
  }

  private setLanguages(): void {
    this._languageOptions$.next(this.translateService.langs);
  }

  private disable(): void {
    this.disabled$.next(true);
  }

  private enable(): void {
    this.disabled$.next(false);
  }

  private hideModal(): void {
    this.showConfirmationModal$.next(false);
  }

  private flattenObject(ob: object): object {
    const toReturn = {};

    for (const i in ob) {
      if (!ob.hasOwnProperty(i)) continue;

      if (typeof ob[i] == 'object' && ob[i] !== null) {
        const flatObject = this.flattenObject(ob[i]);
        for (const x in flatObject) {
          if (!flatObject.hasOwnProperty(x)) continue;

          toReturn[i + '.' + x] = flatObject[x];
        }
      } else {
        toReturn[i] = ob[i];
      }
    }
    return toReturn;
  }

  private unflattenObject(obj: object, delimiter = '.'): object {
    return Object.keys(obj).reduce((res, k) => {
      k.split(delimiter).reduce(
        (acc, e, i, keys) =>
          acc[e] ||
          (acc[e] = isNaN(Number(keys[i + 1])) ? (keys.length - 1 === i ? obj[k] : {}) : []),
        res
      );
      return res;
    }, {});
  }

  private getLocalizationsForUpdateRequest(
    changedValues: MultiInputOutput,
    languageOptions: string[]
  ): Localization[] {
    const localizations: Localization[] = [];
    const translationObject = {};

    languageOptions.forEach(languageOption => {
      translationObject[languageOption] = {};
    });

    changedValues.forEach(changedValue => {
      languageOptions.forEach((languageOption, index) => {
        translationObject[languageOption] = {
          ...translationObject[languageOption],
          [changedValue[0]]: changedValue[index + 1],
        };
      });
    });

    languageOptions.forEach(languageOption => {
      translationObject[languageOption] = this.unflattenObject(translationObject[languageOption]);
    });

    Object.keys(translationObject).forEach(languageKey => {
      localizations.push({languageKey, content: translationObject[languageKey]});
    });

    return localizations;
  }

  private mapMergedLocalizationsToMultiInput(
    languageOptions: string[],
    mergedLocalizations: MergedLocalizations
  ) {
    if (Object.keys(mergedLocalizations).length === 0) {
      return [];
    }

    const firstLanguageOption = languageOptions[0];
    const firstLanguageTranslations =
      firstLanguageOption && mergedLocalizations[firstLanguageOption];
    const flattenedFirstLanguageTranslations =
      firstLanguageTranslations && this.flattenObject(firstLanguageTranslations);

    return Object.keys(flattenedFirstLanguageTranslations).map(flattenedTranslationKey => {
      const emptyArbitraryValue = {};

      emptyArbitraryValue['0'] = flattenedTranslationKey;

      languageOptions.forEach((languageOption, index) => {
        emptyArbitraryValue[`${index + 1}`] =
          this.flattenObject(mergedLocalizations[languageOption])[flattenedTranslationKey] || '';
      });

      return emptyArbitraryValue;
    });
  }
}
