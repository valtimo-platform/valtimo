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
  Component,
  EventEmitter,
  forwardRef,
  HostBinding,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  FormBuilder,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {DocumentService} from '@valtimo/document';
import {
  DropdownModule,
  InputModule,
  LayerModule,
  ListItem,
  LoadingModule,
  ToggleModule,
} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  of,
  startWith,
  Subscription,
  switchMap,
  tap,
} from 'rxjs';
import {distinctUntilChanged} from 'rxjs/operators';
import {
  ValuePathItem,
  ValuePathType,
  ValuePathSelectorInputMode,
  ValuePathSelectorNotation,
  ValuePathSelectorPrefix,
} from '../../models';
import {ValuePathSelectorService} from '../../services';
import {InputLabelModule} from '../input-label/input-label.module';

@Component({
  selector: 'valtimo-value-path-selector',
  templateUrl: './value-path-selector.component.html',
  styleUrls: ['./value-path-selector.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    DropdownModule,
    LoadingModule,
    ReactiveFormsModule,
    ToggleModule,
    InputModule,
    InputLabelModule,
    InputLabelModule,
    TranslateModule,
    LayerModule,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: forwardRef(() => ValuePathSelectorComponent),
    },
  ],
})
export class ValuePathSelectorComponent implements OnInit, OnDestroy, ControlValueAccessor {
  @HostBinding('class.value-path-selector--margin-bottom') private _showMargin: boolean = false;
  @HostBinding('class.value-path-selector--margin-bottom-lg') private _showMarginLg: boolean =
    false;
  @HostBinding('class.value-path-selector--margin-bottom-xl') private _showMarginXl: boolean =
    false;
  @HostListener('focusout')
  public onBlur(): void {
    this.onBlurEvent();
  }

  public readonly formGroup = this.formBuilder.group({
    selectedPath: new FormControl(''),
  });

  public get selectedPath(): AbstractControl<string> {
    return this.formGroup.get('selectedPath');
  }

  private _onChangeFunction!: (value: string) => void;
  private _onTouchedFunction!: () => void;

  public get _selectedPath$(): Observable<string> {
    return this.selectedPath.valueChanges.pipe(
      startWith(this.selectedPath.value),
      distinctUntilChanged(),
      tap(value => {
        if (this._onChangeFunction) {
          this._onChangeFunction(value);
        }
      })
    );
  }

  @Input() public name = '';
  @Input() public appendInline = false;
  @Input() public set margin(value: boolean) {
    this._showMargin = value;
  }
  @Input() public set marginLg(value: boolean) {
    this._showMarginLg = value;
  }
  @Input() public set marginXl(value: boolean) {
    this._showMarginXl = value;
  }
  @Input() public set disabled(value: boolean) {
    this.disabled$.next(!!value);

    if (value) {
      this.formGroup.disable();
    } else {
      this.formGroup.enable();
    }
  }
  @Input() public set caseDefinitionKey(value: string) {
    if (!value) return;
    this._caseDefinitionKeySubject$.next(value);
  }
  @Input() public set caseDefinitionVersionTag(value: string) {
    if (!value) return;
    this._caseDefinitionVersionTag$.next(value);
  }
  @Input() public set prefixes(value: ValuePathSelectorPrefix[]) {
    this._prefixes$.next(value ?? []);
  }
  @Input() public label = '';
  @Input() public tooltip = '';
  @Input() public required = false;
  @Input() public showCaseDefinitionSelector = false;
  @Input() public notation: ValuePathSelectorNotation = 'dots';

  @Input() public set defaultValue(value: string) {
    if (!value) return;
    this.selectedPath.setValue(value);
    if (this.showCaseDefinitionSelector) this._inputMode$.next(ValuePathSelectorInputMode.MANUAL);
  }
  private readonly _type$ = new BehaviorSubject<ValuePathType>(ValuePathType.FIELD);
  @Input() public set type(value: ValuePathType) {
    this._type$.next(value);
  }
  private readonly _parentItem$ = new BehaviorSubject<ValuePathItem | null>(null);
  @Input() public set parentItem(value: ValuePathItem | null) {
    this._parentItem$.next(value);
  }
  @Output() valueChangeEvent: EventEmitter<string> = new EventEmitter();
  @Output() collectionSelected: EventEmitter<ValuePathItem> = new EventEmitter();

  private readonly _caseDefinitionKeySubject$ = new BehaviorSubject<string>('');
  private get _caseDefinitionKey$(): Observable<string> {
    return this._caseDefinitionKeySubject$.pipe(filter(value => !!value));
  }
  private readonly _caseDefinitionVersionTag$ = new BehaviorSubject<string | null>(null);
  private readonly _prefixes$ = new BehaviorSubject<ValuePathSelectorPrefix[]>([]);

  private readonly _inputMode$ = new BehaviorSubject<ValuePathSelectorInputMode>(
    ValuePathSelectorInputMode.DROPDOWN
  );
  public inputModeIsDropdown$: Observable<boolean> = this._inputMode$.pipe(
    map(mode => {
      return mode === ValuePathSelectorInputMode.DROPDOWN;
    })
  );

  public readonly loadingValuePathItems$ = new BehaviorSubject<boolean>(true);
  public readonly disabled$ = new BehaviorSubject<boolean>(false);

  private _cachedOptions: (ValuePathItem & {formattedPath: string})[] = [];

