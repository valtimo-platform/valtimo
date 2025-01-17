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
import {CommonModule} from '@angular/common';
import {ValuePathSelectorService} from '../../services';
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
import {
  ValuePathSelectorInputMode,
  ValuePathSelectorNotation,
  ValuePathSelectorPrefix,
} from '../../models/value-path-selector.model';
import {
  DropdownModule,
  InputModule,
  ListItem,
  LoadingModule,
  ToggleModule,
} from 'carbon-components-angular';
import {
  AbstractControl,
  ControlValueAccessor,
  FormBuilder,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import {InputLabelModule} from '../input-label/input-label.module';
import {TranslateModule} from '@ngx-translate/core';
import {DocumentService} from '@valtimo/document';
import {distinctUntilChanged} from 'rxjs/operators';

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
  @Input() public set documentDefinitionName(value: string) {
    if (!value) return;
    this._documentDefinitionNameSubject$.next(value);
  }
  @Input() public set version(value: number) {
    if (!value) return;
    this._version$.next(value);
  }
  @Input() public set prefixes(value: ValuePathSelectorPrefix[]) {
    if (!value) return;
    this._prefixesSubject$.next(value);
  }
  @Input() public label = '';
  @Input() public tooltip = '';
  @Input() public required = false;
  @Input() public showDocumentDefinitionSelector = false;
  @Input() public notation: ValuePathSelectorNotation = 'dots';

  @Input() public set defaultValue(value: string) {
    if (!value) return;
    this.selectedPath.setValue(value);
    if (this.showDocumentDefinitionSelector)
      this._inputMode$.next(ValuePathSelectorInputMode.MANUAL);
  }
  @Output() valueChangeEvent: EventEmitter<string> = new EventEmitter();

  private readonly _documentDefinitionNameSubject$ = new BehaviorSubject<string>('');
  private get _documentDefinitionName$(): Observable<string> {
    return this._documentDefinitionNameSubject$.pipe(filter(value => !!value));
  }
  private readonly _version$ = new BehaviorSubject<number | null>(null);
  private readonly _prefixesSubject$ = new BehaviorSubject<ValuePathSelectorPrefix[] | null>(null);
  private get _prefixes$(): Observable<ValuePathSelectorPrefix[]> {
    return this._prefixesSubject$.pipe(filter(value => !!value));
  }

  private readonly _inputMode$ = new BehaviorSubject<ValuePathSelectorInputMode>(
    ValuePathSelectorInputMode.DROPDOWN
  );
  public get inputModeIsDropdown$(): Observable<boolean> {
    return this._inputMode$.pipe(map(mode => mode === ValuePathSelectorInputMode.DROPDOWN));
  }

  public readonly loadingValuePathItems$ = new BehaviorSubject<boolean>(true);
  public readonly disabled$ = new BehaviorSubject<boolean>(false);

  private _cachedOptions: string[] = [];

  public valuePathListItems$: Observable<ListItem[]> = combineLatest([
    this._documentDefinitionName$,
    this._prefixes$,
    this._version$,
  ]).pipe(
    tap(() => this.loadingValuePathItems$.next(true)),
    switchMap(([documentDefinitionName, prefixes, version]) =>
      typeof version === 'number'
        ? this.valuePathSelectorService.getResolvableKeysPerPrefix(
            prefixes,
            documentDefinitionName,
            version
          )
        : this.valuePathSelectorService.getResolvableKeysPerPrefix(prefixes, documentDefinitionName)
    ),
    map(result =>
      result.map(path => this.getFormattedPath(path)).sort((a, b) => a.localeCompare(b))
    ),
    tap(options => (this._cachedOptions = options)),
    switchMap(options =>
      combineLatest([of(options), this._selectedPath$, this.inputModeIsDropdown$])
    ),
    tap(([options, selectedPath, inputModeIsDropdown]) => {
      if (!options.includes(selectedPath) && !!selectedPath && inputModeIsDropdown)
        this._inputMode$.next(ValuePathSelectorInputMode.MANUAL);
    }),
    map(([options, selectedPath]) =>
      options.map(option => ({content: option, selected: option === selectedPath}))
    ),
    tap(() => this.loadingValuePathItems$.next(false))
  );

  public readonly loadingDocumentDefinitionItems$ = new BehaviorSubject<boolean>(true);

  public readonly documentDefinitionListItems$: Observable<ListItem[]> =
    this.valuePathSelectorService.getDocumentDefinitionCache().pipe(
      switchMap(cache =>
        combineLatest([
          cache ? of(cache) : this.documentService.getAllDefinitions(),
          this._documentDefinitionName$.pipe(startWith(null)),
        ]).pipe(
          tap(([definitions]) => {
            this.loadingDocumentDefinitionItems$.next(false);
            this.valuePathSelectorService.setDocumentDefinitionCache(definitions);
          }),
          map(([definitions, documentDefinitionName]) =>
            definitions.content.map(definition => ({
              content: definition.id.name,
              id: definition.id.name,
              selected: definition.id.name === documentDefinitionName,
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

  public onPathSelected(event: {item: {content: string}}): void {
    const selectedPath = event?.item?.content;
    if (!selectedPath) return;
    this.selectedPath.setValue(selectedPath);
  }

  public onDocumentDefinitionSelected(event: {item: {id: string}}): void {
    const selectedDef = event?.item?.id;
    if (!selectedDef) return;
    this.selectedPath.setValue('');
    this._documentDefinitionNameSubject$.next(selectedDef);
  }

  public onInputModeChange(toDropdownMode: boolean): void {
    const currentPathValue = this.selectedPath.value;

    if (toDropdownMode && !this._cachedOptions.includes(currentPathValue)) {
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
