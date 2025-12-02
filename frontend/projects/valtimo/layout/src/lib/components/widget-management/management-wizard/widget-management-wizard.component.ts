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
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  Signal,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import {toObservable} from '@angular/core/rxjs-interop';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {CARBON_CONSTANTS, KeyGeneratorService} from '@valtimo/components';
import {
  ButtonModule,
  ModalModule,
  ProgressIndicatorModule,
  Step,
  TilesModule,
} from 'carbon-components-angular';
import {combineLatest, map, Observable, Subscription, switchMap} from 'rxjs';
import {
  WIDGET_DENSITY_LABELS,
  WIDGET_STYLE_LABELS,
  WIDGET_WIDTH_LABELS,
  WidgetWizardCloseEvent,
  WidgetWizardCloseEventType,
  WidgetWizardStep,
  WIZARD_STEP_COMPONENTS,
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
export class WidgetManagementWizardComponent implements OnDestroy {
  @ViewChild('wizardStepRenderer', {read: ViewContainerRef})
  private readonly _vcr: ViewContainerRef;

  @Input() public open = false;
  @Input() public disableDuplicate = false;

  private get _editMode(): boolean {
    return this.widgetWizardService.$editMode();
  }
  @Input() public set editMode(value: boolean) {
    this.widgetWizardService.$editMode.set(value);
    if (!value) return;
    this.$currentStepIndex.set(
      this.widgetWizardService
        .$widgetWizardSteps()
        .findIndex((step: WidgetWizardStep) => step === WidgetWizardStep.CONTENT)
    );
  }
  public get editMode(): boolean {
    return this._editMode;
  }

  @Output() public closeEvent = new EventEmitter<WidgetWizardCloseEvent>();

  public readonly secondaryLabels$: Observable<Record<string, string>> = combineLatest([
    toObservable(this.widgetWizardService.$selectedWidget),
    toObservable(this.widgetWizardService.$widgetWidth),
    toObservable(this.widgetWizardService.$widgetStyle),
    toObservable(this.widgetWizardService.$widgetDensity),
  ]).pipe(
    map(([selectedWidget, selectedWidth, selectedStyle, selectedDensity]) => {
      const type = selectedWidget?.type ?? '';

      return {
        [WidgetWizardStep.TYPE]: type ? `widgetTabManagement.type.${type}.title` : '',
        [WidgetWizardStep.WIDTH]: WIDGET_WIDTH_LABELS[selectedWidth ?? ''] ?? '',
        [WidgetWizardStep.STYLE]: WIDGET_STYLE_LABELS[selectedStyle ?? ''] ?? '',
        [WidgetWizardStep.DENSITY]: WIDGET_DENSITY_LABELS[selectedDensity ?? ''] ?? '',
      };
    })
  );

  public readonly steps$: Observable<Step[]> = combineLatest([
    toObservable(this.widgetWizardService.$widgetWizardSteps),
    toObservable(this.widgetWizardService.$widgetWizardStepProperties),
    toObservable(this.widgetWizardService.$widgetWizardStepEnableCondition),
    this.secondaryLabels$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([steps, stepProperties, stepEnableConditions, secondaryLabels]) => {
      return steps.reduce<Step[] & {__blocked?: boolean}>(
        (acc, step) => {
          if (acc.__blocked) return acc;

          const enableMeta = stepEnableConditions[step];

          if (enableMeta) {
            const {dependingStep, condition} = enableMeta;
            const dependingComplete = !!stepProperties[dependingStep]?.complete;

            if (!dependingComplete) {
              acc.push({label: '', disabled: true, complete: false});
              acc.__blocked = true;
              return acc;
            }
            if (!condition()) return acc;
          }

          const stepConfig: Step = {
            label: this.translateService.instant(`widgetTabManagement.wizard.steps.${step}`),
            disabled: stepProperties[step]?.disabled,
            complete: stepProperties[step]?.complete,
            ...(!!secondaryLabels[step] && {
              secondaryLabel: this.translateService.instant(secondaryLabels[step]),
            }),
          };

          acc.push(stepConfig);
          return acc;
        },
        [] as Step[] & {__blocked?: boolean}
      );
    })
  );

  public readonly $currentStepIndex = this.widgetWizardService.$currentStepIndex;
  public readonly $numberOfSteps = computed(
    () => this.widgetWizardService.$widgetWizardSteps().length
  );

  public readonly stepLabel$ = toObservable(this.$currentStepIndex).pipe(
    switchMap((stepIndex: number) =>
      this.translateService.stream(
        `widgetTabManagement.${this.widgetWizardService.$widgetWizardSteps()[stepIndex]}.description`
      )
    )
  );

  public readonly $backButtonDisabled: Signal<boolean> = computed(
    () => this.widgetWizardService.$editMode() && this.$currentStepIndex() === 1
  );

  public $nextButtonDisabled = this.widgetWizardService.$nextButtonDisabled;

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly keyGeneratorService: KeyGeneratorService,
    private readonly translateService: TranslateService,
    private readonly widgetWizardService: WidgetWizardService
  ) {
    effect(() => {
      this.cdr.detectChanges();
      this.renderStep(this.$currentStepIndex());
    });
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onStepSelected(event: {step: Step; index: number}): void {
    this.widgetWizardService.$currentStepIndex.set(event.index);
  }

  public onNextButtonClick(): void {
    if (this.$currentStepIndex() === this.$numberOfSteps() - 1) {
      const isDuplicateMode =
        this.editMode && !this.disableDuplicate && !this.widgetWizardService.$widgetKey();

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

    this.widgetWizardService.$currentStepIndex.update((step: number) => step + 1);
  }

  public onBackButtonClick(): void {
    this.widgetWizardService.$currentStepIndex.update((step: number) => step - 1);
  }

  public onClose(): void {
    this.closeEvent.emit({type: WidgetWizardCloseEventType.CANCEL, widget: null});
    this.resetWizard();
  }

  private resetWizard(): void {
    setTimeout(() => {
      this.widgetWizardService.resetWizard();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }

  private renderStep(stepIndex: number): void {
    this._vcr.clear();

    const componentRef = this._vcr.createComponent(
      WIZARD_STEP_COMPONENTS[this.widgetWizardService.$widgetWizardSteps()[stepIndex]]
    );

    componentRef.location.nativeElement.classList.add('valtimo-widget-wizard-step');

    this.cdr.detectChanges();
  }
}
