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
