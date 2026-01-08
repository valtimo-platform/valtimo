# Object management

Object management makes it possible to manage Objecten API objects inside Valtimo.

## Dependencies

In order to use Object management, the Object management module needs to be added as a dependency.

### Backend

The samples below assume the [valtimo-dependency-versions](../core/valtimo-dependency-versions.md) module is used. If not, please specify the artifact version as well.

#### Maven dependency:

```xml

<dependencies>
  <dependency>
    <groupId>com.ritense.valtimo</groupId>
    <artifactId>object-management</artifactId>
    <version>${valtimo_version}</version>
  </dependency>
</dependencies>
```

#### Gradle dependency:

```kotlin
dependencies {
    implementation("com.ritense.valtimo:object-management")
}
```

### Frontend

Two packages are required to make use of Object management.

The object-management package makes it possible to manage objecttypen from the Objecttypen API directly in Valtimo:

`@valtimo/object-management`

The object package makes it possible to view, create, update and delete objects from the Objecten API directly in Valtimo:

`@valtimo/object`.

Both dependencies contain a module that has to be added to the `app.module.ts`:

```ts
imports: [
    ...
    ObjectModule,
    ObjectManagementModule
]
```

#### Menu items

Object management is disabled by default. After including the packages, the menu items are not yet visible. Some additional steps are required.

**Enable the feature toggle**

```json
{
  featureToggles: {
    enableObjectManagement: true
  }
}
```

**Include object-management to the Valtimo menu**

The object routing needs to be added to the menu in the environment file:

```json
{
  roles: [
    ROLE_ADMIN
  ],
  title: 'Objects',
  iconClass: 'icon mdi mdi-archive',
  sequence: 3,
  includeFunction: IncludeFunction.ObjectManagementEnabled
}
```

**Include objects to the Valtimo menu**

The object-management routing needs to be added to the menu in the environment file:

```json
{
  roles: [
    ROLE_ADMIN
  ],
  title: 'Admin',
  iconClass: 'icon mdi mdi-tune',
  sequence: 6,
  children: [
    {
      link: [
        '/object-management'
      ],
      title: 'Objects',
      sequence: 1
    }
  ]
}
```
