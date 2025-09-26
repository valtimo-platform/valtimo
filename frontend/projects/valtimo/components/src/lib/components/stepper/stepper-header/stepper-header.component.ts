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

import {Component} from '@angular/core';
import {StepperService} from '../../../services/stepper.service';
import {Observable} from 'rxjs';
import {Step} from '../../../models';

/**
 * @deprecated Migrate old design to Carbon
 */
@Component({
  selector: 'v-stepper-header',
  templateUrl: './stepper-header.component.html',
  styleUrls: ['./stepper-header.component.scss'],
})
export class StepperHeaderComponent {
  steps$: Observable<Array<Step>> = this.stepperService.steps$;
  currentStepIndex$: Observable<number> = this.stepperService.currentStepIndex$;

  constructor(private readonly stepperService: StepperService) {}
}
