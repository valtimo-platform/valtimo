/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import {BehaviorSubject, combineLatest, Subscription} from 'rxjs';
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
import {ConfigService} from '@valtimo/shared';
import {map} from 'rxjs/operators';

@Component({
  standalone: false,
  selector: 'valtimo-form-flow',
  templateUrl: './form-flow.component.html',
  styleUrls: ['./form-flow.component.scss'],
})
export class FormFlowComponent implements OnInit, OnDestroy {
  @ViewChild('form') public readonly form: FormioComponent;

  @Input() public readonly formIoFormData: BehaviorSubject<any | null> = new BehaviorSubject<any>(
    null
  );
  @Input() public set formFlowInstanceId(value: string | null) {
    this.formFlowInstanceId$.next(value);

    if (value) this.getBreadcrumbs();
  }

  @Output() public readonly formFlowComplete = new EventEmitter();
  @Output() public readonly formFlowChange = new EventEmitter();

  public formDefinition: FormioForm;
  public formioOptions: ValtimoFormioOptions;

  public readonly breadcrumbs$ = new BehaviorSubject<Step[]>([]);
  public readonly disabled$ = new BehaviorSubject<boolean>(false);
  public readonly formFlowStepType$ = new BehaviorSubject<FormFlowStepType | null>(null);
  public readonly FormFlowCustomComponentId$ = new BehaviorSubject<string>('');
  public readonly currentStepIndex$ = new BehaviorSubject<number>(0);
  public readonly enableFormFlowBreadcrumbs$ = this.configService.getFeatureToggleObservable(
    'enableFormFlowBreadcrumbs'
  );
  public readonly formFlowInstanceId$ = new BehaviorSubject<string | null>('');

  private formFlowStepInstanceId: string | null = null;

  private _breadcrumbsSubscription!: Subscription;

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
  }

  public ngOnDestroy(): void {
    this._breadcrumbsSubscription?.unsubscribe();
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

    if (
      submission.data.submit &&
      this.formFlowInstanceId$.getValue() &&
      this.formFlowStepInstanceId
    ) {
      this.formFlowService
        .submitStep(
          this.formFlowInstanceId$.getValue(),
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

    if (formIoFormDataValue && this.formFlowInstanceId$.getValue()) {
      this.formFlowService.save(this.formFlowInstanceId$.getValue(), formIoFormDataValue).subscribe(
        () => null,
        errors => this.form.showErrors(errors)
      );
    }
  }

  public onStepSelected(event: {step: {stepInstanceId: string}; index: number}): void {
    const submissionData = this.formIoFormData.getValue().data;

    this.disable();

    this.currentStepIndex$.next(event.index);

    if (!this.formFlowInstanceId$.getValue() || !this.formFlowStepInstanceId) return;

    this.formFlowService
      .navigateToStep(
        this.formFlowInstanceId$.getValue(),
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
    if (
      !this.formFlowInstanceId$.getValue() ||
      !this.configService.getFeatureToggle('enableFormFlowBreadcrumbs')
    ) {
      return;
    }

    this._breadcrumbsSubscription?.unsubscribe();

    this._breadcrumbsSubscription = combineLatest([
      this.formFlowService.getBreadcrumbs(this.formFlowInstanceId$.getValue()),
      this.translateService.stream('key'),
    ])
      .pipe(map(([breadcrumbs]) => breadcrumbs))
      .subscribe(breadcrumbs => {
        const classElement = document.getElementsByClassName('cds--progress-step--current');

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

        if (classElement.length > 0) {
          classElement[0].scrollIntoView({behavior: 'smooth', inline: 'center'});
        }
      });
  }

  private getFormFlowStep(): void {
    if (!this.formFlowInstanceId$.getValue()) return;

    this.formFlowService
      .getFormFlowStep(this.formFlowInstanceId$.getValue())
      .subscribe((result: FormFlowInstance) => {
        this.handleFormFlowStep(result);
      });
  }

  private back(submissionData: any): void {
    if (!this.formFlowInstanceId$.getValue()) return;

    this.formFlowService.back(this.formFlowInstanceId$.getValue(), submissionData).subscribe({
      next: (result: FormFlowInstance) => this.handleFormFlowStep(result),
      error: errors => {
        this.form?.showErrors(errors);
        this.enable();
      },
    });
  }

  private handleFormFlowStep(formFlowInstance: FormFlowInstance): void {
    if (formFlowInstance.step === null) {
      this.formFlowStepType$.next(null);
      this.FormFlowCustomComponentId$.next('');
      this.formFlowInstanceId$.next(null);
      this.formFlowStepInstanceId = null;
      this.formFlowComplete.emit(null);
    } else {
      this.getBreadcrumbs();
      this.modalService.scrollToTop();
      this.formFlowStepType$.next(formFlowInstance.step?.type ?? null);
      this.FormFlowCustomComponentId$.next(formFlowInstance?.step?.typeProperties?.id || '');
      this.formFlowInstanceId$.next(formFlowInstance.id);
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
