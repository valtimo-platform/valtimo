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
import {BehaviorSubject, combineLatest, Subject} from 'rxjs';
import {map, take} from 'rxjs/operators';
import {Step} from '../models';

@Injectable()
export class StepperService {
  private readonly _steps$ = new BehaviorSubject<Array<Step>>([]);
  private readonly _currentStepIndex$ = new BehaviorSubject<number>(0);
  private readonly _returnToFirstStep$ = new Subject();
  private readonly _cancelClick$ = new Subject();
  private readonly _complete$ = new Subject();
  private readonly _nextStep$ = new Subject<number>();
  private readonly _disabled$ = new BehaviorSubject<boolean>(false);

  get currentStepIndex$() {
    return this._currentStepIndex$.asObservable();
  }

  get steps$() {
    return this._steps$.asObservable();
  }

  get nextStepAvailable$() {
    return combineLatest([this._steps$, this._currentStepIndex$]).pipe(
      map(([steps, currentStepIndex]) => currentStepIndex < steps.length - 1)
    );
  }

  get previousStepAvailable$() {
    return this._currentStepIndex$.pipe(map(currentStepIndex => currentStepIndex > 0));
  }

  get returnToFirstStep$() {
    return this._returnToFirstStep$.asObservable();
  }

  get cancelClick$() {
    return this._cancelClick$.asObservable();
  }

  get complete$() {
    return this._complete$.asObservable();
  }

  get nextStep$() {
    return this._nextStep$.asObservable();
  }

  get disabled$() {
    return this._disabled$.asObservable();
  }

  setSteps(steps: Array<Step>): void {
    const mappedSteps = steps.map((step, index) => ({
      ...step,
      isFirst: index === 0,
      isLast: index === steps.length - 1,
    }));

    this._steps$.next(mappedSteps);
  }

  setCurrentStepIndex(index: number): void {
    this._currentStepIndex$.next(index);
  }

  goToNextStep(): void {
    combineLatest([this.nextStepAvailable$, this._currentStepIndex$])
      .pipe(take(1))
      .subscribe(([nextStepAvailable, currentStepIndex]) => {
        if (nextStepAvailable) {
          this.setCurrentStepIndex(currentStepIndex + 1);
          this._nextStep$.next(currentStepIndex);
        }
      });
  }

  goToPreviousStep(): void {
    combineLatest([this.previousStepAvailable$, this._currentStepIndex$])
      .pipe(take(1))
      .subscribe(([previousStepAvailable, currentStepIndex]) => {
        if (previousStepAvailable) {
          this.setCurrentStepIndex(currentStepIndex - 1);
        }
      });
  }

  cancelClick(): void {
    this._cancelClick$.next(null);
  }

  complete(): void {
    this._complete$.next(null);
  }

  disable(): void {
    this._disabled$.next(true);
  }

  enable(): void {
    this._disabled$.next(false);
  }

  returnToFirstStep(): void {
    this.setCurrentStepIndex(0);
  }
}
