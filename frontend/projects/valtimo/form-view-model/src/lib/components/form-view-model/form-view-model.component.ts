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
import moment from 'moment';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  interval,
  merge,
  Observable,
  Subject,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {
  FormioComponent,
  FormioModule,
  FormioOptions,
  FormioSubmission,
  FormioSubmissionCallback,
} from '@formio/angular';
import {ViewModelService} from '../../services';
import {distinctUntilChanged, map} from 'rxjs/operators';
import {deepmerge} from 'deepmerge-ts';
import {FormIoStateService, ValtimoFormioOptions} from '@valtimo/components';
import {TranslateService} from '@ngx-translate/core';
import {HttpErrorResponse} from '@angular/common/http';
import {CommonModule} from '@angular/common';
import {LayerModule} from 'carbon-components-angular';

moment.defaultFormat = 'DD MMM YYYY HH:mm';

@Component({
  selector: 'valtimo-form-view-model',
  templateUrl: './form-view-model.component.html',
  styleUrls: ['./form-view-model.component.css'],
  standalone: true,
  imports: [CommonModule, FormioModule, LayerModule],
})
export class FormViewModelComponent implements OnInit, OnDestroy {
  @ViewChild('formio') formio: FormioComponent;

  @Input() set options(optionsValue: any) {
    this.options$.next(optionsValue);
  }

  @Input() set submission(submissionValue: FormioSubmission) {
    this.submission$.next(submissionValue);
  }

  @Input() set form(formValue: object) {
    const instance = this;
    const form = {
      loadInitialViewModel: () => instance.loadInitialViewModel(),
      updateViewModel: () => instance.updateViewModel(),
      loadInitialStartFormViewModel: () => instance.loadInitialViewModelForStartForm(),
      updateViewStartFormModel: () => instance.updateViewModelForStartForm(),
      ...formValue,
    };
    this.form$.next(form);
  }

  @Input() set formName(formName: string) {
    this.formName$.next(formName);
  }

  @Input() set taskInstanceId(taskInstanceId: string) {
    this.taskInstanceId$.next(taskInstanceId);
  }

  @Input() set isStartForm(isStartFormValue: boolean) {
    this.isStartForm$.next(isStartFormValue);
  }

  @Input() set documentId(documentId: string) {
    this.documentId$.next(documentId);
  }

  @Input() set processDefinitionKey(processDefinitionKeyValue: string) {
    this.processDefinitionKey$.next(processDefinitionKeyValue);
  }

  @Input() set documentDefinitionName(documentDefinitionNameValue: string) {
    this.documentDefinitionName$.next(documentDefinitionNameValue);
  }

  @Output() formSubmit = new EventEmitter<any>();

  public refreshForm = new EventEmitter();

  private _preventNextPage = false;
  private _preventPreviousPage = false;
  private _isWizard: boolean = false;

  public pendingUpdateSubscription: Subscription | null = null;

  public readonly submission$ = new BehaviorSubject<any>({});
  public readonly form$ = new BehaviorSubject<object>(undefined);
  public readonly formName$ = new BehaviorSubject<string>(undefined);
  public readonly formErrors$ = new BehaviorSubject<string[]>([]);
  public readonly options$ = new BehaviorSubject<ValtimoFormioOptions>(undefined);
  public readonly taskInstanceId$ = new BehaviorSubject<string>(undefined);
  public readonly tokenSetInLocalStorage$ = new BehaviorSubject<boolean>(false);
  public readonly data$ = new BehaviorSubject<any>(null);
  public readonly changeEvents$ = new Subject<any>();
  public readonly blur$ = new Subject<FocusEvent>();
  public readonly focus$ = new BehaviorSubject<FocusEvent>(null);
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly isStartForm$ = new BehaviorSubject<boolean>(false);
  public readonly documentId$ = new BehaviorSubject<string>(null);
  public readonly processDefinitionKey$ = new BehaviorSubject<string>(undefined);
  public readonly documentDefinitionName$ = new BehaviorSubject<string>(undefined);
  public readonly updateForm = new Subject<boolean>();

  public readonly currentLanguage$ = this.translateService.stream('key').pipe(
    map(() => this.translateService.currentLang),
    distinctUntilChanged()
  );

  private readonly _overrideOptions$ = new BehaviorSubject<FormioOptions>({
    hooks: {
      beforeSubmit: this.beforeSubmitHook(this),
    },
  });

  public readonly formioOptions$: Observable<ValtimoFormioOptions | FormioOptions> = combineLatest([
    this.options$,
    this._overrideOptions$,
  ]).pipe(
    map(([options, overrideOptions]) => {
      return deepmerge(options, overrideOptions);
    })
  );

