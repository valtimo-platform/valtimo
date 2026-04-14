# Coding guidelines

In order to contribute to this project, please follow the below code formatting guidelines.

## Testing

For the project policy regarding testing, please refer to
[the following documentation](./TESTING-POLICY.md).

## Template

### Attribute sorting

On an element inside your template code, we recommend you keep to the following sorting of
attributes:

- Structural directives like `*ngIf` and `*ngFor`
- Angular directives such as `ngStyle` and `ngClass`
- Inputs sorted alphabetically
- Outputs sorted alphabetically
- Other attributes like `class`, `tabIndex` etc. - sorted alphabetically

### Whitespace between siblings

If two elements are on the same level in the DOM hierarchy, put whitespace between these elements,
in order to improve readability.

#### **`test.component.html`**

```angular2html
<div>
  <p>test</p>
  <!-- whitespace -->
  <p>test 2</p>
</div>
```

## Typescript

### Injecting services

Inject services into components with `private readonly`:

#### **`test.component.ts`**

```typescript
...

constructor(private readonly testService: TestService) {

}

...
```

### Property access modifiers

All properties and methods in a class should be marked with access modifiers.

#### Private

Any properties not used outside of a component, should be marked as private. The property name
should be prefixed with an underscore: `private _testProperty: string;`.

#### Readonly

Any properties with a constant reference, should be marked as readonly. For example:
`public readonly testObservable$ = new BehaviourSubject<string>('')`.

#### Constants

All constant properties should be written in screaming snake case:
`public readonly MY_VALUE = 'my value';`

### Property typing

Unless initialized with a primitive or an explicit constructor, all properties and methods should
have a return type specified:

#### **`test.component.ts`**

```typescript
...

public myProperty!: TestObject;

private _myString  = 'test';

public myVoidFunction(testParams: TestParam): void {
    ...
}

private myTestFunction(testParams: TestParam): TestResult {
    let testResult!: TestResult;

    ...

    return testresult
}


...
```

### Preferred class property order

As much possible, we recommend you keep to the following ordering of properties in Angular classes:

- Property decorators like `ViewChild`, `ViewChildren` etc.
- `Input()`
- `Output()`
- Public properties
- Public readonly properties
- Private properties
- Private readonly property
- Getters/setters
- Constructor
- Angular lifecycle hooks
  - ngOnInit
  - ngAfterViewInit
  - ngOnChanges
  - ngOnDestroy
- Public methods
- Private methods

#### Sorting properties

Properties and methods belonging to a certain logical domain should be bundled together within a
class. The bundle itself is preferably sorted alphabetically. This is a recommended way of
organizing a class, and can be deviated from if another way is more practical.

We recommend that logical grouping of methods takes precedence over grouping by access modifiers,
since it is more likely that a developer will want to have easy access to methods relating to a
certain domain, rather than methods with the same access modifier. Sorting by access modifier takes
precedence over optional alphabetical sorting.

#### **`test.component.ts`**

```typescript
...

/*
Methods relating to title are bundled together and sorted alphabetically.
This takes precedence over sorting by access modifiers.
The grouping by access modifier in turn takes precedence over alphabetical sorting.
*/

public addTitle(title: string): void {
  ...
}

public removeTitle(title: string): void {
  ...
}

private compareTitle(title: string): void {
  ...
}

// Methods relating to description are bundled together and sorted alphabetically

private addDescription(description: string): void {
  ...
}

private compareDescription(description: string): void {
  ...
}

private removeDescription(description: string): void {
  ...
}

...
```

### Naming conventions

#### Event emitters

Suffix event emitters with `Event` and write them in camelCase:

#### **`test.component.ts`**

```typescript
...

@Output() deleteEvent = new EventEmitter<Array<string>>();

...
```

#### Methods responding to event emitters

Prefix a method which responds to an event emitter with `on` and write them in camelCase.

#### **`test.component.html`**

```angular2html
<valtimo-delete-role-modal
  <!-- Method responding to event is prefixed with on -->
  (deleteEvent)="onDelete($event)"
  [showDeleteModal$]="showDeleteModal$"
  [deleteRowKeys]="deleteRowKeys$ | async"
>
</valtimo-delete-role-modal>
```

#### **`test.component.ts`**

```typescript
...

public onDelete(roles: Array<string>): void {
  ...
}

...
```

### Component metadata

#### Change detection strategy

When possible, set the `changeDetection` strategy of components to `ChangeDetectionStrategy.OnPush`.

#### Minimal decorator

