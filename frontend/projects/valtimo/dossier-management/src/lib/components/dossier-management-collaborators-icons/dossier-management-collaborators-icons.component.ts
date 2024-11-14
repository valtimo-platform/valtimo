import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, EventEmitter, Output} from '@angular/core';
import {TooltipModule} from 'carbon-components-angular';
import {CaseCollaboratorsService} from '../../services';
import {Observable} from 'rxjs';
import {Collaborator} from '../../models';

@Component({
  selector: 'valtimo-dossier-management-collaborators-icons',
  templateUrl: './dossier-management-collaborators-icons.component.html',
  styleUrl: './dossier-management-collaborators-icons.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, TooltipModule],
})
export class DossierManagementCollaboratorsIconsComponent {
  @Output() public readonly collaboratorSelected = new EventEmitter();

  public readonly collaborators$: Observable<Collaborator[]> =
    this.caseCollaboratorsService.collaborators$;

  constructor(private readonly caseCollaboratorsService: CaseCollaboratorsService) {}

  public onIconClick(): void {
    this.collaboratorSelected.emit();
  }
}
