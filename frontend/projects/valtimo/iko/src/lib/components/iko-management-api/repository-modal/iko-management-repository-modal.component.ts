import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {
  CARBON_CONSTANTS,
  SelectItem,
  SelectModule,
  ValtimoCdsModalDirective,
  AutoKeyInputComponent,
  runAfterCarbonModalClosed,
} from '@valtimo/components';
import {
  ButtonModule,
  IconModule,
  InputModule,
  LayerModule,
  ModalModule,
} from 'carbon-components-angular';
import {BehaviorSubject, filter, map, Observable, startWith, switchMap, tap} from 'rxjs';
import {PropertyField, IkoRepositoryConfigResponse} from '../../../models';
import {IkoManagementApiService} from '../../../services';
import {PropertiesFormComponent} from '../../iko-management-properties/iko-management-properties.component';
import {ConfigService, ModalMode} from '@valtimo/shared';

@Component({
  selector: 'valtimo-iko-management-repository-modal',
  templateUrl: './iko-management-repository-modal.component.html',
  styleUrl: './iko-management-repository-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ModalModule,
    ValtimoCdsModalDirective,
    InputModule,
    ReactiveFormsModule,
    ButtonModule,
    IconModule,
    PropertiesFormComponent,
    SelectModule,
    LayerModule,
    AutoKeyInputComponent,
  ],
})
export class IkoManagementRepositoryModalComponent {
  private readonly _open$ = new BehaviorSubject<boolean>(false);
  @Input() public set open(value: boolean) {
    this._open$.next(value);

    value ? (this.showAutoKey = true) : this.resetForm();
  }
  public get open$(): Observable<boolean> {
    return this._open$.asObservable();
  }

  public readonly $selectedKey = signal<string>('');
  public readonly $prefillData = signal<IkoRepositoryConfigResponse | null>(null);
  @Input() public set prefillData(value: IkoRepositoryConfigResponse | null) {
    this.$prefillData.set(value);
    if (!value) return;
    this.formGroup.patchValue(value);
    this.formGroup.get('key')?.disable();
  }

  private _modalMode: ModalMode = 'add';
  @Input()
  public set modalMode(value: ModalMode) {
    this._modalMode = value;
  }
  public get modalMode(): ModalMode {
    return this._modalMode;
  }
  @Output() public readonly modalClose = new EventEmitter<any | null>();

  public get title(): AbstractControl<string> {
    return this.formGroup.get('title') as AbstractControl<string>;
  }

  public showAutoKey = true;
  public enableIkoType = false;
  public readonly disabled$ = new BehaviorSubject(true);
  private readonly _ikoRepositoryTypes$ = this.ikoManagementApiService.getIkoRepositoryTypes();

  public readonly usedKeys$ = this.ikoManagementApiService
    .getIkoRepositoryConfigs()
    .pipe(map(response => response.content.map(c => c.key)));

  public readonly ikoRepositoryTypeSelectItems$: Observable<SelectItem[]> =
    this._ikoRepositoryTypes$.pipe(
      map(types => Object.keys(types).map(typeKey => ({id: typeKey, text: types[typeKey]}))),
      tap(() => {
        this.disabled$.next(false);
      })
    );
  public formGroup = this.fb.group({
    title: this.fb.control('', Validators.required),
    key: this.fb.control('', Validators.required),
    type: this.fb.control('', Validators.required),
    properties: this.fb.group({}, Validators.required),
  });

  public readonly propertyFields$: Observable<PropertyField[]> = this.formGroup
    .get('type')
    .valueChanges.pipe(
      startWith(this.formGroup.get('type').value),
      tap(_ => this.formGroup.patchValue({properties: {}})),
      filter(type => !!type && !Array.isArray(type)),
      switchMap(type => this.ikoManagementApiService.getIkoRepositoryPropertyFields(type))
    );

  constructor(
    private readonly fb: FormBuilder,
    private readonly ikoManagementApiService: IkoManagementApiService,
    private readonly configService: ConfigService
  ) {
    this.enableIkoType = this.configService.getFeatureToggle('enableIkoType');
  }

  public get properties(): FormGroup | null {
    const properties = this.formGroup.get('properties');
    return !properties ? null : (properties as FormGroup);
  }

  public onCancel(): void {
    this.modalClose.emit(null);
    runAfterCarbonModalClosed(() => {
      this.showAutoKey = false;
    });
  }

  public onSave(): void {
    this.modalClose.emit(this.formGroup.getRawValue());
    runAfterCarbonModalClosed(() => {
      this.showAutoKey = false;
    });
  }

  public getControlInvalid(controlKey: string): boolean {
    if (controlKey === 'type' && !this.enableIkoType) {
      return false;
    }

    const control: AbstractControl | null = this.formGroup.get(controlKey);

    if (!control) {
      return true;
    }

    return !control.valid && !control.pristine;
  }

  private resetForm(): void {
    setTimeout(() => {
      this.formGroup.reset({
        title: '',
        key: '',
        type: 'iko',
        properties: {},
      });
      this.formGroup.get('key')?.enable();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
}
