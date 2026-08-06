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
  OnInit,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import {FormArray, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {Flag16, TrashCan16} from '@carbon/icons';
import {FormFlowRegistryDto} from '@valtimo/shared';
import {TooltipIconModule} from '@valtimo/components';
import {
  ButtonModule,
  DropdownModule,
  IconModule,
  IconService,
  InputModule,
  LayerModule,
  ListItem,
  NotificationAction,
  NotificationModule,
  TagModule,
} from 'carbon-components-angular';
import {Subscription} from 'rxjs';
import {FORM_FLOW_EDITOR_TEST_IDS} from '../../../../../constants';
import {FormFlowEditorFormService} from '../../../../../services/form-flow-editor-form.service';
import {translateWithFallback} from '../../../../../utils';
import {FormFlowExpressionHelpModalComponent} from '../form-flow-expression-help-modal/form-flow-expression-help-modal.component';
import {FormFlowExpressionListComponent} from '../form-flow-expression-list/form-flow-expression-list.component';
import {FormFlowTransitionListComponent} from '../form-flow-transition-list/form-flow-transition-list.component';

/**
 * Detail editor for a single form flow step: its key, title, type with type-specific properties,
 * outgoing transitions and the three lifecycle expression lists.
 */
@Component({
  standalone: true,
  selector: 'valtimo-form-flow-step-detail',
  templateUrl: './form-flow-step-detail.component.html',
  styleUrls: ['./form-flow-step-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ButtonModule,
    DropdownModule,
    IconModule,
    InputModule,
    LayerModule,
    NotificationModule,
    TagModule,
    TooltipIconModule,
    FormFlowExpressionHelpModalComponent,
    FormFlowExpressionListComponent,
    FormFlowTransitionListComponent,
  ],
})
export class FormFlowStepDetailComponent implements OnInit, OnChanges, OnDestroy {
  @Input() public stepGroup!: FormGroup;
  @Input() public registry: FormFlowRegistryDto | null = null;
  @Input() public stepKeys: string[] = [];
  @Input() public formOptions: string[] = [];
  @Input() public componentOptions: string[] = [];
  @Input() public isStartStep = false;
  @Input() public readOnly: boolean | null = false;
  @Input() public duplicateKey = false;

  @Output() public deleteStepEvent = new EventEmitter<void>();
  @Output() public makeStartEvent = new EventEmitter<void>();

  public stepTypeItems: ListItem[] = [];

  public readonly $showHelpModal = signal<boolean>(false);

  // The "how do expressions work" action on the inline help notifications, opening the modal that
  // holds the full explanation.
  public helpActions: NotificationAction[] = [];

  protected readonly testIds = FORM_FLOW_EDITOR_TEST_IDS;

  // Cached per property: the Carbon dropdown resets its visual selection whenever its items array
  // is swapped, so an array is only rebuilt when its options or its selection change.
  private readonly _selectItemsCache = new Map<
    string,
    {options: string[]; value: string; items: ListItem[]}
  >();

  private _typeSubscription = new Subscription();

  constructor(
    private readonly formService: FormFlowEditorFormService,
    private readonly iconService: IconService,
    private readonly translateService: TranslateService
  ) {
    this.iconService.registerAll([Flag16, TrashCan16]);
  }

  public ngOnInit(): void {
    this.helpActions = [
      {
        text: this.translateService.instant('formFlow.uiEditor.help.button'),
        click: () => this.$showHelpModal.set(true),
      },
    ];
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['stepGroup'] || changes['registry'] || changes['componentOptions']) {
      this.buildStepTypeItems();
    }

    if (changes['stepGroup'] || changes['registry']) {
      this.openTypeSubscription();
    }
  }

  public ngOnDestroy(): void {
    this._typeSubscription.unsubscribe();
  }

  public get propertiesGroup(): FormGroup {
    return this.stepGroup.get('properties') as FormGroup;
  }

  public get propertyNames(): string[] {
    return Object.keys(this.propertiesGroup.controls);
  }

  public get transitions(): FormArray {
    return this.stepGroup.get('nextSteps') as FormArray;
  }

  public getExpressions(hook: 'onOpen' | 'onComplete' | 'onBack'): FormArray {
    return this.stepGroup.get(hook) as FormArray;
  }

  public isControlInvalid(name: string): boolean {
    const control = this.stepGroup.get(name);
    return !!control && control.invalid && control.touched;
  }

  public getPropertyLabel(name: string): string {
    return translateWithFallback(
      this.translateService,
      `formFlow.uiEditor.properties.${name}`,
      name
    );
  }

  // The `definition` property of the built-in `form` step type references a form of the
  // surrounding case definition or building block, so it is offered as a choice list.
  public isFormDefinitionProperty(name: string): boolean {
    return name === 'definition' && this.formOptions.length > 0;
  }

  public getFormDefinitionItems(): ListItem[] {
    return this.getSelectItems('definition', this.formOptions);
  }

  // The `componentId` property of the built-in `custom-component` step type references an Angular
  // component registered by the implementation, so the registered ids are offered as a choice list.
  public isCustomComponentProperty(name: string): boolean {
    return name === 'componentId' && this.componentOptions.length > 0;
  }

  public getCustomComponentItems(): ListItem[] {
    return this.getSelectItems('componentId', this.componentOptions);
  }

  private getSelectItems(propertyName: string, options: string[]): ListItem[] {
    const value = this.propertiesGroup.get(propertyName)?.value ?? '';
    const cached = this._selectItemsCache.get(propertyName);
    if (cached && cached.options === options && cached.value === value) {
      return cached.items;
    }

    // A value that is no longer available stays selectable, so opening an older definition never
    // silently changes it.
    const names = options.includes(value) || !value ? options : [...options, value];
    const items = names.map(name => ({content: name, id: name, selected: name === value}));
    this._selectItemsCache.set(propertyName, {options, value, items});
    return items;
  }

  private buildStepTypeItems(): void {
    const registryTypeNames = (this.registry?.stepTypes ?? []).map(stepType => stepType.name);
    const currentTypeName = this.stepGroup?.get('typeName')?.value;
    const typeNames =
      currentTypeName && !registryTypeNames.includes(currentTypeName)
        ? [...registryTypeNames, currentTypeName]
        : registryTypeNames;

    this.stepTypeItems = typeNames.map(name => ({
      content: name,
      id: name,
      selected: name === currentTypeName,
      // `custom-component` steps need a component registered by the implementation; without any,
      // the type cannot be configured (unless the step already uses it).
      disabled:
        name === 'custom-component' &&
        this.componentOptions.length === 0 &&
        currentTypeName !== 'custom-component',
    }));
  }

  public getTypeTooltip(): string {
    const tooltip = this.translateService.instant('formFlow.uiEditor.fieldTooltips.type');

    return this.componentOptions.length === 0
      ? `${tooltip} ${this.translateService.instant('formFlow.uiEditor.fieldTooltips.typeNoComponents')}`
      : tooltip;
  }

  // Selecting another step type swaps the properties group for the controls that type needs,
  // keeping the values of properties both types share.
  private openTypeSubscription(): void {
    this._typeSubscription.unsubscribe();
    this._typeSubscription = new Subscription();

    if (!this.stepGroup || !this.registry) return;

    this._typeSubscription.add(
      this.stepGroup.get('typeName')?.valueChanges.subscribe(typeName => {
        const currentValues = this.propertiesGroup.getRawValue() as Record<string, string>;
        this.stepGroup.setControl(
          'properties',
          this.formService.buildPropertiesGroup(typeName, currentValues, this.registry!)
        );
      })
    );
  }
}
