import {CommonModule} from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {CarbonListModule, ColumnConfig, ViewType} from '@valtimo/components';
import {BehaviorSubject, Observable, tap} from 'rxjs';
import {Collaborator, TabEnum} from '../../models';
import {CaseCollaboratorsService} from '../../services/case-collaborators.service';
import {ButtonModule} from 'carbon-components-angular';
import {CaseChangeLogsService, CaseMenuService, TabService} from '../../services';

@Component({
  selector: 'valtimo-dossier-management-collaborators-list',
  templateUrl: './dossier-management-collaborators-list.component.html',
  styleUrl: './dossier-management-collaborators-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, CarbonListModule, ButtonModule],
})
export class DossierManagementCollaboratorsListComponent implements AfterViewInit {
  @ViewChild('goToLogs') private _goToLogsTemplate: TemplateRef<any>;
  public readonly collaborators$: Observable<Collaborator[] | null> =
    this.caseCollaboratorsService.collaborators$;

  public readonly collaboratorsFields$ = new BehaviorSubject<ColumnConfig[]>([]);

  constructor(
    private readonly caseCollaboratorsService: CaseCollaboratorsService,
    private readonly caseChangeLogsService: CaseChangeLogsService,
    private readonly caseMenuService: CaseMenuService,
    private readonly tabService: TabService
  ) {}

  public ngAfterViewInit(): void {
    this.collaboratorsFields$.next([
      {
        key: 'fullName',
        label: 'User name',
        viewType: ViewType.TEXT,
      },
      {
        key: 'email',
        label: 'User email',
        viewType: ViewType.TEXT,
      },
      {
        key: '',
        label: '',
        viewType: ViewType.TEMPLATE,
        template: this._goToLogsTemplate,
      },
    ]);
  }

  public onRowClicked(collaborator: Collaborator) {
    this.caseChangeLogsService.activeLogSearch$.next(collaborator.id);
    this.caseMenuService.selectMenuItem(TabEnum.CASE_CHANGE_LOGS);
    this.tabService.currentTab = TabEnum.CASE_CHANGE_LOGS;
  }
}
