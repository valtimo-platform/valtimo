import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostBinding,
  Output,
  signal,
} from '@angular/core';
import {DossierManagementDetailsMenuItemComponent} from './dossier-management-details-menu-item/dossier-management-details-menu-item.component';
import {MENU_ITEMS} from '../../mocks';
import {TabEnum} from '../../models';
import {ButtonModule} from 'carbon-components-angular';
import {CaseMenuService} from '../../services';

@Component({
  selector: 'valtimo-dossier-management-details-menu',
  templateUrl: './dossier-management-details-menu.component.html',
  styleUrl: './dossier-management-details-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, DossierManagementDetailsMenuItemComponent, ButtonModule],
})
export class DossierManagementDetailsMenuComponent {
  @HostBinding('class') public readonly class = '';
  @Output() menuItemSelected = new EventEmitter<TabEnum | string | null>();

  public readonly isItemSelected$ = this.caseMenuService.isItemSelected$;
  public readonly MENU_ITEMS = MENU_ITEMS;

  constructor(private readonly caseMenuService: CaseMenuService) {}

  public onMenuItemSelected(url: TabEnum | string | null): void {
    this.caseMenuService.selectMenuItem(url);
    this.menuItemSelected.emit(url);
  }
}
