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
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  Signal,
  signal,
  ViewChild,
} from '@angular/core';
import {ReactiveFormsModule} from '@angular/forms';
import {ArrowLeft16, Deploy16, Download16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  CARBON_CONSTANTS,
  FitPageDirectiveModule,
  ModalService,
  PageHeaderService,
  PageTitleService,
  RenderInPageHeaderDirectiveModule,
} from '@valtimo/components';
import {ProcessService} from '@valtimo/process';
import {
  ProcessLinkButtonService,
  ProcessLinkCreateEvent,
  ProcessLinkEditMode,
  ProcessLinkModule,
  ProcessLinkService,
  ProcessLinkStateService,
  ProcessLinkStepService,
} from '@valtimo/process-link';
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
  CamundaPlatformPropertiesProviderModule,
} from 'bpmn-js-properties-panel';
import Modeler from 'bpmn-js/lib/Modeler';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import camundaPlatformBehaviors from 'camunda-bpmn-js-behaviors/lib/camunda-platform';
import CamundaBpmnModdle from 'camunda-bpmn-moddle/resources/camunda.json';
import {
  ButtonModule,
  DialogModule,
  DropdownModule,
  IconModule,
  IconService,
  LoadingModule,
  SelectModule,
  TagModule,
} from 'carbon-components-angular';
import {isEqual} from 'lodash';
import {NGXLogger} from 'ngx-logger';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  from,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {distinctUntilChanged} from 'rxjs/operators';
import {EMPTY_BPMN} from '../../constants';
import {OpenProcessLinkModalEvent, ProcessManagementWindow} from '../../models';
import {ProcessManagementEditorService, ProcessManagementService} from '../../services';
import {ValtimoPropertiesProviderModule} from './panel';

@Component({
  selector: 'valtimo-process-management-builder',
  templateUrl: './process-management-builder.component.html',
  styleUrls: ['./process-management-builder.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FitPageDirectiveModule,
    LoadingModule,
    RenderInPageHeaderDirectiveModule,
    DropdownModule,
    ReactiveFormsModule,
    SelectModule,
    ButtonModule,
    IconModule,
    TranslateModule,
    TagModule,
    ProcessLinkModule,
    ProcessLinkModule,
    DialogModule,
  ],
  providers: [
    ProcessManagementEditorService,
    ProcessLinkStateService,
    ProcessLinkStepService,
    ProcessLinkButtonService,
  ],
})
export class ProcessManagementBuilderComponent implements AfterViewInit, OnDestroy {
  @ViewChild('modeler', {static: false}) modelerElementRef!: ElementRef;
  @ViewChild('modelerPanel', {static: false}) modelerPanelElementRef!: ElementRef;
  @ViewChild('viewer', {static: false}) viewerElementRef!: ElementRef;
  @ViewChild('viewerPanel', {static: false}) viewerPanelElementRef!: ElementRef;

  private readonly _selectedProcess$ = new BehaviorSubject<any | 'create' | null>(null);
  @Input() public set selectedProcess(value: any | 'create') {
    this._selectedProcess$.next(value);
    if (value === 'create') return;
    this.processManagementEditorService.setSelectedProcessDefinition(value.processDefinition);
    this.processManagementEditorService.setProcessLinksForSelectedDefinition(value.processLinks);
  }
  @Output() public readonly navigateBack = new EventEmitter<null | 'success' | 'error'>();

  public readonly loading$ = new BehaviorSubject<boolean>(true);

  private _bpmnModeler!: Modeler;
  private _bpmnViewer!: NavigatedViewer;

  public isReadOnlyProcess$ = new BehaviorSubject<boolean>(false);
  public isSystemProcess$ = new BehaviorSubject<boolean>(false);

