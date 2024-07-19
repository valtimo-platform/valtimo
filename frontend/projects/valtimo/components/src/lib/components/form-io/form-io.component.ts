/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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
import {Formio, FormioComponent as FormIoSourceComponent, FormioForm} from '@formio/angular';
import {FormioRefreshValue} from '@formio/angular/formio.common';
import jwt_decode from 'jwt-decode';
import {NGXLogger} from 'ngx-logger';
import {from, Subject, Subscription, timer} from 'rxjs';
import {map, switchMap, take} from 'rxjs/operators';
import {FormIoStateService} from './services/form-io-state.service';
import {ActivatedRoute} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';

@Component({
  selector: 'valtimo-form-io',
  templateUrl: './form-io.component.html',
  styleUrls: ['./form-io.component.css'],
})
export class FormioComponent implements OnInit, OnChanges, OnDestroy {
  @Input() form: any;
  @Input() options: ValtimoFormioOptions;
  @Input() submission?: object = {};
  @Input() formRefresh$!: Subject<FormioRefreshValue>;
  // eslint-disable-next-line @angular-eslint/no-output-native
  @Output() submit: EventEmitter<any> = new EventEmitter();
  // eslint-disable-next-line @angular-eslint/no-output-native
  @Output() change: EventEmitter<any> = new EventEmitter();
  refreshForm: EventEmitter<FormioRefreshValue> = new EventEmitter();
  formDefinition: FormioForm;
  public errors: string[] = [];

  private tokenRefreshTimerSubscription: Subscription;
  private formRefreshSubscription: Subscription;

  readonly currentLanguage$ = this.translateService
    .stream('key')
    .pipe(map(() => this.translateService.currentLang));

  constructor(
    private userProviderService: UserProviderService,
    private logger: NGXLogger,
    private readonly stateService: FormIoStateService,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService,
    private readonly modalService: ValtimoModalService
  ) {}

  ngOnInit() {
    Formio.setProjectUrl(location.origin);
    Formio.authUrl = location.origin;

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

  ngOnChanges(changes: SimpleChanges): void {
    this.formDefinition = changes.form.currentValue;
    this.reloadForm();

    this.setInitialToken();

    if (changes.formDefinitionRefresh$) {
      this.unsubscribeFormRefresh();
      this.subscribeFormRefresh();
    }
  }

  ngOnDestroy(): void {
    this.unsubscribeFormRefresh();

    this.tokenRefreshTimerSubscription?.unsubscribe();
  }

  reloadForm() {
    this.refreshForm.emit({
      form: this.formDefinition,
    });
  }

  showErrors(errors: string[]) {
    this.errors = errors;
  }

  onSubmit(submission: FormioSubmission) {
    this.errors = [];
    this.submit.emit(submission);
  }

  formReady(form: FormIoSourceComponent): void {
    this.reloadForm();
    this.stateService.currentForm = form;
  }

  onChange(object: any): void {
    this.change.emit(object);
  }

  nextPage(): void {
    this.scrollToTop();
  }

  prevPage(): void {
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
}
