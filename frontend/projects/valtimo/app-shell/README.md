# @valtimo/app-shell

Shared application shell housing the common wiring used by every Valtimo
application variant (`apps/dev`, `apps/gzac`, and any future variants such
as `apps/valtimo` or `apps/evenementenvergunning`).

## What's inside

[`CommonAppModule`](./src/lib/common-app.module.ts) is an `@NgModule` whose
`imports` AND `exports` carry the 44 feature modules common to every
variant:

- Layout/shell: `LayoutModule`, `BootstrapModule`, `SecurityModule`,
  `MenuModule`, `WidgetModule`, `BpmnJsDiagramModule`.
- Task/case/process: `TaskModule`, `CaseMigrationModule`,
  `CaseManagementModule`, `ProcessModule`, `ProcessLinkModule`,
  `ProcessManagementModule`.
- Form: `FormModule`, `FormManagementModule`, `FormFlowManagementModule`.
- Dashboard/document/account: `DashboardModule`, `DashboardManagementModule`,
  `DocumentModule`, `AccountModule`, `ChoiceFieldModule`, `ResourceModule`.
- Analysis/swagger/decision/milestone/migration: `AnalyseModule`,
  `SwaggerModule`, `DecisionModule`, `MilestoneModule`, `MigrationModule`.
- Management: `PluginManagementModule`, `ObjectManagementModule`,
  `ObjectModule`, `AccessControlManagementModule`,
  `TranslationManagementModule`.
- ZGW / IKO / logging: `ZgwModule`, `IkoModule`, `LoggingModule`.
- Admin / building blocks / teams: `AdminSettingsModule`,
  `BuildingBlockManagementModule`, `TeamsModule`.
- Plugin modules used by every variant: `BesluitenApi*`, `CatalogiApi*`,
  `DocumentenApi*`, `DocumentenApiPreview*`, `NotificatiesApi*`,
  `ObjectenApi*`, `ObjectTokenAuthentication*`, `ObjecttypenApi*`,
  `OpenNotifications*`, `OpenZaak*`, `Portaaltaak*`, `SmartDocuments*`,
  `ZakenApi*`, `Verzoek*`.

`CommonAppModule`'s constructor also calls the nine Formio
`register*` helpers (`enableCustomFormioComponents`,
`registerFormioCurrencyComponent`, etc.) so each variant doesn't have to
duplicate them.

## What stays in the variant `AppModule`

- Angular-native modules: `BrowserModule`, `CommonModule`,
  `AppRoutingModule`, `FormsModule`, `ReactiveFormsModule`.
- Per-variant parameterised modules:
  `ConfigModule.forRoot(environment)`,
  `LoggerModule.forRoot(environment.logger)`,
  `environment.authentication.module`,
  `CaseModule.forRoot(tabsFactory)`, `TranslateModule.forRoot({...})`.
- Variant-only feature modules. For example:
    - `apps/dev` adds `FormIoModule`, `UploaderModule`,
      `FormViewModelModule`, `KlantinteractiesApiPluginModule`,
      `OpenKlantTokenAuthenticationPluginModule`.
    - `apps/gzac` adds `SseModule`.
- The variant's `PLUGINS_TOKEN` provider (the list of plugin specs
  differs per variant).
- The variant-local `app-plugins.ts` / `app-plugins.prod.ts` pair (the
  `fileReplacements`-driven dev/prod split for `@valtimo-plugins/*`).
- Variant declarations (`AppComponent` plus any variant-only declared
  components, e.g. `apps/dev`'s showcase set in `devDeclarations`).

## Use

Already wired into both variants:

```ts
import {CommonAppModule} from '@valtimo/app-shell';

@NgModule({
  imports: [
    BrowserModule,
    CommonModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    CommonAppModule,                             // 44 shared feature modules
    ConfigModule.forRoot(environment),
    LoggerModule.forRoot(environment.logger),
    environment.authentication.module,
    CaseModule.forRoot(tabsFactory),
    TranslateModule.forRoot({/* ... */}),
    /* variant-only modules + ...pluginImports */
  ],
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    {provide: PLUGINS_TOKEN, useValue: [/* variant spec list */]},
  ],
  declarations: [AppComponent, /* variant-only declarations */],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

The `@valtimo/app-shell` path is mapped in
[`frontend/tsconfig.json`](../../../tsconfig.json) so TypeScript resolves the
import directly to the source via `paths` — there is no need to build the
library separately during local development.