  public readonly selectedProcessDefinitionXml$ =
    this.processManagementEditorService.selectionProcessDefinition$.pipe(
      filter(selectedProcessDefinition => !!selectedProcessDefinition?.id),
      distinctUntilChanged((previous, current) => isEqual(previous, current)),
      tap(selectedProcessDefinition => {
        this.loading$.next(true);
        this.pageTitleService.setCustomPageTitle(selectedProcessDefinition.name);
      }),
      switchMap(selectedProcessDefinition =>
        this.processService.getProcessDefinitionXml(selectedProcessDefinition.id)
      ),
      tap(result => {
        this.cleanUpListenersOnModeler();
        this._bpmnModeler?.importXML(result.bpmn20Xml);
        this._bpmnViewer?.importXML(result.bpmn20Xml);
        this.isReadOnlyProcess$.next(result.readOnly);
        this.isSystemProcess$.next(result.systemProcess);
        this.loading$.next(false);
      })
    );

  public readonly changesPending$ = new BehaviorSubject<boolean>(false);

  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  public readonly extraSpace: Signal<number> = computed(() =>
    this.processManagementService.context() === 'case' ? 128 : 0
  );

  private readonly _creatingNewProcess = signal<boolean>(false);
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly processService: ProcessService,
    private readonly pageTitleService: PageTitleService,
    private readonly translateService: TranslateService,
    private readonly iconService: IconService,
    private readonly pageHeaderService: PageHeaderService,
    private readonly processManagementEditorService: ProcessManagementEditorService,
    private readonly modalService: ModalService,
    private readonly processLinkService: ProcessLinkService,
    private readonly processLinkStateService: ProcessLinkStateService,
    private readonly processManagementService: ProcessManagementService,
    private readonly logger: NGXLogger
  ) {
    this.iconService.registerAll([Deploy16, Download16, ArrowLeft16]);
    (window as any as ProcessManagementWindow).processManagementEditorService =
      processManagementEditorService;
    (window as any as ProcessManagementWindow).translateService = translateService;
  }

  public ngAfterViewInit(): void {
    this.initModeler();
    this.initViewer();
    this.subscribeToOpenProcessLinkModalEvents();
    this.subscribeToProcessLinkUpdateEvents();
    this.subscribeToProcessLinkCreateEvents();
    this.subscribeToProcessLinkDeleteEvents();
    this.processLinkStateService.setEditMode(ProcessLinkEditMode.EMIT_EVENTS);
    this.initIfCreate();
    this.initProcessDefinition();
  }

  public ngOnDestroy(): void {
    this._bpmnModeler?.destroy();
    this._bpmnViewer?.destroy();
    this._subscriptions.unsubscribe();
  }

  public onDeployClick(isReadonly: false): void {
    if (this._creatingNewProcess()) this.deployNewProcessDefinition();
    else this.deployChanges(isReadonly);
  }

  public export(isReadOnlyProcess: boolean): void {
    (isReadOnlyProcess ? from(this._bpmnViewer.saveXML()) : from(this._bpmnModeler.saveXML()))
      .pipe(take(1))
      .subscribe(result => {
        const file = new Blob([result.xml ?? ''], {type: 'text/xml'});
        const link = document.createElement('a');
        link.download = 'diagram.bpmn';
        link.href = window.URL.createObjectURL(file);
        link.click();
        window.URL.revokeObjectURL(link.href);
        link.remove();
      });
  }

  private deployChanges(isReadOnlyProcess: boolean): void {
    combineLatest([
      from(isReadOnlyProcess ? this._bpmnViewer.saveXML() : this._bpmnModeler.saveXML()),
      this.processManagementEditorService.processLinksForSelectedDefinition$,
      this.processManagementEditorService.selectionProcessDefinition$,
    ])
      .pipe(
        take(1),
        switchMap(([result, processLinks, selectedProcessDefinition]) =>
          this.processLinkService.deployProcessWithProcessLinks(
            processLinks as ProcessLinkCreateEvent[],
            selectedProcessDefinition.id,
            !isReadOnlyProcess ? (result?.xml ?? '') : null
          )
        )
      )
      .subscribe({
        next: () => {
          this.navigateBack.emit('success');
        },
        error: () => {
          this.navigateBack.emit('error');
        },
      });
  }

  private deployNewProcessDefinition(): void {
    combineLatest([
      from(this._bpmnModeler.saveXML()),
      this.processManagementEditorService.processLinksForSelectedDefinition$,
    ])
      .pipe(
        take(1),
        switchMap(([result, processLinks]) =>
          this.processLinkService.deployProcessWithProcessLinks(
            processLinks.map(link => ({
              ...link,
              processDefinitionId: '-',
            })) as ProcessLinkCreateEvent[],
            null,
            result.xml ?? ''
          )
        )
      )
      .subscribe({
        next: () => {
          this.navigateBack.emit('success');
        },
        error: () => {
          this.navigateBack.emit('error');
        },
      });
  }

  private initModeler(): void {
    this._bpmnModeler = new Modeler({
      additionalModules: [
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule,
        CamundaPlatformPropertiesProviderModule,
        camundaPlatformBehaviors,
        ValtimoPropertiesProviderModule,
      ],
      moddleExtensions: {
        camunda: CamundaBpmnModdle,
      },
      propertiesPanel: {
        parent: this.modelerPanelElementRef.nativeElement,
      },
    });

    this._bpmnModeler?.attachTo(this.modelerElementRef.nativeElement);

    this._bpmnModeler.on('commandStack.changed', () => {
      this.changesPending$.next(true);
    });

    this._bpmnModeler.on('import.done', () => {
      this.listenToActivityChangesOnModeler();
    });
  }

  private initViewer(): void {
    const disableCommands = () => {
      const commandStack = this._bpmnViewer.get('commandStack') as any;
      const originalExecute = commandStack?.execute?.bind(commandStack);

      if (commandStack?.execute) {
        commandStack.execute = (command: string, context: any) => {
          if (
            command === 'elements.delete' ||
            command === 'elements.copy' ||
            command === 'elements.paste' ||
            command === 'elements.create'
          ) {
            return;
          }
          originalExecute(command, context);
        };
      }
    };

    const DisableBpmnWriteModule = {
      paletteProvider: ['value', {}],
      contextPadProvider: ['value', {}],
      directEditing: [
        'value',
        {
          registerProvider: () => {},
          activate: () => {},
          deactivate: () => {},
          isActive: () => false,
        },
      ],
      move: ['value', null],
      resizeHandles: [
        'value',
        {
          addResizer: () => {},
          removeResizers: () => {},
        },
      ],
    };

    this._bpmnViewer = new Modeler({
      additionalModules: [
        DisableBpmnWriteModule,
        BpmnPropertiesPanelModule,
        ValtimoPropertiesProviderModule,
      ],
      moddleExtensions: {
        camunda: CamundaBpmnModdle,
      },
      propertiesPanel: {
        parent: this.viewerPanelElementRef.nativeElement,
      },
    });

    this._bpmnViewer?.attachTo(this.viewerElementRef.nativeElement);

    this._bpmnViewer.on('commandStack.changed', () => {
      this.changesPending$.next(true);
    });

    this._bpmnViewer.on('import.done', () => {
      disableCommands();
    });
  }

  private handleUpdateEvent(event: OpenProcessLinkModalEvent): void {
    this.modalService.setModalData(event?.modalParams);
    this.processLinkStateService.setModalParams(event?.modalParams);
    this.processLinkStateService.setElementName(event?.modalParams?.element?.name ?? '');
    this.processLinkStateService.selectProcessLink(event.processLink);
    this.processLinkStateService.showModal();
  }

  private handleCreateEvent(event: OpenProcessLinkModalEvent): void {
    this.processLinkService
      .getProcessLinkCandidates(event.modalParams.element.activityListenerType ?? '')
      .subscribe(candidates => {
        this.modalService.setModalData(event?.modalParams);
        this.processLinkStateService.setModalParams(event?.modalParams);
        this.processLinkStateService.setElementName(event?.modalParams?.element?.name ?? '');
        this.processLinkStateService.setAvailableProcessLinkTypes(candidates);
        this.processLinkStateService.showModal();
      });
  }

  private subscribeToOpenProcessLinkModalEvents(): void {
    this._subscriptions.add(
      this.processManagementEditorService.openProcessLinkModalEvents$.subscribe(event => {
        if (event.processLink) {
          this.handleUpdateEvent(event);
        } else {
          this.handleCreateEvent(event);
        }
      })
    );
  }

  private subscribeToProcessLinkUpdateEvents(): void {
    this._subscriptions.add(
      this.processLinkStateService.processLinkUpdateEvents$.subscribe(event => {
        this.processManagementEditorService.updateProcessLink(event);
        this.processLinkStateService.stopSaving();
        this.processLinkStateService.closeModal();
      })
    );
  }

  private subscribeToProcessLinkCreateEvents(): void {
    this._subscriptions.add(
      this.processLinkStateService.processLinkCreateEvents$.subscribe(event => {
        this.processManagementEditorService.createProcessLink(event);
        this.processLinkStateService.stopSaving();
        this.processLinkStateService.closeModal();
      })
    );
  }

  private subscribeToProcessLinkDeleteEvents(): void {
    this._subscriptions.add(
      this.processLinkStateService.processLinkDeleteEvents$.subscribe(event => {
        this.processManagementEditorService.deleteProcessLink(event);
        this.processLinkStateService.stopSaving();
        this.processLinkStateService.closeModal();
      })
    );
  }

  private initIfCreate(): void {
    if (this._selectedProcess$.getValue() !== 'create') return;

    this._creatingNewProcess.set(true);
    this._bpmnModeler?.importXML(EMPTY_BPMN);
    this.isReadOnlyProcess$.next(false);
    this.isSystemProcess$.next(false);
    this.loading$.next(false);
  }

  private shapeAddedHandler = (event: any): void => {
    this.logger.debug('Shape added:', event);
  };

  private shapeRemovedHandler = (event: any): void => {
    this.logger.debug('Shape removed:', event);

    const activityId = event?.element?.id;

    if (!activityId) return;

    this.processManagementEditorService.deleteProcessLink({activityId});
  };

  private elementChangedHandler = (event: any): void => {
    this.logger.debug('Element changed:', event);
  };

  private listenToActivityChangesOnModeler(): void {
    const eventBus = this._bpmnModeler.get('eventBus') as any;

    if (!eventBus) return;

    eventBus.on('shape.added', this.shapeAddedHandler);
    eventBus.on('shape.removed', this.shapeRemovedHandler);
    eventBus.on('element.changed', this.elementChangedHandler);
  }

  private cleanUpListenersOnModeler(): void {
    const eventBus = this._bpmnModeler.get('eventBus') as any;

    if (!eventBus) return;

    eventBus.off('shape.added', this.shapeAddedHandler);
    eventBus.off('shape.removed', this.shapeRemovedHandler);
    eventBus.off('element.changed', this.elementChangedHandler);
  }

  private initProcessDefinition(): void {
    this._selectedProcess$
      .pipe(
        filter(selectedProcess => selectedProcess !== null && selectedProcess !== 'create'),
        distinctUntilChanged((previous, current) => isEqual(previous, current)),
        tap(() => this.loading$.next(true))
      )
      .subscribe(result => {
        this.cleanUpListenersOnModeler();
        this._bpmnModeler?.importXML(result.bpmn20Xml);
        this._bpmnViewer?.importXML(result.bpmn20Xml);
        this.isReadOnlyProcess$.next(result.readOnly);
        this.isSystemProcess$.next(result.systemProcess);
        this.loading$.next(false);
      });
  }
}
