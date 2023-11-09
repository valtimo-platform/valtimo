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
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Formio, FormioComponent as FormIoSourceComponent, FormioForm} from '@formio/angular';
import {FormioRefreshValue} from '@formio/angular/formio.common';
import {TranslateService} from '@ngx-translate/core';
import {UserProviderService} from '@valtimo/security';
import jwt_decode from 'jwt-decode';
import {NGXLogger} from 'ngx-logger';
import {Observable, Subject, Subscription, timer} from 'rxjs';
import {distinctUntilChanged, map, switchMap, take} from 'rxjs/operators';
import {FormioSubmission, ValtimoFormioOptions} from '../../models';
import {ValtimoModalService} from '../../services/valtimo-modal.service';
import {FormIoStateService} from './services/form-io-state.service';

@Component({
  selector: 'valtimo-form-io',
  templateUrl: './form-io.component.html',
  styleUrls: ['./form-io.component.css'],
})
export class FormioComponent implements OnInit, OnChanges, OnDestroy {
  @Input() form: any;
  @Input() options: ValtimoFormioOptions;
  @Input() submission?: object = {};
  @Input() readOnly?: boolean;
  @Input() formRefresh$!: Subject<FormioRefreshValue>;
  // eslint-disable-next-line @angular-eslint/no-output-native
  @Output() submit = new EventEmitter<any>();
  // eslint-disable-next-line @angular-eslint/no-output-native
  @Output() change = new EventEmitter<any>();

  @HostListener('window:beforeunload', ['$event'])
  private handleBeforeUnload() {
    this.clearTokenFromLocalStorage();
  }

  public refreshForm = new EventEmitter<FormioRefreshValue>();
  public formDefinition: FormioForm;
  public errors: string[] = [];

  public readonly currentLanguage$ = this.translateService.stream('key').pipe(
    map(() => this.translateService.currentLang),
    distinctUntilChanged()
  );

  public readonly formioOptions$: Observable<ValtimoFormioOptions> = this.currentLanguage$.pipe(
    map(language => {
      const formioTranslations = this.translateService.instant('formioTranslations');
      return typeof formioTranslations === 'object'
        ? {
            ...this.options,
            language,
            i18n: {
              [language]: this.stateService.flattenTranslationsObject(formioTranslations),
            },
          }
        : this.options;
    })
  );

  private _tokenTimerSubscription = new Subscription();
  private _formRefreshSubscription = new Subscription();

  private readonly _FORMIO_TOKEN_LOCAL_STORAGE_KEY = 'formioToken';

  constructor(
    private readonly logger: NGXLogger,
    private readonly modalService: ValtimoModalService,
    private readonly route: ActivatedRoute,
    private readonly stateService: FormIoStateService,
    private readonly translateService: TranslateService,
    private readonly userProviderService: UserProviderService
  ) {}

  public ngOnInit(): void {
    const documentDefinitionName = this.route.snapshot.paramMap.get('documentDefinitionName');
    const documentId = this.route.snapshot.paramMap.get('documentId');

    this.formDefinition = this.form;
    this.errors = [];

    this.setInitialToken();

    if (documentDefinitionName) {
      this.stateService.setDocumentDefinitionName(documentDefinitionName);
    }

    if (documentId) {
      this.stateService.setDocumentId(documentId);
    }

    this.subscribeFormRefresh();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    const currentForm = changes?.form?.currentValue;

    if (currentForm) {
      this.formDefinition = currentForm;
      this.reloadForm();
    }

    if (changes.formDefinitionRefresh$) {
      this._formRefreshSubscription.unsubscribe();
      this.subscribeFormRefresh();
    }
  }

  public ngOnDestroy(): void {
    this._tokenTimerSubscription.unsubscribe();
    this._formRefreshSubscription.unsubscribe();
    this.clearTokenFromLocalStorage();
  }

  public reloadForm(): void {
    this.refreshForm.emit({
      form: this.formDefinition,
    });
  }

  public showErrors(errors: string[]): void {
    this.errors = errors;
  }

  public onSubmit(submission: FormioSubmission): void {
    this.errors = [];
    this.submit.emit(submission);
  }

  public formReady(form: FormIoSourceComponent): void {
    this.reloadForm();
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

  private scrollToTop(): void {
    this.modalService.scrollToTop();
  }

  private setInitialToken(): void {
    this.userProviderService.getToken().then((token: string) => {
      this.setToken(token);
    });
  }

  private setToken(token: string): void {
    Formio.setToken(token);
    localStorage.setItem(this._FORMIO_TOKEN_LOCAL_STORAGE_KEY, token);
    this.setTimerForTokenRefresh(token);

    this.logger.debug('New token set for form.io.');
  }

  private setTimerForTokenRefresh(token: string): void {
    const tokenExp = (jwt_decode(token) as any).exp * 1000;
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
      this._formRefreshSubscription.add(
        this.formRefresh$.subscribe(refreshValue => {
          if (refreshValue) {
            this.refreshForm.emit(refreshValue);
          }
        })
      );
    }
  }

  private clearTokenFromLocalStorage(): void {
    localStorage.removeItem(this._FORMIO_TOKEN_LOCAL_STORAGE_KEY);
  }
}
