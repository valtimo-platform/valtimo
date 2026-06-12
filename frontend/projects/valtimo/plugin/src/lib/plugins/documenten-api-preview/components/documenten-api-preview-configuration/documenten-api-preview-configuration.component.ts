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

import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {PluginConfigurationComponent} from '../../../../models';
import {BehaviorSubject, combineLatest, map, Observable, skip, Subscription, take} from 'rxjs';
import {DocumentenApiPreviewConfig} from '../../models';
import {PluginManagementService, PluginTranslationService} from '../../../../services';
import {TranslateService} from '@ngx-translate/core';
import {SelectItem} from '@valtimo/components';

@Component({
  selector: 'valtimo-documenten-api-preview-configuration',
  templateUrl: './documenten-api-preview-configuration.component.html',
  standalone: false,
})
export class DocumentenApiPreviewConfigurationComponent
  implements PluginConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<DocumentenApiPreviewConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<DocumentenApiPreviewConfig> =
    new EventEmitter<DocumentenApiPreviewConfig>();

  private saveSubscription!: Subscription;
  private _pdfUniversalAccessibilitySubscription!: Subscription;

  private readonly formValue$ = new BehaviorSubject<DocumentenApiPreviewConfig | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  public readonly pdfArchiveMethods: SelectItem[] = [
    {id: 'none', text: 'None', translationKey: 'pdfArchiveMethodNone'},
    {id: 'PDF/A-1b', text: 'PDF/A-1b', translationKey: 'pdfArchiveMethodPdfA1b'},
    {id: 'PDF/A-2b', text: 'PDF/A-2b', translationKey: 'pdfArchiveMethodPdfA2b'},
    {id: 'PDF/A-3b', text: 'PDF/A-3b', translationKey: 'pdfArchiveMethodPdfA3b'},
  ];

  public readonly pdfUniversalAccessibility$ = new BehaviorSubject<boolean>(false);

  public readonly documentenApiPluginSelectItems$: Observable<Array<{id: string; text: string}>> =
    combineLatest([
      this.pluginManagementService.getPluginConfigurationsByPluginDefinitionKey('documentenapi'),
      this.translateService.stream('key'),
    ]).pipe(
      map(([configurations]) =>
        configurations.map(configuration => ({
          id: configuration.id,
          text: `${configuration.title} - ${this.pluginTranslationService.instant(
            'title',
            configuration.pluginDefinition.key
          )}`,
        }))
      )
    );

  constructor(
    private readonly pluginManagementService: PluginManagementService,
    private readonly translateService: TranslateService,
    private readonly pluginTranslationService: PluginTranslationService
  ) {}

  ngOnInit(): void {
    this.initPdfUniversalAccessibilityEnabled();
    this.openPdfUniversalAccessibilitySubscription();
    this.openSaveSubscription();
  }

  ngOnDestroy() {
    this._pdfUniversalAccessibilitySubscription?.unsubscribe();
    this.saveSubscription?.unsubscribe();
  }

  public onPdfUniversalAccessibilityChange(checked: boolean): void {
    this.pdfUniversalAccessibility$.next(checked);
  }

  formValueChange(formValue: DocumentenApiPreviewConfig): void {
    const formValueIncludingToggle = {
      ...formValue,
      pdfUniversalAccessibility: this.pdfUniversalAccessibility$.getValue(),
    };
    this.formValue$.next(formValueIncludingToggle);
    this.handleValid(formValueIncludingToggle);
  }

  private initPdfUniversalAccessibilityEnabled(): void {
    this.prefillConfiguration$?.pipe(take(1)).subscribe(configuration => {
      this.pdfUniversalAccessibility$.next(!!configuration?.pdfUniversalAccessibility);
    });
  }

  private openPdfUniversalAccessibilitySubscription(): void {
    this._pdfUniversalAccessibilitySubscription = this.pdfUniversalAccessibility$
      .pipe(skip(1))
      .subscribe(() => {
        const currentFormValue = this.formValue$.getValue();
        if (currentFormValue) {
          this.formValueChange(currentFormValue);
        }
      });
  }

  private handleValid(formValue: DocumentenApiPreviewConfig): void {
    const valid = !!(
      formValue.configurationTitle &&
      formValue.pdfConversionUrl &&
      formValue.documentenApiConfigurationId
    );

    this.valid$.next(valid);
    this.valid.emit(valid);
  }

  private openSaveSubscription(): void {
    this.saveSubscription = this.save$?.subscribe(save => {
      combineLatest([this.formValue$, this.valid$])
        .pipe(take(1))
        .subscribe(([formValue, valid]) => {
          if (valid) {
            this.configuration.emit(formValue);
          }
        });
    });
  }
}
