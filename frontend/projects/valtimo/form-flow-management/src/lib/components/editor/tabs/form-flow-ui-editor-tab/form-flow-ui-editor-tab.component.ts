/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import {FormArray, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {EditorModel, FitPageDirective} from '@valtimo/components';
import {FormDefinition, FormManagementService} from '@valtimo/form-management';
import {
  FormFlowRegistryDto,
  getBuildingBlockManagementRouteParams,
  getCaseManagementRouteParams,
  getContextObservable,
} from '@valtimo/shared';
import {LoadingModule, NotificationModule} from 'carbon-components-angular';
import {catchError, map, of, Subscription, switchMap, take} from 'rxjs';
import {FORM_FLOW_EDITOR_TEST_IDS} from '../../../../constants';
import {FormFlowDefinition} from '../../../../models';
import {FormFlowService} from '../../../../services';
import {FormFlowComponentService} from '../../../../services/form-flow-component.service';
import {FormFlowEditorFormService} from '../../../../services/form-flow-editor-form.service';
import {FormFlowStepDetailComponent} from './form-flow-step-detail/form-flow-step-detail.component';
import {
  FormFlowStepListComponent,
  FormFlowStepListItem,
} from './form-flow-step-list/form-flow-step-list.component';

/**
 * The visual form flow editor. Renders the definition as a step list with a detail panel and emits
 * the modified definition as JSON through the same contract as the JSON editor tab, so the
 * surrounding editor page treats both tabs identically.
 */
@Component({
  standalone: true,
  selector: 'valtimo-form-flow-ui-editor-tab',
  templateUrl: './form-flow-ui-editor-tab.component.html',
  styleUrls: ['./form-flow-ui-editor-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [FormFlowEditorFormService],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    FitPageDirective,
    LoadingModule,
    NotificationModule,
    FormFlowStepDetailComponent,
    FormFlowStepListComponent,
  ],
})
export class FormFlowUiEditorTabComponent implements OnChanges, OnDestroy {
  @Input() public model: EditorModel | null = null;
  @Input() public readOnly: boolean | null = false;
  /** The parent's save-attempt state: while false the admin is still modelling and no validation
   * errors are shown; a save attempt flips it and reveals them. */
  @Input() public revealErrors = false;

  @Output() public validEvent = new EventEmitter<boolean>();
  @Output() public valueChangeEvent = new EventEmitter<string>();

  public form: FormGroup | null = null;
  public registry: FormFlowRegistryDto | null = null;

  public readonly $selectedIndex = signal<number | null>(null);
  public readonly $stepListItems = signal<FormFlowStepListItem[]>([]);
  // Only replaced when the keys themselves change: the Carbon dropdown resets its visual
  // selection whenever its items array is swapped, so a stable reference prevents flicker while
  // typing in unrelated fields.
  public readonly $stepKeys = signal<string[]>([]);
  public readonly $formOptions = signal<string[]>([]);
  public readonly $componentOptions = signal<string[]>([]);
  public readonly $definitionErrors = signal<string[]>([]);
  public readonly $parseFailed = signal<boolean>(false);

  protected readonly testIds = FORM_FLOW_EDITOR_TEST_IDS;

  private _definition: FormFlowDefinition | null = null;
  private _definitionKey = '';
  private _previousStepKeys: string[] = [];
  private _formSubscriptions = new Subscription();
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly formService: FormFlowEditorFormService,
    private readonly formFlowService: FormFlowService,
    private readonly formFlowComponentService: FormFlowComponentService,
    private readonly formManagementService: FormManagementService,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService
  ) {
    this._subscriptions.add(
      this.formFlowService.getFormFlowRegistry().subscribe(registry => {
        this.registry = registry;
        this.buildForm();
      })
    );

    // The custom Angular components an implementation has registered for `custom-component`
    // steps. The editor offers their ids as choices.
    this._subscriptions.add(
      this.formFlowComponentService.supportedComponents$
        .pipe(take(1))
        .subscribe(components =>
          this.$componentOptions.set(components.map(component => component.id).sort())
        )
    );

    this.loadFormOptions();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['model']) {
      this.parseModel();
      this.buildForm();
    }

    if (changes['readOnly'] && !changes['readOnly'].firstChange) {
      this.applyReadOnly();
    }
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this._formSubscriptions.unsubscribe();
  }

  public get selectedStepGroup(): FormGroup | null {
    const index = this.$selectedIndex();
    if (this.form === null || index === null) return null;

    return (this.stepsArray.controls[index] as FormGroup) ?? null;
  }

  public isSelectedKeyDuplicate(): boolean {
    const index = this.$selectedIndex();
    if (index === null) return false;

    const keys = this.stepsArray.controls.map(stepGroup => stepGroup.get('key')?.value);
    return keys.filter(key => key === keys[index]).length > 1;
  }

  public isSelectedStepStart(): boolean {
    return (
      !!this.selectedStepGroup &&
      this.selectedStepGroup.get('key')?.value === this.form?.get('startStep')?.value
    );
  }

  public onMakeStartStep(): void {
    const key = this.selectedStepGroup?.get('key')?.value;
    if (key) {
      this.form?.get('startStep')?.setValue(key);
      this.form?.get('startStep')?.markAsDirty();
    }
  }

  public onSelectStep(index: number): void {
    this.$selectedIndex.set(index);
  }

  public onAddStep(): void {
    if (!this.form || !this.registry) return;

    const existingKeys = this.stepsArray.controls.map(stepGroup => stepGroup.get('key')?.value);
    this.stepsArray.push(this.formService.buildNewStepGroup(existingKeys, this.registry));
    this.stepsArray.markAsDirty();
    this.$selectedIndex.set(this.stepsArray.length - 1);
  }

  public onDeleteStep(): void {
    const index = this.$selectedIndex();
    if (index === null || !this.form) return;

    const deletedKey = this.stepsArray.at(index).get('key')?.value;
    this.stepsArray.removeAt(index);
    this.stepsArray.markAsDirty();

    // Deleting the start step promotes the first remaining step, so the definition stays valid.
    const startStepControl = this.form.get('startStep');
    if (startStepControl?.value === deletedKey) {
      startStepControl.setValue(this.stepsArray.at(0)?.get('key')?.value ?? '');
    }

    if (this.stepsArray.length === 0) {
      this.$selectedIndex.set(null);
    } else {
      this.$selectedIndex.set(Math.min(index, this.stepsArray.length - 1));
    }
  }

  private get stepsArray(): FormArray {
    return this.formService.getStepsArray(this.form!);
  }

  private parseModel(): void {
    this._definition = null;
    this.$parseFailed.set(false);

    if (!this.model?.value) return;

    try {
      this._definition = JSON.parse(this.model.value) as FormFlowDefinition;
      this._definitionKey = this._definition.key;
    } catch {
      this.$parseFailed.set(true);
    }
  }

  private buildForm(): void {
    if (!this._definition || !this.registry) return;

    this._formSubscriptions.unsubscribe();
    this._formSubscriptions = new Subscription();

    this.form = this.formService.buildDefinitionForm(this._definition, this.registry);
    this._previousStepKeys = this.currentStepKeys();
    this.applyReadOnly();
    this.selectInitialStep();
    this.refreshDerivedState();

    // The initial emission is the container's clean baseline; every change after that re-emits the
    // serialized definition and its validity, mirroring the JSON editor tab.
    this.emitState();

    // Validity only changes together with values (validators run on value changes and the
    // readOnly enable/disable path suppresses events), so valueChanges alone keeps every derived
    // signal fresh.
    this._formSubscriptions.add(
      this.form.valueChanges.subscribe(() => {
        this.trackStepKeyRenames();
        this.refreshDerivedState();
        this.emitState();
      })
    );
  }

  private selectInitialStep(): void {
    const startStep = this._definition?.startStep;
    const startIndex = (this._definition?.steps ?? []).findIndex(step => step.key === startStep);

    if ((this._definition?.steps ?? []).length === 0) {
      this.$selectedIndex.set(null);
      return;
    }

    this.$selectedIndex.set(startIndex >= 0 ? startIndex : 0);
  }

  private applyReadOnly(): void {
    if (!this.form) return;

    if (this.readOnly) {
      this.form.disable({emitEvent: false});
    } else {
      this.form.enable({emitEvent: false});
    }
  }

  // Renaming a step key rewrites the start step and every transition that targeted the old key, so
  // the definition never breaks while typing a new key.
  private trackStepKeyRenames(): void {
    const currentKeys = this.currentStepKeys();

    if (currentKeys.length === this._previousStepKeys.length) {
      const changedIndices = currentKeys
        .map((key, index) => (key !== this._previousStepKeys[index] ? index : -1))
        .filter(index => index !== -1);

      if (changedIndices.length === 1) {
        const index = changedIndices[0];
        this.formService.renameStepReferences(
          this.form!,
          this._previousStepKeys[index],
          currentKeys[index]
        );
      }
    }

    this._previousStepKeys = currentKeys;
  }

  private currentStepKeys(): string[] {
    return this.stepsArray.controls.map(stepGroup => stepGroup.get('key')?.value ?? '');
  }

  private refreshDerivedState(): void {
    if (!this.form) return;

    const startStep = this.form.get('startStep')?.value;
    const keys = this.currentStepKeys();

    this.$stepListItems.set(
      this.stepsArray.controls.map(stepGroup => ({
        key: stepGroup.get('key')?.value ?? '',
        title: stepGroup.get('title')?.value ?? '',
        typeName: stepGroup.get('typeName')?.value ?? '',
        isStart: stepGroup.get('key')?.value === startStep,
        invalid: stepGroup.invalid,
      }))
    );

    if (!this.arraysEqual(keys, this.$stepKeys())) {
      this.$stepKeys.set(keys);
    }

    this.$definitionErrors.set(this.collectDefinitionErrors());
  }

  // Loads the form definitions of the surrounding case definition or building block, so the
  // `form` step type can offer them as choices instead of a free-text form key.
  private loadFormOptions(): void {
    this._subscriptions.add(
      getContextObservable(this.route)
        .pipe(
          take(1),
          switchMap(context => {
            if (context === 'buildingBlock') {
              return getBuildingBlockManagementRouteParams(this.route).pipe(
                take(1),
                switchMap(params =>
                  this.formManagementService.queryFormDefinitionsBuildingBlock(
                    params?.buildingBlockDefinitionKey ?? '',
                    params?.buildingBlockDefinitionVersionTag ?? '',
                    {size: 1000}
                  )
                ),
                map(page => page.content)
              );
            }

            return getCaseManagementRouteParams(this.route).pipe(
              take(1),
              switchMap(params =>
                this.formManagementService.queryFormDefinitionsCase(
                  params?.caseDefinitionKey ?? '',
                  params?.caseDefinitionVersionTag ?? '',
                  {size: 1000}
                )
              ),
              map(response => response.content as unknown as FormDefinition[])
            );
          }),
          map(formDefinitions =>
            [...new Set(formDefinitions.map(definition => definition.name).filter(Boolean))].sort()
          ),
          catchError(() => of([] as string[]))
        )
        .subscribe(names => this.$formOptions.set(names))
    );
  }

  private arraysEqual(left: string[], right: string[]): boolean {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  private collectDefinitionErrors(): string[] {
    const errors: string[] = [];
    const formErrors = this.form?.errors ?? {};
    const stepErrors = this.form?.get('steps')?.errors ?? {};

    if (stepErrors['duplicateStepKeys']) {
      errors.push(
        this.translateService.instant('formFlow.uiEditor.errors.duplicateKeys', {
          keys: stepErrors['duplicateStepKeys'].keys.join(', '),
        })
      );
    }

    if (formErrors['startStepMissing']) {
      errors.push(
        this.translateService.instant('formFlow.uiEditor.errors.startStepMissing', {
          startStep: formErrors['startStepMissing'].startStep,
        })
      );
    }

    if (formErrors['unknownTransitionTargets']) {
      errors.push(
        this.translateService.instant('formFlow.uiEditor.errors.unknownTargets', {
          targets: formErrors['unknownTransitionTargets'].targets.join(', '),
        })
      );
    }

    // A step can be invalid on its own — a missing type, an unselected form, an empty transition
    // target or expression — which the definition-level checks above never name. `invalid` (not
    // `!valid`) skips disabled controls, so a read-only flow is never reported as incomplete; this
    // mirrors the warning icon shown per step. The notification is only *shown* after a save attempt
    // (see `revealErrors` in the template), so collecting these stays quiet while modelling.
    (this.form?.get('steps') as FormArray | null)?.controls.forEach((stepGroup, index) => {
      if (!stepGroup.invalid) return;
      const key = (stepGroup.get('key')?.value ?? '').trim();
      errors.push(
        this.translateService.instant('formFlow.uiEditor.errors.stepIncomplete', {
          step: key || `#${index + 1}`,
        })
      );
    });

    return errors;
  }

  private emitState(): void {
    if (!this.form) return;

    const definition = this.formService.serialize(this.form, this._definitionKey);
    this.valueChangeEvent.emit(JSON.stringify(definition));
    this.validEvent.emit(this.form.valid);
  }
}