  public readonly renderOptions$: Observable<any> = combineLatest([this.currentLanguage$]).pipe(
    map(([language]) => {
      const formioTranslations = this.translateService.instant('formioTranslations');

      return {
        language,
        ...(typeof formioTranslations === 'object'
          ? {
              language,
              i18n: {
                [language]: this.stateService.flattenTranslationsObject(formioTranslations),
              },
            }
          : {}),
      };
    })
  );

  private focusSubscription: Subscription;
  private blurSubscription: Subscription;
  private updateSubscription: Subscription;

  constructor(
    private readonly viewModelService: ViewModelService,
    private readonly translateService: TranslateService,
    private readonly stateService: FormIoStateService
  ) {}

  public ngOnInit(): void {
    if (this.isStartForm$.value) {
      this.loadInitialViewModelForStartForm();
    } else {
      this.loadInitialViewModel();
    }

    this.focusSubscription = this.focus$
      .pipe(
        filter(e => {
          // We only want to handle blur events after entering an input
          return !!e && e.target instanceof HTMLInputElement;
        })
      )
      .subscribe(() => {
        this.pendingUpdateSubscription?.unsubscribe();
        this.blurSubscription?.unsubscribe();
        this.blurSubscription = this.blur$
          .pipe(
            filter(e => {
              // Filter out events where relatedTarget is not null.
              // The relatedTarget will be null when no new input is focused.
              return !e.relatedTarget;
            })
          )
          .subscribe(() => {
            this.blurSubscription?.unsubscribe();
            this.setWaitCursor(true);
            this.updateForm.next(true);
          });
      });

    this.updateSubscription = this.updateForm.subscribe(() => {
      if (this.isStartForm$.value) {
        this.updateViewModelForStartForm();
      } else {
        this.updateViewModel();
      }
    });
  }

  public ngOnDestroy(): void {
    this.blurSubscription?.unsubscribe();
    this.focusSubscription?.unsubscribe();
    this.updateSubscription?.unsubscribe();
    this.pendingUpdateSubscription?.unsubscribe();
    this.setWaitCursor(false);
  }

  public beforeSubmitHook(instance: FormViewModelComponent): (submission, callback) => void {
    return (submission, callback) => instance.beforeSubmit(submission, callback);
  }

  public beforeSubmit(submission: any, callback: FormioSubmissionCallback): void {
    this.changeEvents$.pipe(take(1)).subscribe({
      next: () => {
        this.pendingUpdateSubscription?.unsubscribe();
        this.setWaitCursor(false);

        combineLatest([
          this.formName$,
          this.taskInstanceId$,
          this.processDefinitionKey$,
          this.documentDefinitionName$,
          this.isStartForm$,
          this.documentId$,
        ])
          .pipe(
            take(1),
            switchMap(
              ([
                formName,
                taskInstanceId,
                processDefinitionKey,
                documentDefinitionName,
                isStartForm,
                documentId,
              ]) =>
                isStartForm
                  ? this.viewModelService.submitViewModelForStartForm(
                      formName,
                      processDefinitionKey,
                      documentId,
                      documentDefinitionName,
                      submission.data
                    )
                  : this.viewModelService.submitViewModel(formName, taskInstanceId, submission.data)
            )
          )
          .subscribe({
            next: _ => {
              callback(null, submission);
            },
            error: err => {
              this.handleSubmissionError(err, callback);
            },
          });
      },
    });
  }

  private handleSubmissionError(error: any, callback: FormioSubmissionCallback): void {
    if (error instanceof HttpErrorResponse) {
      merge(this.changeEvents$, interval(200))
        .pipe(take(1))
        .subscribe({
          next: () => {
            this.handleFormError(error);
          },
        });
    }

    callback({message: 'error', component: null, silent: false}, null);
  }

  private handleFormError(error: HttpErrorResponse): void {
    const formio = this.formio.formio;
    const formErrors = [];

    this.formErrors$.next([]);

    const componentErrors = error?.error?.componentErrors;
    const genericMessage = error?.error?.error;
    const componentKey = error?.error?.component;

    // Handle field-level (component) errors
    if (Array.isArray(componentErrors)) {
      for (const {component, message} of componentErrors) {
        const field = formio.getComponent(component);
        if (field) {
          field.setCustomValidity(message, true); // Mark dirty
        } else {
          formErrors.push(message);
        }
      }
      this.formErrors$.next(formErrors);
      return;
    }

    // Handle single (generic or component-specific) error
    if (genericMessage) {
      const field = formio.getComponent(componentKey);
      if (field) {
        field.setCustomValidity(genericMessage, true);
      } else {
        this.formErrors$.next([genericMessage]);
      }
    }
  }

