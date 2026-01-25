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

import {
  Component,
  EventEmitter,
  HostListener,
  Injector,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {ValtimoModalService} from '../../../../services';
import {UserProviderService} from '@valtimo/security';
import {FormioComponent as FormIoSourceComponent, FormioForm} from '@formio/angular';
import {jwtDecode} from 'jwt-decode';
import {NGXLogger} from 'ngx-logger';
import {BehaviorSubject, combineLatest, Subscription, timer} from 'rxjs';
import {distinctUntilChanged, filter, map, switchMap, take, tap} from 'rxjs/operators';
import {ActivatedRoute} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {ConfigService} from '@valtimo/shared';
import {isEqual} from 'lodash';

@Component({
  selector: 'valtimo-form-io',
  templateUrl: './form-io.component.html',
  styleUrls: ['./form-io.component.css'],
  providers: [],
  standalone: false,
})
export class FormioComponent implements OnInit, OnDestroy {
  @Input() set submission(submissionValue: Record<string, unknown>) {
    this.submission$.next(submissionValue);
  }
  @Input() set form(formValue: FormioForm) {
    this._form$.next(formValue);
  }
  @Input() set readOnly(readOnlyValue: boolean) {
    this.readOnly$.next(readOnlyValue);
  }

  // eslint-disable-next-line @angular-eslint/no-output-native
  @Output() submit = new EventEmitter<any>();
  // eslint-disable-next-line @angular-eslint/no-output-native
  @Output() change = new EventEmitter<any>();
  @Output() event = new EventEmitter<any>();

  @HostListener('window:beforeunload', ['$event'])
  private handleBeforeUnload() {}

  public readonly submission$ = new BehaviorSubject<Record<string, unknown>>({});

  private readonly _form$ = new BehaviorSubject<FormioForm>(undefined);

  public readonly form$ = combineLatest([this._form$, this.translateService.stream('key')]).pipe(
    filter(([form]) => !!form),
    distinctUntilChanged((prev, curr) => isEqual(prev, curr))
  );

  public readonly readOnly$ = new BehaviorSubject<boolean>(false);
  public readonly errors$ = new BehaviorSubject<Array<string>>([]);

  public readonly languageEventEmitter = new EventEmitter<string>();

  public readonly currentLanguage$ = this.translateService.stream('key').pipe(
    map(() => this.translateService.currentLang),
    distinctUntilChanged(),
    tap(language => this.languageEventEmitter.emit(language))
  );

  private _tokenRefreshTimerSubscription!: Subscription;
  private _formRefreshSubscription!: Subscription;

  private readonly _subscriptions = new Subscription();
  private readonly _tokenTimerSubscription = new Subscription();

  constructor(
    private readonly userProviderService: UserProviderService,
    private readonly logger: NGXLogger,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService,
    private readonly modalService: ValtimoModalService,
    private readonly configService: ConfigService,
    private readonly injector: Injector
  ) {}

  public ngOnInit(): void {
    this.openRouteSubscription();
    this.errors$.next([]);
    this.setInitialToken();
  }

  public ngOnDestroy(): void {
    this._tokenRefreshTimerSubscription?.unsubscribe();
    this._subscriptions.unsubscribe();
  }

  public showErrors(errors: string[]): void {
    this.errors$.next(errors);
  }

  public onSubmit(submission: Record<string, unknown>): void {
    this.errors$.next([]);
    this.submit.emit(submission);
  }

  public formReady(form: FormIoSourceComponent): void {}

  public onChange(object: any): void {
    this.change.emit(object);
  }

  public onCustomEvent(event: any): void {
    this.event.emit(event);
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
    this.setTimerForTokenRefresh(token);

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

  private openRouteSubscription(): void {
    this._subscriptions.add(
      this.route.params.subscribe(params => {
        const documentDefinitionName = params.documentDefinitionName;
        const documentId = params.documentId;

        if (documentDefinitionName) {
        }

        if (documentId) {
        }
      })
    );
  }
}
