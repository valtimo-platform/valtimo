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

import {Component, Input} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {BehaviorSubject, combineLatest, map, Observable} from 'rxjs';

@Component({
  selector: 'v-input-label',
  templateUrl: './input-label.component.html',
  styleUrls: ['./input-label.component.scss'],
})
export class InputLabelComponent {
  @Input() public name = '';
  @Input() public tooltip = '';
  @Input() public largeMargin = false;
  @Input() public small = false;
  @Input() public noMargin = false;

  @Input() public set title(value: string) {
    this._title$.next(value);
  }
  @Input() public set titleTranslationKey(value: string) {
    this._titleTranslationKey$.next(value);
  }
  @Input() public set required(value: boolean) {
    this._required$.next(value);
  }
  @Input() public disabled = false;
  @Input() public carbonTheme = 'g10';

  private readonly _title$ = new BehaviorSubject<string>('');
  private readonly _titleTranslationKey$ = new BehaviorSubject<string>('');
  private readonly _required$ = new BehaviorSubject<boolean>(false);

  public readonly displayTitle$: Observable<string> = combineLatest([
    this._title$,
    this._titleTranslationKey$,
    this._required$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([title, translationKey, required]) => {
      const displayTitle = translationKey ? this.translateService.instant(translationKey) : title;

      return required
        ? `${displayTitle} (${this.translateService.instant('interface.required')})`
        : displayTitle;
    })
  );
  constructor(private readonly translateService: TranslateService) {}
}
