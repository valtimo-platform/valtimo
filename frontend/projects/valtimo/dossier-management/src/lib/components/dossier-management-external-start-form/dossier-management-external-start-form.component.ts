import {Component, OnDestroy, OnInit} from '@angular/core';
import {BehaviorSubject, filter, map, Observable, Subscription, switchMap, tap} from 'rxjs';
import {CaseSettings, DocumentService} from '@valtimo/document';
import {ActivatedRoute} from '@angular/router';
import {AbstractControl, FormBuilder, Validators} from '@angular/forms';
import {NGXLogger} from 'ngx-logger';
import {TranslateService} from '@ngx-translate/core';
import {NotificationService} from 'carbon-components-angular';
import {CARBON_CONSTANTS} from '@valtimo/components';

@Component({
  selector: 'valtimo-dossier-management-external-start-form',
  templateUrl: './dossier-management-external-start-form.component.html',
  styleUrl: './dossier-management-external-start-form.component.scss',
  providers: [NotificationService],
})
export class DossierManagementExternalStartFormComponent implements OnInit, OnDestroy {
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

  public readonly documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params?.name),
    filter(docDefName => !!docDefName)
  );

  public readonly caseSettings$: BehaviorSubject<CaseSettings> = new BehaviorSubject(null);

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly documentService: DocumentService,
    private readonly fb: FormBuilder,
    private readonly translateService: TranslateService,
    private readonly logger: NGXLogger,
    private readonly notificationService: NotificationService
  ) {}

  public ngOnInit(): void {
    this.logger.debug('External Case Start Form - onInit');

    this._subscriptions.add(
      this.hasExternalForm?.valueChanges.subscribe(isEnabled => {
        if (isEnabled) {
          this.externalFormUrl.enable();
          this.description.enable();
        } else {
          this.form.patchValue({externalFormUrl: '', description: ''});
          this.description.disable();
          this.externalFormUrl.disable();
        }
      })
    );

    this._subscriptions.add(
      this.documentDefinitionName$
        .pipe(
          switchMap(documentDefinitionName =>
            this.documentService.getCaseSettingsForManagement(documentDefinitionName)
          ),
          tap(caseSettings => {
            this.logger.debug('Fetched case definition settings', caseSettings);
            this.caseSettings$.next(caseSettings);
          })
        )
        .subscribe()
    );

    this._subscriptions.add(
      this.caseSettings$.subscribe(caseSettings => {
        if (caseSettings) {
          this.logger.debug('Applying case definition settings to form', caseSettings);
          this.form.setValue({
            hasExternalForm: caseSettings.hasExternalStartForm,
            externalFormUrl: caseSettings.externalStartFormUrl,
            description: caseSettings.externalStartFormDescription,
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
    const caseSettings = this.caseSettings$.getValue();
    this.updateCaseSettings(caseSettings.name, {
      hasExternalStartForm: this.hasExternalForm.value,
      externalStartFormUrl:
        typeof this.externalFormUrl.value === 'string'
          ? this.externalFormUrl.value.trim()
          : this.externalFormUrl.value,
      externalStartFormDescription: this.description.value || '',
    });
  }

  private updateCaseSettings(documentDefinitionName: string, caseSettings: CaseSettings): void {
    this.logger.debug('Updating case definition settings', documentDefinitionName, caseSettings);
    this.documentService
      .patchCaseSettingsForManagement(documentDefinitionName, caseSettings)
      .subscribe({
        next: result => {
          this.logger.debug('Updated case definition settings', result);
          this.caseSettings$.next(result);
        },
        error: e => {
          this.logger.error('An error occurred while updating case definition settings', e);

          this.notificationService.showToast({
            type: 'error',
            duration: CARBON_CONSTANTS.notificationDuration,
            showClose: true,
            title: this.translateService.instant(
              'dossierManagement.externalStartForm.notification.error'
            ),
          });
        },
        complete: () => {
          this.logger.debug('Finished updating case definition settings');

          this.notificationService.showToast({
            type: 'success',
            duration: CARBON_CONSTANTS.notificationDuration,
            showClose: true,
            title: this.translateService.instant(
              'dossierManagement.externalStartForm.notification.success'
            ),
          });
        },
      });
  }
}