If the selector of a component is not going to be used directly (for example when the component is
linked to a route and not used elsewhere), do not define it.

When a component does not separate styling, do not create a stylesheet for it. The `styleUrls`
property is not necessary then.

### Conditionals

#### If statements

If an if statement contains a single expression, and is not likely to be expanded in the future, it
is allowed to write it without curly brackets. If it is lengthy, or likely that more expressions are
added inside the statement later on, always include curly brackets.

```typescript
// short expression readable without curly brackets
if (selectedTheme) this._preferredTheme$.next(selectedTheme);
```

```typescript
// longer expression is more readable with curly brackets. Leaves room for expansion in the future.
if (selectedTheme) {
  this.themeService.parseThemeAndSaveAccentColorsInApi(selectedTheme);
}
```

### Signals for simple state management

For simple and local state management within a component (e.g. toggles, UI flags, or local caching),
we **prefer using Angular signals** over `BehaviorSubject`, `EventEmitter`. Signals reduce
boilerplate, improve readability, and are well-suited for tightly scoped component logic.

#### Naming Convention

- **Public signal state** variables should be prefixed with `$` (e.g., `$context`) to clearly denote
  their reactive nature and usage in templates.
- **Private signal state** variables should be prefixed with `_$` (e.g., `_$context`) to indicate
  they are private and reactive.

#### Example

```typescript
// Public signal (can be used in templates)
public $context = signal<boolean>(false);

// Private signal
private _$context = signal<string>('');
```

## Library folder structure

Each library under `projects/valtimo/` should organize its `src/lib/` directory as follows:

```
lib/
├── components/        # Angular components, each in its own folder
├── services/          # Injectable services
├── models/            # TypeScript interfaces, types, enums
├── constants/         # Static constants, test IDs, config values
├── utils/             # Pure utility/helper functions
├── directives/        # Custom Angular directives
├── pipes/             # Custom Angular pipes
├── permissions/       # Permission definitions
└── index.ts           # (optional) Barrel re-export for the folder
```

Each subfolder that contains multiple exported files should have an `index.ts` barrel export.
The library's `public-api.ts` controls the public surface — only intentionally public symbols
should be re-exported there. Internal components and services must not be exposed.

#### **`lib/models/index.ts`**

```typescript
export * from './my-item.model';
export * from './my-config.model';
```

#### **`src/public-api.ts`**

```typescript
export * from './lib/models';
export * from './lib/services';
export * from './lib/components/my-list/my-list.component';
export * from './lib/constants';
```

## Standalone components

New components should be standalone. Use `standalone: true` with explicit `imports` instead of
declaring components in an `NgModule`.

```typescript
@Component({
  standalone: true,
  selector: 'valtimo-my-component',
  templateUrl: './my-component.component.html',
  styleUrls: ['./my-component.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, ButtonModule, IconModule],
})
export class MyComponent {}
```

## Page-level orchestrator services

When multiple components on the same page need to share state (e.g. a list component and a modal),
use a page-scoped service instead of passing data through deep `@Input()`/`@Output()` chains.

### Rules

- Declare the service with `@Injectable()` — **not** `providedIn: 'root'`.
- Provide it in the top-level page component's `providers: []`.
- Hold state in private `BehaviorSubject`s and expose public observables via `.asObservable()`.
- Expose mutation methods for child components to call.
- Clean up subscriptions in `ngOnDestroy()`.

### Example

#### **`my-page.service.ts`**

```typescript
@Injectable()
export class MyPageService implements OnDestroy {
  private readonly _items$ = new BehaviorSubject<Item[]>([]);
  public readonly items$ = this._items$.asObservable();

  private readonly _showModal$ = new BehaviorSubject<boolean>(false);
  public readonly showModal$ = this._showModal$.asObservable();

  private readonly _editingItem$ = new BehaviorSubject<Item | null>(null);
  public readonly editingItem$ = this._editingItem$.asObservable();

  private readonly _subscriptions = new Subscription();

  constructor(private readonly myApiService: MyApiService) {}

  public loadItems(): void {
    this._subscriptions.add(
      this.myApiService.getItems().subscribe(items => this._items$.next(items))
    );
  }

  public showEditModal(item: Item): void {
    this._editingItem$.next(item);
    this._showModal$.next(true);
  }

  public hideModal(): void {
    this._showModal$.next(false);
    runAfterCarbonModalClosed(() => this._editingItem$.next(null));
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }
}
```

#### **`my-page.component.ts`** (parent)

