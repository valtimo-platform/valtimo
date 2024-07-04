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

import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import {ValtimoFormioOptions} from '../../models';
import {ValtimoModalService} from '../../services/valtimo-modal.service';
import {UserProviderService} from '@valtimo/security';
import {
  Formio,
  FormioComponent as FormIoSourceComponent,
  FormioOptions,
  FormioRefreshValue,
  FormioSubmission,
} from '@formio/angular';
import {jwtDecode} from 'jwt-decode';
import {NGXLogger} from 'ngx-logger';
import {BehaviorSubject, combineLatest, Observable, Subject, Subscription, timer} from 'rxjs';
import {distinctUntilChanged, map, switchMap, take, tap} from 'rxjs/operators';
import {FormIoStateService} from './services/form-io-state.service';
import {ActivatedRoute} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {FormIoLocalStorageService} from './services/form-io-local-storage.service';
import {deepmerge} from 'deepmerge-ts';
import {ConfigService, ValtimoConfig} from '@valtimo/config';

@Component({
  selector: 'valtimo-form-io',
  templateUrl: './form-io.component.html',
  styleUrls: ['./form-io.component.css'],
  providers: [FormIoLocalStorageService],
})
export class FormioComponent implements OnInit, OnChanges, OnDestroy {
  @Input() set options(optionsValue: ValtimoFormioOptions) {
    this.options$.next(optionsValue);
  }
  @Input() set submission(submissionValue: FormioSubmission) {
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
  @Output() submit = new EventEmitter<any>();
  // eslint-disable-next-line @angular-eslint/no-output-native
  @Output() change = new EventEmitter<any>();

  @HostListener('window:beforeunload', ['$event'])
  private handleBeforeUnload() {
    this.localStorageService.clearTokenFromLocalStorage();
  }

  public refreshForm = new EventEmitter<FormioRefreshValue>();

  public readonly submission$ = new BehaviorSubject<FormioSubmission>({});
  public readonly form$ = new BehaviorSubject<object>(undefined);
  public readonly options$ = new BehaviorSubject<ValtimoFormioOptions>(undefined);
  public readonly readOnly$ = new BehaviorSubject<boolean>(false);
  public readonly errors$ = new BehaviorSubject<Array<string>>([]);

  public readonly currentLanguage$ = this.translateService.stream('key').pipe(
    map(() => this.translateService.currentLang),
    distinctUntilChanged()
  );

  private readonly _overrideOptions$ = new BehaviorSubject<FormioOptions>({});

  public readonly formioOptions$: Observable<ValtimoFormioOptions | FormioOptions> = combineLatest([
    this.currentLanguage$,
    this.options$,
    this._overrideOptions$,
  ]).pipe(
    map(([language, options, overrideOptions]) => {
      const formioTranslations = this.translateService.instant('formioTranslations');

      const defaultOptions = {
        ...options,
        language,
        ...(formioTranslations === 'object' && {
          i18n: {
            [language]: this.stateService.flattenTranslationsObject(formioTranslations),
          },
        }),
      };

      return deepmerge(defaultOptions, overrideOptions);
    }),
    tap(options => this.logger.debug('Form.IO options used', options))
  );

  public readonly tokenSetInLocalStorage$ = this.localStorageService.tokenSetInLocalStorage$;

  private _tokenRefreshTimerSubscription!: Subscription;
  private _formRefreshSubscription!: Subscription;
  private readonly _subscriptions = new Subscription();
  private readonly _tokenTimerSubscription = new Subscription();

  constructor(
    private readonly userProviderService: UserProviderService,
    private readonly logger: NGXLogger,
    private readonly stateService: FormIoStateService,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService,
    private readonly localStorageService: FormIoLocalStorageService,
    private readonly modalService: ValtimoModalService,
    private readonly configService: ConfigService
  ) {
    this.setOverrideOptions(configService.config);
  }

  public ngOnInit(): void {
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
    if (changes?.formDefinitionRefresh$) {
      this.unsubscribeFormRefresh();
      this.subscribeFormRefresh();
    }
  }

  public ngOnDestroy(): void {
    this.unsubscribeFormRefresh();
    this._tokenRefreshTimerSubscription?.unsubscribe();
    this._subscriptions.unsubscribe();
    this.localStorageService.clearTokenFromLocalStorage();
  }

  public showErrors(errors: string[]): void {
    this.errors$.next(errors);
  }

  public onSubmit(submission: FormioSubmission): void {
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

  private openReloadFormSubscription(): void {
    this._subscriptions.add(
      this.form$.subscribe(form => {
        this.refreshForm.emit({
          form,
        });
      })
    );
  }

  private openReloadSubmissionSubscription(): void {
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
    Formio.setUser(jwtDecode(token));
    Formio.setToken(token);
    this.setTimerForTokenRefresh(token);
    this.localStorageService.setTokenInLocalStorage(token);

    this.logger.debug('New token set for form.io.');
  }

  private setTimerForTokenRefresh(token: string): void {
    const tokenExp = jwtDecode(token).exp * 1000;
    const expiryTime = tokenExp - Date.now() - 1000;

    this._tokenTimerSubscription.add(
      timer(expiryTime)
        .pipe(
          switchMap(() => this.userProviderService.updateToken(-1)),
          switchMap(() => this.userProviderService.getToken()),
          take(1)
        )
        .subscribe((refreshedToken: string) => {
          this.setToken(refreshedToken);
        })
    );

    this.logger.debug(`Timer for form.io token refresh set for: ${expiryTime}ms.`);
  }

  private subscribeFormRefresh(): void {
    if (this.formRefresh$) {
      this._formRefreshSubscription = this.formRefresh$.subscribe(refreshValue => {
        if (refreshValue) {
          this.refreshForm.emit(refreshValue);
        }
      });
    }
  }

  private unsubscribeFormRefresh(): void {
    if (this._formRefreshSubscription) {
      this._formRefreshSubscription.unsubscribe();
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

  private setOverrideOptions(config: ValtimoConfig): void {
    if (!config.formioOptions) return;

    this._overrideOptions$.next(config.formioOptions);
  }
}
