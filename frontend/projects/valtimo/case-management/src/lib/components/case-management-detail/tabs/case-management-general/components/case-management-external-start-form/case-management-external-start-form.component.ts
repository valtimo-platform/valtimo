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
import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {AbstractControl, FormBuilder, Validators} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {CaseSettings, DocumentService} from '@valtimo/document';
import {
  CaseManagementParams,
  getCaseManagementRouteParams,
  GlobalNotificationService,
} from '@valtimo/shared';
import {NGXLogger} from 'ngx-logger';
import {BehaviorSubject, map, Observable, Subscription, switchMap, take, tap} from 'rxjs';

@Component({
  standalone: false,
  selector: 'valtimo-case-management-external-start-form',
  templateUrl: './case-management-external-start-form.component.html',
  styleUrl: './case-management-external-start-form.component.scss',
})
export class CaseManagementExternalStartFormComponent implements OnInit, OnDestroy {
  private _isReadOnly: boolean;
  @Input() public set isReadOnly(value: boolean) {
    this._isReadOnly = value;

    if (value) {
      this.form.get('externalFormUrl')?.disable();
      this.form.get('description')?.disable();
    } else {
      this.form.get('externalFormUrl')?.enable();
      this.form.get('description')?.enable();
    }
  }
  public get isReadOnly(): boolean {
    return this._isReadOnly;
  }

  private readonly _URL_PATTERN = new RegExp(
    '^(https?:\\/\\/)(([a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,}|\\d{1,3}(\\.\\d{1,3}){3})(:\\d+)?(\\/\\S*)?(\\?\\S*)?(#\\S*)?$'
  );

  public readonly form = this.fb.group({
    hasExternalForm: [false],
    externalFormUrl: [
      {value: '', disabled: true},
      [Validators.required, Validators.pattern(this._URL_PATTERN), Validators.maxLength(512)],
    ],
    description: [''],
  });

  public readonly params$: Observable<CaseManagementParams> = getCaseManagementRouteParams(
    this.route
  ).pipe(
    map((params: CaseManagementParams | undefined) => ({
      caseDefinitionKey: params?.caseDefinitionKey ?? '',
      caseDefinitionVersionTag: params?.caseDefinitionVersionTag ?? '',
    }))
  );

  public readonly caseSettings$ = new BehaviorSubject<CaseSettings | null>(null);

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly documentService: DocumentService,
    private readonly fb: FormBuilder,
    private readonly translateService: TranslateService,
    private readonly logger: NGXLogger,
    private readonly globalNotificationService: GlobalNotificationService
  ) {}

  public ngOnInit(): void {
    this.logger.debug('External Case Start Form - onInit');

    this._subscriptions.add(
      this.params$
        .pipe(
          switchMap(params =>
            this.documentService.getCaseSettingsForManagement(
              params.caseDefinitionKey,
              params.caseDefinitionVersionTag
            )
          ),
          tap(caseSettings => {
            this.logger.debug('Fetched case definition settings', caseSettings);
            this.caseSettings$.next(caseSettings);
          })
        )
        .subscribe()
    );

    this._subscriptions.add(
      this.caseSettings$.subscribe((caseSettings: CaseSettings | null) => {
        if (!!caseSettings) {
          this.logger.debug('Applying case definition settings to form', caseSettings);
          this.form.setValue({
            hasExternalForm: caseSettings.hasExternalStartForm ?? false,
            externalFormUrl: caseSettings.externalStartFormUrl ?? '',
            description: caseSettings.externalStartFormDescription ?? '',
          });
        }
      })
    );
  }

  public ngOnDestroy(): void {
    this.logger.debug('External Case Start Form - onDestroy');
    this._subscriptions.unsubscribe();
  }

  public get hasExternalForm(): AbstractControl<boolean> {
    return this.form.get('hasExternalForm');
  }

  public get externalFormUrl(): AbstractControl<string> {
    return this.form.get('externalFormUrl');
  }

  public get description(): AbstractControl<string> {
    return this.form.get('description');
  }

  public onSubmit(): void {
    if (!this.form.valid) return;

    this.logger.debug('Submitted case definition settings form with values:', this.form.value);

    this.params$.pipe(take(1)).subscribe(params => {
      this.updateCaseSettings(params.caseDefinitionKey, params.caseDefinitionVersionTag, {
        hasExternalStartForm: this.hasExternalForm.value,
        externalStartFormUrl:
          typeof this.externalFormUrl.value === 'string'
            ? this.externalFormUrl.value.trim()
            : this.externalFormUrl.value,
        externalStartFormDescription: this.description.value || '',
      });
    });
  }

  private updateCaseSettings(
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string,
    caseSettings: CaseSettings
  ): void {
    this.logger.debug('Updating case definition settings', caseDefinitionKey, caseSettings);
    this.documentService
      .patchCaseSettingsForManagement(caseDefinitionKey, caseDefinitionVersionTag, caseSettings)
      .subscribe({
        next: result => {
          this.logger.debug('Updated case definition settings', result);
          this.caseSettings$.next(result);
        },
        error: e => {
          this.logger.error('An error occurred while updating case definition settings', e);

          this.globalNotificationService.showToast({
            type: 'error',
            title: this.translateService.instant(
              'caseManagement.externalStartForm.notification.error'
            ),
          });
        },
        complete: () => {
          this.logger.debug('Finished updating case definition settings');

          this.globalNotificationService.showToast({
            type: 'success',
            title: this.translateService.instant(
              'caseManagement.externalStartForm.notification.success'
            ),
          });
        },
      });
  }
}
