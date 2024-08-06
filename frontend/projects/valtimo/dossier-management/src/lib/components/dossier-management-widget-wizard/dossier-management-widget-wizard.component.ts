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
import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  Input,
  Output,
  Signal,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import {toObservable} from '@angular/core/rxjs-interop';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {CARBON_CONSTANTS} from '@valtimo/components';
import {ButtonModule, ModalModule, ProgressIndicatorModule, Step} from 'carbon-components-angular';
import {combineLatest, map, Observable} from 'rxjs';
import {WIDGET_STYLE_LABELS, WIDGET_WIDTH_LABELS, WidgetWizardStep} from '../../models';
import {WidgetWizardService} from '../../services';
import {WIDGET_STEPS} from './steps';

@Component({
  selector: 'valtimo-dossier-management-widget-wizard',
  templateUrl: './dossier-management-widget-wizard.component.html',
  styleUrls: ['./dossier-management-widget-wizard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ProgressIndicatorModule,
    ModalModule,
    ButtonModule,
    ...WIDGET_STEPS,
  ],
})
export class DossierManagementWidgetWizardComponent {
  @Input() public open = false;
  private _editMode: boolean;
  @Input() public set editMode(value: boolean) {
    this._editMode = value;
    if (!value) return;

    this.currentStep.set(WidgetWizardStep.WIDTH);
  }
  public get editMode(): boolean {
    return this._editMode;
  }
  @Output() public closeEvent = new EventEmitter<any>();

  public readonly WidgetWizardSteps = WidgetWizardStep;
  private readonly _secondaryLabels = computed(() => {
    const selectedWidgetType = this.widgetWizardService.selectedWidget()?.type ?? '';
    const selectedWidth = this.widgetWizardService.widgetWidth() ?? '';
    const selectedStyle = this.widgetWizardService.widgetStyle() ?? '';

    return {
      [WidgetWizardStep.TYPE]: selectedWidgetType
        ? `widgetTabManagement.types.${selectedWidgetType}.title`
        : '',
      [WidgetWizardStep.WIDTH]: WIDGET_WIDTH_LABELS[selectedWidth] ?? '',
      [WidgetWizardStep.STYLE]: WIDGET_STYLE_LABELS[selectedStyle] ?? '',
    };
  });

  public readonly steps$: Observable<Step[]> = combineLatest([
    toObservable(this._secondaryLabels),
    toObservable(this.widgetWizardService.editMode),
    this.translateService.stream('key'),
  ]).pipe(
    map(([secondaryLabels, editMode]) => {
      return [
        {
          label: this.translateService.instant('widgetTabManagement.wizard.steps.type'),
          ...(secondaryLabels[WidgetWizardStep.TYPE] && {
            secondaryLabel: this.translateService.instant(secondaryLabels[WidgetWizardStep.TYPE]),
          }),
          disabled: editMode,
          complete: editMode,
        },
        {
          label: this.translateService.instant('widgetTabManagement.wizard.steps.width'),
          ...(secondaryLabels[WidgetWizardStep.WIDTH] && {
            secondaryLabel: this.translateService.instant(secondaryLabels[WidgetWizardStep.WIDTH]),
          }),
          disabled: !secondaryLabels[WidgetWizardStep.TYPE],
        },
        {
          label: this.translateService.instant('widgetTabManagement.wizard.steps.style'),
          ...(secondaryLabels[WidgetWizardStep.STYLE] && {
            secondaryLabel: this.translateService.instant(secondaryLabels[WidgetWizardStep.STYLE]),
          }),
          disabled: !secondaryLabels[WidgetWizardStep.WIDTH],
        },
        {
          label: this.translateService.instant('widgetTabManagement.wizard.steps.content'),
          disabled:
            !secondaryLabels[WidgetWizardStep.TYPE] ||
            !secondaryLabels[WidgetWizardStep.WIDTH] ||
            !secondaryLabels[WidgetWizardStep.STYLE],
        },
      ];
    })
  );

  private readonly _contentStepValid = signal<boolean>(false);
  public readonly currentStep = signal<WidgetWizardStep>(WidgetWizardStep.TYPE);
  public readonly backButtonDisabled: Signal<boolean> = computed(
    () =>
      (this.widgetWizardService.editMode() && this.currentStep() === WidgetWizardStep.WIDTH) ||
      this.currentStep() === WidgetWizardStep.TYPE
  );
  public nextButtonDisabled = computed(() => {
    switch (this.currentStep()) {
      case WidgetWizardStep.TYPE:
        return !this.widgetWizardService.selectedWidget();
      case WidgetWizardStep.WIDTH:
        return !this.widgetWizardService.widgetWidth();
      case WidgetWizardStep.STYLE:
        return this.widgetWizardService.widgetStyle() === null;
      case WidgetWizardStep.CONTENT:
        return this.widgetWizardService.widgetContent() === null || !this._contentStepValid();
      default:
        return true;
    }
  });

  constructor(
    private readonly translateService: TranslateService,
    private readonly widgetWizardService: WidgetWizardService
  ) {}

  public onStepSelected(event: {step: Step; index: WidgetWizardStep}): void {
    this.currentStep.set(event.index);
  }

  public onNextButtonClick(): void {
    if (this.currentStep() === WidgetWizardStep.CONTENT) {
      this.closeEvent.emit(this.widgetWizardService.widgetsConfig());
      this.resetWizard();
      return;
    }

    this.currentStep.update((step: WidgetWizardStep) => step + 1);
  }

  public onBackButtonClick(): void {
    this.currentStep.update((step: WidgetWizardStep) => step - 1);
  }

  public onClose(): void {
    this.closeEvent.emit(null);
    this.resetWizard();
  }

  public onContentValidEvent(valid: boolean): void {
    this._contentStepValid.set(valid);
  }

  private resetWizard(): void {
    setTimeout(() => {
      this.widgetWizardService.resetWizard();
      this.currentStep.set(WidgetWizardStep.TYPE);
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
}
