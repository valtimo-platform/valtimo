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
  OnDestroy,
  OnInit,
  Output,
  Signal,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import {toObservable} from '@angular/core/rxjs-interop';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {CARBON_CONSTANTS, KeyGeneratorService} from '@valtimo/components';
import {ButtonModule, ModalModule, ProgressIndicatorModule, Step} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable, Subscription} from 'rxjs';
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
export class WidgetManagementWizardComponent implements OnInit, OnDestroy {
  @Input() public open = false;

  private readonly _widgetWizardSteps$ = new BehaviorSubject<
    typeof WidgetWizardSteps | typeof WidgetWizardStepsNoWidth
  >(WidgetWizardSteps);
  public widgetWizardSteps: typeof WidgetWizardSteps | typeof WidgetWizardStepsNoWidth =
    WidgetWizardSteps;

  private readonly _disableWidthStep$ = new BehaviorSubject<boolean>(false);
  private _disableWidthStep = false;

  @Input() public set disableWidthStep(value: boolean) {
    if (!value) return;
    this._disableWidthStep$.next(value);
    this._disableWidthStep = value;
    this.widgetWizardSteps = WidgetWizardStepsNoWidth;
    this._widgetWizardSteps$.next(WidgetWizardStepsNoWidth);
    this.widgetWizardService.$widgetWidth.set(4);
  }

  @Input() public disableDuplicate = false;
  @Input() public disableTitleInput = false;

  private hasWidth(
    s: typeof WidgetWizardSteps | typeof WidgetWizardStepsNoWidth
  ): s is typeof WidgetWizardSteps {
    return 'WIDTH' in s;
  }

  public get typeStepIndex(): number {
    return this.widgetWizardSteps.TYPE;
  }
  public readonly typeStepIndex$: Observable<number> = this._disableWidthStep$.pipe(
    map(() => this.typeStepIndex)
  );
  public get widthStepIndex(): number {
    return !this._disableWidthStep && this.hasWidth(this.widgetWizardSteps)
      ? this.widgetWizardSteps.WIDTH
      : -1;
  }
  public readonly widthStepIndex$: Observable<number> = this._disableWidthStep$.pipe(
    map(() => this.widthStepIndex)
  );
  public get styleStepIndex(): number {
    return this.widgetWizardSteps.STYLE;
  }
  public readonly styleStepIndex$: Observable<number> = this._disableWidthStep$.pipe(
    map(() => this.styleStepIndex)
  );
  public get contentStepIndex(): number {
    return this.widgetWizardSteps.CONTENT;
  }
  public readonly contentStepIndex$: Observable<number> = this._disableWidthStep$.pipe(
    map(() => this.contentStepIndex)
  );

  private get _editMode(): boolean {
    return this.widgetWizardService.$editMode();
  }
  @Input() public set editMode(value: boolean) {
    this.widgetWizardService.$editMode.set(value);
  }
  public get editMode(): boolean {
    return this._editMode;
  }

  @Output() public closeEvent = new EventEmitter<WidgetWizardCloseEvent>();

  public readonly secondaryLabels$: Observable<Record<number, string>> = combineLatest([
    toObservable(this.widgetWizardService.$selectedWidget),
    toObservable(this.widgetWizardService.$widgetWidth),
    toObservable(this.widgetWizardService.$widgetStyle),
    this._widgetWizardSteps$,
  ]).pipe(
    map(([selectedWidget, selectedWidth, selectedStyle, widgetWizardSteps]) => {
      const type = selectedWidget?.type ?? '';
      const width = selectedWidth ?? '';
      const style = selectedStyle ?? '';

      return {
        [widgetWizardSteps.TYPE]: type ? `widgetTabManagement.types.${type}.title` : '',
        ...('WIDTH' in widgetWizardSteps
          ? {[widgetWizardSteps.WIDTH]: WIDGET_WIDTH_LABELS[width] ?? ''}
          : {}),
        [widgetWizardSteps.STYLE]: WIDGET_STYLE_LABELS[style] ?? '',
      };
    })
  );

