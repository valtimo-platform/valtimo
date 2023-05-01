/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
import {Step} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, filter, map, Observable} from 'rxjs';
import {ProcessLinkType} from '../models';
import {TranslateService} from '@ngx-translate/core';

@Injectable()
export class ProcessLinkStepService {
  private readonly _steps$ = new BehaviorSubject<Array<Step>>(undefined);

  private readonly _currentStepIndex$ = new BehaviorSubject<number>(0);

  get steps$(): Observable<Array<Step>> {
    return combineLatest([this._steps$, this.translateService.stream('key')]).pipe(
      filter(([steps]) => !!steps),
      map(([steps]) =>
        steps.map(step => ({
          ...step,
          label: this.translateService.instant(`processLinkSteps.${step.label}`),
          ...(step.secondaryLabel && {
            secondaryLabel: this.translateService.instant(
              `processLinkSteps.${step.secondaryLabel}`
            ),
          }),
        }))
      )
    );
  }

  get currentStepIndex$(): Observable<number> {
    return this._currentStepIndex$.asObservable();
  }

  get currentStepId$(): Observable<string> {
    return combineLatest([this._steps$, this.currentStepIndex$]).pipe(
      filter(([steps]) => !!steps),
      map(([steps, currentStepIndex]) => steps[currentStepIndex].label)
    );
  }

  constructor(private readonly translateService: TranslateService) {}

  reset(): void {
    this._currentStepIndex$.next(0);
    this._steps$.next([]);
  }

  setInitialSteps(availableProcessLinkTypes: Array<ProcessLinkType>): void {
    if (availableProcessLinkTypes.length > 1) {
      this.setChoiceSteps();
    }
  }

  private setChoiceSteps(): void {
    this._currentStepIndex$.next(0);
    this._steps$.next([
      {label: 'chooseProcessLinkType'},
      {label: 'empty', disabled: true},
      {label: 'empty', disabled: true},
    ]);
  }
}
