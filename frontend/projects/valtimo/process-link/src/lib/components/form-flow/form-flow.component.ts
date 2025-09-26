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

import {Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild} from '@angular/core';
import {BehaviorSubject, combineLatest, filter, Observable, Subscription} from 'rxjs';
import {FormioForm} from '@formio/angular';
import {
  FormioComponent,
  FormioOptionsImpl,
  FormioSubmission,
  ValtimoFormioOptions,
  ValtimoModalService,
} from '@valtimo/components';
import {FormFlowService} from '../../services';
import {FormFlowInstance, FormFlowStepType} from '../../models';
import {TranslateService} from '@ngx-translate/core';
import {Step} from 'carbon-components-angular';
import {ConfigService} from '@valtimo/config';
import {map} from 'rxjs/operators';

@Component({
  selector: 'valtimo-form-flow',
  templateUrl: './form-flow.component.html',
  styleUrls: ['./form-flow.component.scss'],
})
export class FormFlowComponent implements OnInit, OnDestroy {
  @ViewChild('form') form: FormioComponent;
  @Input() formIoFormData: BehaviorSubject<any | null> = new BehaviorSubject<any>(null);
  @Input() formFlowInstanceId: string | null;
  @Output() formFlowComplete = new EventEmitter();
  @Output() formFlowChange = new EventEmitter();

  public readonly breadcrumbs$ = new BehaviorSubject<Step[]>([]);
  public readonly disabled$ = new BehaviorSubject<boolean>(false);
  public readonly formFlowStepType$ = new BehaviorSubject<FormFlowStepType | null>(null);
  public readonly FormFlowCustomComponentId$ = new BehaviorSubject<string>('');
  public readonly currentStepIndex$ = new BehaviorSubject<number>(0);
  public readonly enableFormFlowBreadcrumbs$ = this.configService.getFeatureToggleObservable(
    'enableFormFlowBreadcrumbs'
  );

  private readonly _subscriptions = new Subscription();

  formDefinition: FormioForm;
  formioOptions: ValtimoFormioOptions;

  private formFlowStepInstanceId: string | null;

  constructor(
    private readonly formFlowService: FormFlowService,
    private readonly modalService: ValtimoModalService,
    private readonly translateService: TranslateService,
    private readonly configService: ConfigService
  ) {
    this.formioOptions = new FormioOptionsImpl();
    this.formioOptions.disableAlerts = true;
  }

  public ngOnInit() {
    this.getFormFlowStep();
    this.getBreadcrumbs();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onChange(event: any): void {
    if (!event?.data) return;

    this.formIoFormData.next(event.data);
    this.formFlowChange.emit();
  }

  public onSubmit(submission: FormioSubmission): void {
    this.disable();

    if (submission.data) {
      this.formIoFormData.next(submission.data);
    }
    if (submission.data.submit && this.formFlowInstanceId && this.formFlowStepInstanceId) {
      this.formFlowService
        .submitStep(
          this.formFlowInstanceId,
          this.formFlowStepInstanceId,
          this.formIoFormData.getValue()
        )
        .subscribe({
          next: (result: FormFlowInstance) => {
            this.handleFormFlowStep(result);
          },
          error: errors => {
            this.form?.showErrors(errors);
            this.enable();
          },
        });
    } else if (submission.data['back']) {
      this.back(submission.data);
    }
  }

  public onEvent(submission: any): void {
    if (submission.data['back'] || submission.type == 'back') {
      this.back(submission.data);
    }
  }

  public saveData(): void {
    const formIoFormDataValue = this.formIoFormData.getValue();
    if (formIoFormDataValue && this.formFlowInstanceId) {
      this.formFlowService.save(this.formFlowInstanceId, formIoFormDataValue).subscribe(
        () => null,
        errors => this.form.showErrors(errors)
      );
    }
  }

  public onStepSelected(event: {step: {stepInstanceId: string}; index: number}): void {
    this.disable();
    this.currentStepIndex$.next(event.index);
    const submissionData = this.formIoFormData.getValue().data;
    if (!this.formFlowInstanceId || !this.formFlowStepInstanceId) return;
    this.formFlowService
      .navigateToStep(
        this.formFlowInstanceId,
        this.formFlowStepInstanceId,
        event.step.stepInstanceId,
        submissionData
      )
      .subscribe({
        next: (result: FormFlowInstance) => this.handleFormFlowStep(result),
        error: errors => {
          this.form?.showErrors(errors);
          this.enable();
        },
      });
  }

  private getBreadcrumbs(): void {
    if (!this.formFlowInstanceId) return;
    this._subscriptions.add(
      combineLatest([
        this.enableFormFlowBreadcrumbs$,
        this.formFlowService.getBreadcrumbs(this.formFlowInstanceId),
        this.translateService.stream('key'),
      ])
        .pipe(
          filter(([enableFormFlowBreadcrumbs]) => enableFormFlowBreadcrumbs),
          map(([_, breadcrumbs]) => breadcrumbs)
        )
        .subscribe(breadcrumbs => {
          this.currentStepIndex$.next(breadcrumbs.currentStepIndex);
          this.breadcrumbs$.next(
            breadcrumbs.breadcrumbs.map(breadcrumb => ({
              label:
                breadcrumb.title ??
                this.translateService.instant(`formFlow.step.${breadcrumb.key}.title`) ??
                breadcrumb.key,
              disabled: breadcrumb.stepInstanceId === null,
              complete: breadcrumb.completed,
              stepInstanceId: breadcrumb.stepInstanceId,
            }))
          );
          const classElement = document.getElementsByClassName('cds--progress-step--current');
          if (classElement.length > 0) {
            classElement[0].scrollIntoView({behavior: 'smooth', inline: 'center'});
          }
        })
    );
  }

  private getFormFlowStep(): void {
    if (!this.formFlowInstanceId) return;
    this.formFlowService
      .getFormFlowStep(this.formFlowInstanceId)
      .subscribe((result: FormFlowInstance) => {
        this.handleFormFlowStep(result);
      });
  }

  private back(submissionData: any): void {
    if (!this.formFlowInstanceId) return;

    this.formFlowService.back(this.formFlowInstanceId, submissionData).subscribe({
      next: (result: FormFlowInstance) => this.handleFormFlowStep(result),
      error: errors => {
        this.form?.showErrors(errors);
        this.enable();
      },
    });
  }

  private handleFormFlowStep(formFlowInstance: FormFlowInstance) {
    if (formFlowInstance.step === null) {
      this.formFlowStepType$.next(null);
      this.FormFlowCustomComponentId$.next('');
      this.formFlowInstanceId = null;
      this.formFlowStepInstanceId = null;
      this.formFlowComplete.emit(null);
    } else {
      this.getBreadcrumbs();
      this.modalService.scrollToTop();
      this.formFlowStepType$.next(formFlowInstance.step?.type ?? null);
      this.FormFlowCustomComponentId$.next(formFlowInstance?.step?.typeProperties?.id || '');
      this.formFlowInstanceId = formFlowInstance.id;
      this.formFlowStepInstanceId = formFlowInstance.step?.id ?? null;
      this.formDefinition = formFlowInstance.step?.typeProperties.definition;
    }

    this.enable();
  }

  private disable(): void {
    this.disabled$.next(true);
  }

  private enable(): void {
    this.disabled$.next(false);
  }
}
