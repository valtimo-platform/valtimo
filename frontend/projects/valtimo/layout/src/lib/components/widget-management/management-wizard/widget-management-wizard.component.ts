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
import {CARBON_CONSTANTS, KeyGeneratorService} from '@valtimo/components';
import {ButtonModule, ModalModule, ProgressIndicatorModule, Step} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable} from 'rxjs';
import {
  WIDGET_STYLE_LABELS,
  WIDGET_WIDTH_LABELS,
  WidgetWizardCloseEvent,
  WidgetWizardCloseEventType,
  WidgetWizardSteps,
  WidgetWizardStepsNoWidth,
} from '../../../models';
import {WidgetWizardService} from '../../../services';
import {WIDGET_STEPS} from './steps';

@Component({
  selector: 'valtimo-widget-management-wizard',
  templateUrl: './widget-management-wizard.component.html',
  styleUrls: ['./widget-management-wizard.component.scss'],
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
export class WidgetManagementWizardComponent {
  @Input() public open = false;

  public widgetWizardSteps: typeof WidgetWizardSteps | typeof WidgetWizardStepsNoWidth =
    WidgetWizardSteps;

  private readonly _disableWidthStep$ = new BehaviorSubject<boolean>(false);
  private _disableWidthStep = false;
  @Input() public set disableWidthStep(value: boolean) {
    if (!value) return;
    this._disableWidthStep$.next(value);
    this._disableWidthStep = value;
    this.widgetWizardSteps = WidgetWizardStepsNoWidth;
  }

  public get widthStepIndex(): number {
    return !this._disableWidthStep && 'WIDTH' in this.widgetWizardSteps
      ? this.widgetWizardSteps.WIDTH
      : -1;
  }
  public get typeStepIndex(): number {
    return this.widgetWizardSteps.TYPE;
  }
  public contentStepIndex(): number {
    return this.widgetWizardSteps.CONTENT;
  }
  public styleStepIndex(): number {
    return this.widgetWizardSteps.CONTENT;
  }

  private get _editMode(): boolean {
    return this.widgetWizardService.$editMode();
  }
  @Input() public set editMode(value: boolean) {
    this.widgetWizardService.$editMode.set(value);
    console.log('steps', this.widgetWizardSteps);
    if (!value) return;

    this.$currentStep.set(this.widgetWizardSteps.CONTENT);
  }
  public get editMode(): boolean {
    return this._editMode;
  }

  @Output() public closeEvent = new EventEmitter<WidgetWizardCloseEvent>();

  private readonly _secondaryLabels = computed(() => {
    const selectedWidgetType = this.widgetWizardService.$selectedWidget()?.type ?? '';
    const selectedWidth = this.widgetWizardService.$widgetWidth() ?? '';
    const selectedStyle = this.widgetWizardService.$widgetStyle() ?? '';

    return {
      [this.widgetWizardSteps.TYPE]: selectedWidgetType
        ? `widgetTabManagement.types.${selectedWidgetType}.title`
        : '',
      ...('WIDTH' in this.widgetWizardSteps
        ? {[this.widgetWizardSteps.WIDTH]: WIDGET_WIDTH_LABELS[selectedWidth] ?? ''}
        : {}),
      [this.widgetWizardSteps.STYLE]: WIDGET_STYLE_LABELS[selectedStyle] ?? '',
    };
  });

  public readonly steps$: Observable<Step[]> = combineLatest([
    toObservable(this._secondaryLabels),
    toObservable(this.widgetWizardService.$editMode),
    this._disableWidthStep$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([secondaryLabels, editMode, disableWidthStep]) => {
      return [
        {
          label: this.translateService.instant('widgetTabManagement.wizard.steps.type'),
          ...(secondaryLabels[this.widgetWizardSteps.TYPE] && {
            secondaryLabel: this.translateService.instant(
              secondaryLabels[this.widgetWizardSteps.TYPE]
            ),
          }),
          disabled: editMode,
          complete: !!this.widgetWizardService.$selectedWidget()?.type,
        },
        ...(disableWidthStep || !('WIDTH' in this.widgetWizardSteps)
          ? []
          : [
              {
                label: this.translateService.instant('widgetTabManagement.wizard.steps.width'),
                ...(secondaryLabels[this.widgetWizardSteps.WIDTH] && {
                  secondaryLabel: this.translateService.instant(
                    secondaryLabels[this.widgetWizardSteps.WIDTH]
                  ),
                }),
                // voorbeeld: disabled check gebaseerd op TYPE (bestaat in beide varianten)
                disabled: !secondaryLabels[this.widgetWizardSteps.TYPE],
                complete: !!this.widgetWizardService.$widgetWidth(),
              },
            ]),
        {
          label: this.translateService.instant('widgetTabManagement.wizard.steps.style'),
          ...(secondaryLabels[this.widgetWizardSteps.STYLE] && {
            secondaryLabel: this.translateService.instant(
              secondaryLabels[this.widgetWizardSteps.STYLE]
            ),
          }),
          disabled:
            !disableWidthStep && 'WIDTH' in this.widgetWizardSteps
              ? !secondaryLabels[this.widgetWizardSteps.WIDTH]
              : !secondaryLabels[this.widgetWizardSteps.TYPE],
          complete: !!this.widgetWizardService.$widgetStyle(),
        },
        {
          label: this.translateService.instant('widgetTabManagement.wizard.steps.content'),
          disabled:
            !secondaryLabels[this.widgetWizardSteps.TYPE] ||
            (!disableWidthStep && 'WIDTH' in this.widgetWizardSteps
              ? !secondaryLabels[this.widgetWizardSteps.WIDTH]
              : true) ||
            !secondaryLabels[this.widgetWizardSteps.STYLE],
          complete: !!this.widgetWizardService.$widgetContent(),
        },
      ];
    })
  );

  private readonly _$contentStepValid = signal<boolean>(false);
  public readonly $currentStep = signal<number>(this.widgetWizardSteps.TYPE);
  public readonly $backButtonDisabled: Signal<boolean> = computed(() =>
    !this._disableWidthStep && 'WIDTH' in this.widgetWizardSteps
      ? this.widgetWizardService.$editMode() && this.$currentStep() === this.widgetWizardSteps.WIDTH
      : this.widgetWizardService.$editMode() && this.$currentStep() === this.widgetWizardSteps.STYLE
  );
  public $nextButtonDisabled = computed(() => {
    if (!this._disableWidthStep && 'WIDTH' in this.widgetWizardSteps) {
      switch (this.$currentStep()) {
        case this.widgetWizardSteps.TYPE:
          return !this.widgetWizardService.$selectedWidget();
        case this.widgetWizardSteps.WIDTH:
          return !this.widgetWizardService.$widgetWidth();
        case this.widgetWizardSteps.STYLE:
          return this.widgetWizardService.$widgetStyle() === null;
        case this.widgetWizardSteps.CONTENT:
          return this.widgetWizardService.$widgetContent() === null || !this._$contentStepValid();
        default:
          return true;
      }
    }

    switch (this.$currentStep()) {
      case this.widgetWizardSteps.TYPE:
        return !this.widgetWizardService.$selectedWidget();

      case this.widgetWizardSteps.STYLE:
        return this.widgetWizardService.$widgetStyle() === null;
      case this.widgetWizardSteps.CONTENT:
        return this.widgetWizardService.$widgetContent() === null || !this._$contentStepValid();
      default:
        return true;
    }
  });

  constructor(
    private readonly keyGeneratorService: KeyGeneratorService,
    private readonly translateService: TranslateService,
    private readonly widgetWizardService: WidgetWizardService
  ) {}

  public onStepSelected(event: {step: Step; index: number}): void {
    this.$currentStep.set(event.index);
  }

  public onNextButtonClick(): void {
    if (this.$currentStep() === this.widgetWizardSteps.CONTENT) {
      const isDuplicateMode = this.editMode && !this.widgetWizardService.$widgetKey();
      if (isDuplicateMode || !this.editMode) {
        this.widgetWizardService.$widgetKey.set(
          this.keyGeneratorService.getUniqueKey(
            this.widgetWizardService.$widgetTitle() ?? '',
            this.widgetWizardService.$usedWidgetKeys()
          )
        );
      }

      this.closeEvent.emit({
        type:
          this.editMode && !isDuplicateMode
            ? WidgetWizardCloseEventType.EDIT
            : WidgetWizardCloseEventType.CREATE,
        widget: this.widgetWizardService.$widgetsConfig(),
      });
      this.resetWizard();
      return;
    }

    this.$currentStep.update((step: number) => step + 1);
  }

  public onBackButtonClick(): void {
    this.$currentStep.update((step: number) => step - 1);
  }

  public onClose(): void {
    this.closeEvent.emit({type: WidgetWizardCloseEventType.CANCEL, widget: null});
    this.resetWizard();
  }

  public onContentValidEvent(valid: boolean): void {
    this._$contentStepValid.set(valid);
  }

  private resetWizard(): void {
    setTimeout(() => {
      this.widgetWizardService.resetWizard();
      this.$currentStep.set(this.widgetWizardSteps.TYPE);
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
}
