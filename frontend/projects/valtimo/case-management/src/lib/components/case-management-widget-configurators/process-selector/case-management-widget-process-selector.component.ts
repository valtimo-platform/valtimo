import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, Input, OnInit} from '@angular/core';
import {FormBuilder, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {CARBON_THEME, CdsThemeService, CurrentCarbonTheme} from '@valtimo/components';
import {DocumentService, ProcessDefinitionCaseDefinition} from '@valtimo/document';
import {CaseWidgetAction} from '@valtimo/case';
import {DropdownModule, InputModule, ListItem} from 'carbon-components-angular';
import {
  BehaviorSubject,
  debounceTime,
  map,
  Observable,
  startWith,
  Subscription,
  switchMap,
} from 'rxjs';
import {WidgetWizardService} from '../../../services';

@Component({
  selector: 'valtimo-case-management-widget-process-selector',
  templateUrl: './case-management-widget-process-selector.component.html',
  styleUrl: './case-management-widget-process-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, TranslateModule, DropdownModule, InputModule, ReactiveFormsModule],
})
export class CaseManagementWidgetProcessSelectorComponent implements OnInit {
  private readonly _documentDefinitionName$ = new BehaviorSubject<string | null>(null);
  @Input() public set documentDefinitionName(value: string) {
    this._documentDefinitionName$.next(value);
  }

  public readonly formGroup = this.fb.group({
    name: this.fb.control<string>({
      value: this.widgetWizardService.widgetActions()?.[0]?.name ?? '',
      disabled: !this.widgetWizardService.widgetActions()?.length,
    }),
    processDefinitionKey: this.fb.control<ListItem>({
      content: '',
      key: this.widgetWizardService.widgetActions()?.[0]?.processDefinitionKey,
      selected: false,
    }),
  });

  public readonly processDefinitionItems$: Observable<ListItem[]> =
    this._documentDefinitionName$.pipe(
      switchMap((documentDefinitionName: string | null) =>
        this.documentService.findProcessDefinitionCaseDefinitionsByStartableByUser(
          documentDefinitionName ?? '',
          true
        )
      ),
      map((processDocumentDefinitions: ProcessDefinitionCaseDefinition[]) => {
        const selectedProcessKey: string | undefined = this.widgetWizardService.editMode()
          ? this.widgetWizardService.widgetActions()?.[0]?.processDefinitionKey
          : undefined;

        return processDocumentDefinitions.map((definition: ProcessDefinitionCaseDefinition) => {
          const mappedItem: ListItem = {
            content: definition.processDefinitionName,
            key: definition.processDefinitionKey,
            selected: selectedProcessKey === definition.processDefinitionKey,
          };

          if (mappedItem.selected)
            this.formGroup.patchValue({processDefinitionKey: mappedItem}, {emitEvent: false});

          return mappedItem;
        });
      }),
      startWith([])
    );

  public readonly theme$ = this.cdsThemeService.currentTheme$.pipe(
    map((theme: CurrentCarbonTheme) =>
      theme === CurrentCarbonTheme.G10 ? CARBON_THEME.WHITE : CARBON_THEME.G90
    )
  );

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly cdsThemeService: CdsThemeService,
    private readonly documentService: DocumentService,
    private readonly fb: FormBuilder,
    private readonly widgetWizardService: WidgetWizardService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this.formGroup.valueChanges
        .pipe(debounceTime(100))
        .subscribe(
          (changes: Partial<{name: string | null; processDefinitionKey: ListItem | null}>) => {
            const {name, processDefinitionKey} = changes;
            this.widgetWizardService.widgetActions.update(
              (value: CaseWidgetAction[] | undefined) => {
                if (!value)
                  return [
                    {
                      name: !name ? processDefinitionKey?.content : name,
                      processDefinitionKey: processDefinitionKey?.key,
                    },
                  ];

                const edittedProcess = value.find(
                  (process: CaseWidgetAction) =>
                    process.processDefinitionKey === processDefinitionKey?.key
                );

                return !!edittedProcess
                  ? value.map((process: CaseWidgetAction) =>
                      process.processDefinitionKey === edittedProcess.processDefinitionKey
                        ? {
                            ...process,
                            name: !name ? processDefinitionKey?.content : name,
                          }
                        : process
                    )
                  : [
                      ...value,
                      {
                        name: !name ? processDefinitionKey?.content : name,
                        processDefinitionKey: processDefinitionKey?.key,
                      },
                    ];
              }
            );
          }
        )
    );
  }

  public onProcessSelected(): void {
    if (!this.formGroup.get('name')?.disabled) return;

    this.formGroup.get('name')?.enable();
  }
}
