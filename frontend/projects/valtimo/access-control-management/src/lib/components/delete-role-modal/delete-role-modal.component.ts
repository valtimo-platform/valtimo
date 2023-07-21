import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {Observable} from 'rxjs';

@Component({
  selector: 'valtimo-delete-role-modal',
  templateUrl: './delete-role-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteRoleModalComponent {
  @Input() deleteRowKeys: Array<string>;
  @Input() showDeleteModal$: Observable<boolean>;
  @Output() deleteEvent = new EventEmitter<Array<string>>();

  public onDelete(roles: Array<string>): void {
    this.deleteEvent.emit(roles);
  }
}
