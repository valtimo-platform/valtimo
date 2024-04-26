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

import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import {FormioSubmission, ValtimoFormioOptions} from '../../models';
import {ValtimoModalService} from '../../services/valtimo-modal.service';
import {UserProviderService} from '@valtimo/security';
import {Formio, FormioComponent as FormIoSourceComponent} from '@formio/angular';
import {FormioRefreshValue} from '@formio/angular/formio.common';
import jwt_decode from 'jwt-decode';
import {NGXLogger} from 'ngx-logger';
import {BehaviorSubject, combineLatest, from, Observable, Subject, Subscription, timer} from 'rxjs';
import {distinctUntilChanged, map, switchMap, take} from 'rxjs/operators';
import {FormIoStateService} from './services/form-io-state.service';
import {ActivatedRoute} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';

@Component({
  selector: 'valtimo-form-io',
  templateUrl: './form-io.component.html',
  styleUrls: ['./form-io.component.css'],
})
export class FormioComponent implements OnInit, OnChanges, OnDestroy {
  @Input() set options(optionsValue: ValtimoFormioOptions) {
    this.options$.next(optionsValue);
  }
  @Input() set submission(submissionValue: object) {
    this.submission$.next(submissionValue);
  }
  @Input() set form(formValue: object) {
    this.form$.next(formValue);
  }
  @Input() set readOnly(readOnlyValue: boolean) {
    this.readOnly$.next(readOnlyValue);
  }
  @Input() formRefresh$!: Subject<FormioRefreshValue>;

  // eslint-disable-next-line @angular-eslint/no-output-native
  @Output() submit: EventEmitter<any> = new EventEmitter();
  // eslint-disable-next-line @angular-eslint/no-output-native
  @Output() change: EventEmitter<any> = new EventEmitter();

  public readonly refreshForm: EventEmitter<FormioRefreshValue> = new EventEmitter();

  public readonly submission$ = new BehaviorSubject<object>(undefined);
  public readonly form$ = new BehaviorSubject<object>(undefined);
  public readonly options$ = new BehaviorSubject<ValtimoFormioOptions>(undefined);
  public readonly readOnly$ = new BehaviorSubject<boolean>(false);
  public readonly errors$ = new BehaviorSubject<Array<string>>([]);

  private tokenRefreshTimerSubscription: Subscription;
  private formRefreshSubscription: Subscription;

  readonly currentLanguage$ = this.translateService.stream('key').pipe(
    map(() => this.translateService.currentLang),
    distinctUntilChanged()
  );

  readonly formioOptions$: Observable<ValtimoFormioOptions> = combineLatest([
    this.currentLanguage$,
    this.options$,
  ]).pipe(
    map(([language, options]) => {
      const formioTranslations = this.translateService.instant('formioTranslations');
      return typeof formioTranslations === 'object'
        ? {
            ...options,
            i18n: {
              [language]: this.stateService.flattenTranslationsObject(formioTranslations),
            },
            language,
          }
        : {
            ...options,
            language,
          };
    })
  );

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly userProviderService: UserProviderService,
    private readonly logger: NGXLogger,
    private readonly stateService: FormIoStateService,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService,
    private readonly modalService: ValtimoModalService
  ) {}

  public ngOnInit() {
    Formio.setProjectUrl(location.origin);
    Formio.authUrl = location.origin;

    this.openRouteSubscription();
    this.errors$.next([]);
    this.setInitialToken();
    this.subscribeFormRefresh();
    this.openReloadFormSubscription();
    this.openReloadSubmissionSubscription();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    this.setInitialToken();

    if (changes.formDefinitionRefresh$) {
      this.unsubscribeFormRefresh();
      this.subscribeFormRefresh();
    }
  }

  public ngOnDestroy(): void {
    this.unsubscribeFormRefresh();
    this.tokenRefreshTimerSubscription?.unsubscribe();
    this._subscriptions.unsubscribe();
  }

  public showErrors(errors: string[]) {
    this.errors$.next(errors);
  }

  public onSubmit(submission: FormioSubmission) {
    this.errors$.next([]);
    this.submit.emit(submission);
  }

  public formReady(form: FormIoSourceComponent): void {
    this.stateService.currentForm = form;
  }

  public onChange(object: any): void {
    this.change.emit(object);
  }

  public nextPage(): void {
    this.scrollToTop();
  }

  public prevPage(): void {
    this.scrollToTop();
  }

  private openReloadFormSubscription() {
    this._subscriptions.add(
      this.form$.subscribe(form => {
        this.refreshForm.emit({
          form,
        });
      })
    );
  }

  private openReloadSubmissionSubscription() {
    this._subscriptions.add(
      this.submission$.subscribe(submission => {
        this.refreshForm.emit({
          submission,
        });
      })
    );
  }

  private scrollToTop(): void {
    this.modalService.scrollToTop();
  }

  private setInitialToken(): void {
    this.userProviderService.getToken().then((token: string) => {
      this.setToken(token);
    });
  }

  private setToken(token: string): void {
    Formio.setUser(jwt_decode(token));
    Formio.setToken(token);
    localStorage.setItem('formioToken', token);
    this.setTimerForTokenRefresh(token);

    this.logger.debug('New token set for form.io.');
  }

  private setTimerForTokenRefresh(token: string): void {
    const tokenExp = (jwt_decode(token) as any).exp * 1000;
    const expiryTime = tokenExp - Date.now() - 1000;
    if (!this.tokenRefreshTimerSubscription) {
      this.tokenRefreshTimerSubscription = timer(expiryTime).subscribe(() => {
        this.refreshToken();
      });
    }

    this.logger.debug(`Timer for form.io token refresh set for: ${expiryTime}ms.`);
  }

  private refreshToken(): void {
    from(this.userProviderService.updateToken(-1))
      .pipe(
        switchMap(() => this.userProviderService.getToken()),
        take(1)
      )
      .subscribe(token => {
        this.setToken(token);
      });
  }

  private subscribeFormRefresh(): void {
    if (this.formRefresh$) {
      this.formRefreshSubscription = this.formRefresh$.subscribe(refreshValue => {
        if (refreshValue) {
          this.refreshForm.emit(refreshValue);
        }
      });
    }
  }

  private unsubscribeFormRefresh(): void {
    if (this.formRefreshSubscription) {
      this.formRefreshSubscription.unsubscribe();
    }
  }

  private openRouteSubscription(): void {
    this._subscriptions.add(
      this.route.params.subscribe(params => {
        const documentDefinitionName = params.documentDefinitionName;
        const documentId = params.documentId;

        if (documentDefinitionName) {
          this.stateService.setDocumentDefinitionName(documentDefinitionName);
        }

        if (documentId) {
          this.stateService.setDocumentId(documentId);
        }
      })
    );
  }
}
