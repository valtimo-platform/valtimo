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

import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {StepperService} from '../../../services/stepper.service';
import {Subject, Subscription} from 'rxjs';

/**
 * @deprecated Migrate old design to Carbon
 */
@Component({
  selector: 'v-stepper-container',
  templateUrl: './stepper-container.component.html',
  styleUrls: ['./stepper-container.component.scss'],
  providers: [StepperService],
})
export class StepperContainerComponent implements OnInit, OnDestroy {
  @Input() returnToFirstStepSubject$!: Subject<boolean>;
  @Input()
  set disabled(disabled: boolean) {
    if (disabled) {
      this.stepperService.disable();
    } else {
      this.stepperService.enable();
    }
  }

  @Output() cancelClickEvent: EventEmitter<any> = new EventEmitter();
  @Output() completeEvent: EventEmitter<any> = new EventEmitter();
  @Output() nextStepEvent: EventEmitter<number> = new EventEmitter();

  private cancelClickSubscription!: Subscription;
  private completeSubscription!: Subscription;
  private nextStepSubscription!: Subscription;
  private cancelSubjectSubscription!: Subscription;

  constructor(private readonly stepperService: StepperService) {}

  ngOnInit(): void {
    this.openCancelClickSubscription();
    this.openCompleteSubscription();
    this.openNextStepSubscription();
    this.openReturnToFirstStepSubscription();
  }

  ngOnDestroy(): void {
    this.cancelClickSubscription?.unsubscribe();
    this.completeSubscription?.unsubscribe();
    this.nextStepSubscription?.unsubscribe();
    this.cancelSubjectSubscription?.unsubscribe();
  }

  private openCancelClickSubscription(): void {
    this.cancelClickSubscription = this.stepperService.cancelClick$.subscribe(() => {
      this.cancelClickEvent.emit();
    });
  }

  private openCompleteSubscription(): void {
    this.completeSubscription = this.stepperService.complete$.subscribe(() => {
      this.completeEvent.emit();
    });
  }

  private openNextStepSubscription(): void {
    this.nextStepSubscription = this.stepperService.nextStep$.subscribe(currentStepIndex => {
      this.nextStepEvent.emit(currentStepIndex);
    });
  }

  private openReturnToFirstStepSubscription(): void {
    if (this.returnToFirstStepSubject$) {
      this.cancelSubjectSubscription = this.returnToFirstStepSubject$.subscribe(cancel => {
        if (cancel) {
          this.stepperService.returnToFirstStep();
        }
      });
    }
  }
}
