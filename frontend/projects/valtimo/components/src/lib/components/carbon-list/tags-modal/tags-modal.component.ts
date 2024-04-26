import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {CarbonTag} from '../../../models';

@Component({
  selector: 'valtimo-tags-modal',
  templateUrl: './tags-modal.component.html',
  styleUrls: ['./tags-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarbonTagsModalComponent {
  @Input() open = false;

  private _tags: CarbonTag[];
  @Input() public set tags(value: CarbonTag[]) {
    this._tags = value.sort((a: CarbonTag, b: CarbonTag) => (a.content < b.content ? -1 : 1));
  }
  public get tags(): CarbonTag[] {
    return this._tags;
  }

  @Output() public closeEvent = new EventEmitter();

  public onCloseSelect(): void {
    this.closeEvent.emit();
  }
}