  public onSubmit(submission: FormioSubmission): void {
    this.formSubmit.next(submission);
  }

  public onFocus($event: FocusEvent): void {
    this.focus$.next($event);
  }

  public onBlur(blurEvent: FocusEvent): void {
    this.blur$.next(blurEvent);
  }

  public onChange(object: any): void {
    this.changeEvents$.next(object);
    if (object.data) {
      this.data$.next(object.data);
    }
  }

  public onNextPage(): void {
    this._preventNextPage = true;
    this.formio.formio.setPage(this.formio.formio.page - 1);
    this.updateForm.next(true);
  }

  public onPreviousPage(): void {
    this._preventPreviousPage = true;
    this.formio.formio.setPage(this.formio.formio.page + 1);
    this.updateForm.next(true);
  }

  private handlePageChange(): void {
    if (this._preventNextPage) {
      this._preventNextPage = false;
      this.formio.formio.setPage(this.formio.formio.page + 1);
    } else if (this._preventPreviousPage) {
      this._preventPreviousPage = false;
      this.formio.formio.setPage(this.formio.formio.page - 1);
    }
  }

  public loadInitialViewModel(): void {
    combineLatest([this.formName$, this.taskInstanceId$])
      .pipe(
        take(1),
        switchMap(([formName, taskInstanceId]) =>
          this.viewModelService.getViewModel(formName, taskInstanceId).pipe(
            tap(viewModel => {
              this.changeEvents$.pipe(take(1)).subscribe(() => {
                this.loading$.next(false);
              });
              this.submission$.next({data: viewModel});
              this._isWizard = this.formio.form.display === 'wizard';
            })
          )
        )
      )
      .subscribe();
  }

  public loadInitialViewModelForStartForm(): void {
    combineLatest([this.formName$, this.processDefinitionKey$, this.documentId$])
      .pipe(
        take(1),
        switchMap(([formName, processDefinitionKey, documentId]) =>
          this.viewModelService
            .getViewModelForStartForm(formName, processDefinitionKey, documentId)
            .pipe(
              tap(viewModel => {
                this.changeEvents$.pipe(take(1)).subscribe(() => {
                  this.loading$.next(false);
                });
                this.submission$.next({data: viewModel});
                this._isWizard = this.formio.form.display === 'wizard';
              })
            )
        )
      )
      .subscribe();
  }

  public updateViewModel(): void {
    this.pendingUpdateSubscription?.unsubscribe();

    this.pendingUpdateSubscription = combineLatest([
      this.formName$,
      this.taskInstanceId$,
      this.data$,
    ])
      .pipe(
        take(1),
        switchMap(([formName, taskInstanceId, data]) =>
          this.viewModelService
            .updateViewModel(
              formName,
              taskInstanceId,
              data,
              this.formio.formio.page,
              this._isWizard
            )
            .pipe(
              tap({
                next: viewModel => this.handleViewModelUpdate(viewModel),
                error: error => this.handleViewModelUpdateError(error),
              })
            )
        )
      )
      .subscribe();
  }

  public updateViewModelForStartForm(): void {
    this.pendingUpdateSubscription?.unsubscribe();

    this.pendingUpdateSubscription = combineLatest([
      this.formName$,
      this.processDefinitionKey$,
      this.data$,
      this.documentId$,
    ])
      .pipe(
        take(1),
        switchMap(([formName, processDefinitionKey, data, documentId]) =>
          this.viewModelService
            .updateViewModelForStartForm(
              formName,
              processDefinitionKey,
              documentId,
              data,
              this.formio.formio.page,
              this._isWizard
            )
            .pipe(
              tap({
                next: viewModel => this.handleViewModelUpdate(viewModel),
                error: error => this.handleViewModelUpdateError(error),
              })
            )
        )
      )
      .subscribe();
  }

  public handleViewModelUpdate(viewModel: object): void {
    const submission = this.submission$.value;
    submission.data = viewModel;
    this.submission$.next(submission);
    this.handlePageChange();
    this.refreshForm.emit({submission});
    this.pendingUpdateSubscription?.unsubscribe();
    this.pendingUpdateSubscription = null;
    this.formErrors$.next([]);
    this.setWaitCursor(false);
  }

  public handleViewModelUpdateError(error: HttpErrorResponse): void {
    this.pendingUpdateSubscription?.unsubscribe();
    this.pendingUpdateSubscription = null;
    this.handleFormError(error);
    this.setWaitCursor(false);
  }

  private setWaitCursor(enabled: boolean): void {
    document.body.style.cursor = enabled ? 'wait' : 'auto';
  }
}