  public valuePathListItems$: Observable<ListItem[]> = this._parentItem$.pipe(
    tap(() => this.loadingValuePathItems$.next(true)),
    switchMap((parentItem: ValuePathItem | null) =>
      parentItem
        ? of(parentItem.children?.map((child: string) => ({path: child})) ?? [])
        : combineLatest([
            this._caseDefinitionKey$,
            this._prefixes$,
            this._type$,
            this._caseDefinitionVersionTag$,
          ]).pipe(
            switchMap(([caseDefinitionKey, prefixes, type, caseDefinitionVersionTag]) =>
              this.valuePathSelectorService.getResolvableKeys(
                prefixes,
                caseDefinitionKey,
                type,
                caseDefinitionVersionTag
              )
            )
          )
    ),
    map((results: ValuePathItem[]) =>
      results
        .map((result: ValuePathItem) => ({
          ...result,
          formattedPath: !this._parentItem$.getValue()
            ? this.getFormattedPath(result.path)
            : result.path,
        }))
        .sort((a, b) => a.formattedPath.localeCompare(b.formattedPath))
    ),
    tap(options => (this._cachedOptions = options)),
    switchMap(options =>
      combineLatest([of(options), this._selectedPath$, this.inputModeIsDropdown$])
    ),
    tap(([options, selectedPath, inputModeIsDropdown]) => {
      const formattedOptions = options.map(option => option.formattedPath);
      if (!formattedOptions.includes(selectedPath) && !!selectedPath && inputModeIsDropdown)
        this._inputMode$.next(ValuePathSelectorInputMode.MANUAL);
    }),
    map(([options, selectedPath]) =>
      options.map(option => {
        const mappedOption = {
          content: option.formattedPath,
          selected: option.formattedPath === selectedPath,
          path: option.path,
          ...(!!option.children && {children: option.children}),
        };

        if (mappedOption.selected) this.onPathSelected({item: mappedOption});
        return mappedOption;
      })
    ),
    tap(() => this.loadingValuePathItems$.next(false))
  );

  public readonly loadingCaseDefinitionItems$ = new BehaviorSubject<boolean>(true);

  public readonly caseDefinitionListItems$: Observable<ListItem[]> = this.valuePathSelectorService
    .getCaseDefinitionCache()
    .pipe(
      switchMap(cache =>
        combineLatest([
          cache ? of(cache) : this.documentService.getCaseDefinitions({active: true}),
          this._caseDefinitionKey$.pipe(startWith(null)),
        ]).pipe(
          tap(([definitions]) => {
            this.loadingCaseDefinitionItems$.next(false);
            this.valuePathSelectorService.setCaseDefinitionCache(definitions);
          }),
          map(([definitions, caseDefinitionKey]) =>
            definitions.map(definition => ({
              content: definition.caseDefinitionKey,
              id: definition.caseDefinitionKey,
              selected: definition.caseDefinitionKey === caseDefinitionKey,
            }))
          )
        )
      )
    );

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly valuePathSelectorService: ValuePathSelectorService,
    private readonly formBuilder: FormBuilder,
    private readonly documentService: DocumentService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this._selectedPath$.subscribe(path => this.valueChangeEvent.emit(path))
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public writeValue(value: string) {
    this.selectedPath.setValue(value);
  }

  public registerOnChange(fn: (value: string) => void): void {
    this._onChangeFunction = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this._onTouchedFunction = fn;
  }

  public onBlurEvent(): void {
    if (!this._onTouchedFunction) return;

    this._onTouchedFunction();
  }

  public setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.formGroup.disable();
    } else {
      this.formGroup.enable();
    }
  }

  public onPathSelected(event: {item: {content: string} & ValuePathItem}): void {
    const selectedPath = event?.item?.content;
    if (!selectedPath) return;

    if (this.collectionSelected.observed) this.collectionSelected.emit(event.item);

    this.selectedPath.setValue(selectedPath);
  }

  public onCaseDefinitionSelected(event: {item: {id: string}}): void {
    const selectedDef = event?.item?.id;
    if (!selectedDef) return;
    this.selectedPath.setValue('');
    this._caseDefinitionKeySubject$.next(selectedDef);
  }

  public onInputModeChange(toDropdownMode: boolean): void {
    const currentPathValue = this.selectedPath.value;

    if (
      toDropdownMode &&
      !this._cachedOptions.map(option => option.formattedPath).includes(currentPathValue)
    ) {
      this.selectedPath.setValue('');
    }

    this._inputMode$.next(
      toDropdownMode ? ValuePathSelectorInputMode.DROPDOWN : ValuePathSelectorInputMode.MANUAL
    );
  }

  private getFormattedPath(unformattedPath: string): string {
    const splitPathPrefix = unformattedPath.split(':');
    const prefix = splitPathPrefix[0];
    const remainingPath = splitPathPrefix[1];
    const requiredNotation = this.notation;
    const pathNotation: ValuePathSelectorNotation = remainingPath.includes('/')
      ? 'slashes'
      : 'dots';
    const splitPath = remainingPath
      .split(pathNotation === 'slashes' ? '/' : '.')
      .filter(pathPart => pathPart !== '/' && pathPart !== '.')
      .filter(pathPart => !!pathPart)
      .map(pathPart => pathPart.replace('/', '').replace('.', ''));
    const formattedPath = splitPath.reduce(
      (acc, pathPart) => `${acc}${requiredNotation === 'slashes' ? '/' : '.'}${pathPart}`,
      ''
    );

    return `${prefix}:${requiredNotation === 'dots' ? formattedPath.substring(1) : formattedPath}`;
  }
}