  public readonly steps$: Observable<Step[]> = combineLatest([
    this.secondaryLabels$,
    toObservable(this.widgetWizardService.$editMode),
    this._disableWidthStep$,
    this._widgetWizardSteps$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([secondaryLabels, editMode, disableWidthStep, widgetWizardSteps]) => {
      return [
        {
          label: this.translateService.instant('widgetTabManagement.wizard.steps.type'),
          ...(secondaryLabels[widgetWizardSteps.TYPE] && {
            secondaryLabel: this.translateService.instant(secondaryLabels[widgetWizardSteps.TYPE]),
          }),
          disabled: editMode,
          complete: !!this.widgetWizardService.$selectedWidget()?.type,
        },
        ...(disableWidthStep || !this.hasWidth(widgetWizardSteps)
          ? []
          : [
              {
                label: this.translateService.instant('widgetTabManagement.wizard.steps.width'),
                ...(secondaryLabels[widgetWizardSteps.WIDTH] && {
                  secondaryLabel: this.translateService.instant(
                    secondaryLabels[widgetWizardSteps.WIDTH]
                  ),
                }),
                disabled: !secondaryLabels[widgetWizardSteps.TYPE],
                complete: !!this.widgetWizardService.$widgetWidth(),
              },
            ]),
        {
          label: this.translateService.instant('widgetTabManagement.wizard.steps.style'),
          ...(secondaryLabels[widgetWizardSteps.STYLE] && {
            secondaryLabel: this.translateService.instant(secondaryLabels[widgetWizardSteps.STYLE]),
          }),
          disabled:
            !disableWidthStep && this.hasWidth(widgetWizardSteps)
              ? !secondaryLabels[widgetWizardSteps.WIDTH]
              : !secondaryLabels[widgetWizardSteps.TYPE],
          complete: !!this.widgetWizardService.$widgetStyle(),
        },
        {
          label: this.translateService.instant('widgetTabManagement.wizard.steps.content'),
          disabled:
            !secondaryLabels[widgetWizardSteps.TYPE] ||
            (!disableWidthStep && this.hasWidth(widgetWizardSteps)
              ? !secondaryLabels[widgetWizardSteps.WIDTH]
              : true) ||
            !secondaryLabels[widgetWizardSteps.STYLE],
          complete: !!this.widgetWizardService.$widgetContent(),
        },
      ];
    })
  );

  private readonly _$contentStepValid = signal<boolean>(false);
  public readonly $currentStep = signal<number>(this.widgetWizardSteps.TYPE);

  public readonly $backButtonDisabled: Signal<boolean> = computed(() =>
    !this._disableWidthStep && this.hasWidth(this.widgetWizardSteps)
      ? this.widgetWizardService.$editMode() && this.$currentStep() === this.widgetWizardSteps.WIDTH
      : this.widgetWizardService.$editMode() && this.$currentStep() === this.widgetWizardSteps.STYLE
  );

  public $nextButtonDisabled = computed(() => {
    if (!this._disableWidthStep && this.hasWidth(this.widgetWizardSteps)) {
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

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly keyGeneratorService: KeyGeneratorService,
    private readonly translateService: TranslateService,
    private readonly widgetWizardService: WidgetWizardService
  ) {
    this.openLastStepSubscription();
  }

  public ngOnInit(): void {}

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onStepSelected(event: {step: Step; index: number}): void {
    this.$currentStep.set(event.index);
  }

  public onNextButtonClick(): void {
    if (this.$currentStep() === this.contentStepIndex) {
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

  private openLastStepSubscription(): void {
    this._subscriptions.add(
      combineLatest([
        toObservable(this.widgetWizardService.$editMode),
        this._widgetWizardSteps$,
      ]).subscribe(([editMode, steps]) => {
        if (!editMode) return;
        const last = Math.max(
          ...Object.values(steps).filter((v): v is number => typeof v === 'number')
        );
        this.$currentStep.set(last);
      })
    );
  }
}
