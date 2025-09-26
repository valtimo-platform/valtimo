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
import {StepperService} from '../../../services/stepper.service';
import {BehaviorSubject, Observable} from 'rxjs';

/**
 * @deprecated Migrate old design to Carbon
 */
@Component({
  selector: 'v-stepper-footer-step',
  templateUrl: './stepper-footer-step.component.html',
  styleUrls: ['./stepper-footer-step.component.scss'],
})
export class StepperFooterStepComponent {
  @Input() nextButtonEnabled = false;
  @Input() completeButtonEnabled = false;
  @Input() nextButtonTranslationKey = '';
  @Input() cancelButtonTranslationKey = '';
  @Input() completeButtonTranslationKey = '';
  @Input() completeButtonMdiIcon = '';
  @Input() showCompleteButton = true;

  public stepIndex$ = new BehaviorSubject<number>(-1);
  public isLastStep$ = new BehaviorSubject<boolean>(false);

  currentStepIndex$: Observable<number> = this.stepperService.currentStepIndex$;
  disabled$: Observable<boolean> = this.stepperService.disabled$;

  constructor(private readonly stepperService: StepperService) {}

  goToNextStep(): void {
    this.stepperService.goToNextStep();
  }

  cancel(): void {
    this.stepperService.cancelClick();
  }

  complete(): void {
    this.stepperService.complete();
  }
}