```typescript
@Component({
  standalone: true,
  selector: 'valtimo-my-page',
  providers: [MyPageService],
  imports: [MyListComponent, MyModalComponent],
  // ...
})
export class MyPageComponent {
  constructor(private readonly myPageService: MyPageService) {}
}
```

Both `MyListComponent` and `MyModalComponent` inject `MyPageService` to read/write shared state
without any `@Input()`/`@Output()` wiring between them.

## Reuse shared components from `@valtimo/components`

Before building something new, check whether `@valtimo/components` already provides it. Key
reusable building blocks include (but not limited to):

| Component / utility              | Purpose                                                              |
| -------------------------------- | -------------------------------------------------------------------- |
| `AutoKeyInputComponent`          | Auto-generates a unique key from a title/name field (add/edit/dup)   |
| `CarbonListModule`               | Table/list with sorting, filtering, pagination                       |
| `ConfirmationModalModule`        | Standard confirmation dialog                                         |
| `ValtimoCdsModalDirective`       | Carbon modal lifecycle wrapper                                       |
| `MultiInputComponent`            | Dynamic key-value pair inputs                                        |
| `SelectModule`                   | Enhanced dropdown (improves on Carbon `cds-combobox`)                |
| `runAfterCarbonModalClosed()`    | Utility for timing actions after the Carbon modal close animation    |

## Reactive forms

Use reactive forms (`FormBuilder`, `FormGroup`, `FormControl`) exclusively. Do not use
template-driven forms (`ngModel`).

```typescript
public formGroup: FormGroup = this.fb.group({
  title: this.fb.control('', Validators.required),
  key: this.fb.control('', [Validators.required, Validators.minLength(3)]),
});
```

## Subscription management

### Preferred approaches (in order)

1. **Async pipe in templates** — no manual cleanup needed.
2. **`Subscription` container with `ngOnDestroy`** — for imperative subscriptions that cannot
   live in the template.

HTTP observables complete automatically after emitting, so wrapping them in `take(1)` is
unnecessary.

### Batching async pipes

Use `*ngIf="{ ... } as obs"` to batch multiple async pipes into a single template variable:

```angular2html
<ng-container
  *ngIf="{
    items: items$ | async,
    loading: loading$ | async,
    showModal: showModal$ | async
  } as obs"
>
  <valtimo-carbon-list [items]="obs.items" [loading]="obs.loading"></valtimo-carbon-list>
</ng-container>
```

## Test IDs

Interactive and important elements should carry a `data-test-id` attribute for e2e tests.

### Convention

1. Define test IDs as a `const` object with `as const` in a `*.test-ids.ts` file under
   `constants/`.
2. Expose in the component as `protected readonly testIds = MY_TEST_IDS;`.
3. Bind in the template with `[attr.data-test-id]="testIds.myElement"`.

#### **`constants/my-component.test-ids.ts`**

```typescript
export const MY_COMPONENT_TEST_IDS = {
  titleInput: 'myComponentTitleInput',
  saveButton: 'myComponentSaveButton',
} as const;
```

#### **`my-component.component.html`**

```angular2html
<input cdsText [attr.data-test-id]="testIds.titleInput" />
<button cds-button [attr.data-test-id]="testIds.saveButton">{{ 'interface.save' | translate }}</button>
```

## Translations

- Use the `translate` pipe in templates (preferred).
- Use `TranslateService.instant()` in TypeScript only when you need a translation as a string
  value (e.g. building list items).
- Use `TranslateService.stream()` when the result must react to language changes at runtime.
- Translation keys follow dot notation: `'moduleName.section.key'`
  (e.g. `'caseManagement.statuses.add'`).

## Carbon Design System

- Import Carbon modules individually — never import the entire library.
- Register icons explicitly in the constructor:
  ```typescript
  constructor(private readonly iconService: IconService) {
    this.iconService.registerAll([Edit16, TrashCan16]);
  }
  ```
- Use Carbon components directly where possible. When a Carbon component does not meet
  requirements out of the box, it is acceptable to create an improved wrapper in
  `@valtimo/components` (e.g. `SelectModule` wraps and improves on `cds-combobox`).

## Error handling

- **HTTP errors** are handled globally by `HttpErrorInterceptor` which shows toast notifications.
  Do not duplicate toast logic in individual services or components.
- Use `catchError` in services when you need recovery logic (e.g. reload data on failure).
- For inline validation errors displayed in a form, use a `BehaviorSubject<string | null>` to
  drive the error message in the template.
