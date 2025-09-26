import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {Router} from '@angular/router';
import {TilesModule} from 'carbon-components-angular';
import {DossierVersionApiService} from '../../../services';
import {Observable, map} from 'rxjs';
import {DocumentDefinitionVersion, DossierManagemetnMenuItem} from '../../../models';

@Component({
  selector: 'valtimo-dossier-management-details-menu-item',
  templateUrl: './dossier-management-details-menu-item.component.html',
  styleUrl: './dossier-management-details-menu-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, TilesModule],
})
export class DossierManagementDetailsMenuItemComponent {
  @Input() menuItem: DossierManagemetnMenuItem;
  @Output() itemSelected = new EventEmitter<string>();

  public readonly isDraftVersion$: Observable<boolean> =
    this.dossierVersionApiService.activeVersion$.pipe(
      map((version: DocumentDefinitionVersion) => version.type === 'draft')
    );

  constructor(private readonly dossierVersionApiService: DossierVersionApiService) {}

  public onMenuItemClick(): void {
    this.itemSelected.emit(this.menuItem.urlPath);
  }
}
