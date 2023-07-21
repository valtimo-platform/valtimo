import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import {FormBuilder, Validators} from '@angular/forms';
import {Role, RoleMetadataModal} from '../../models';
import {CARBON_CONSTANTS} from '@valtimo/components';

@Component({
  selector: 'valtimo-role-metadata-modal',
  templateUrl: './role-metadata-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleMetadataModalComponent implements OnInit {
  @Input() open: boolean = false;
  @Input() type: RoleMetadataModal = 'add';
  @Input() set defaultKeyValue(value: string) {
    this._defaultKeyValue = value;
    this.setDefaultKeyValue(value);
  }
  @Output() closeEvent = new EventEmitter<Role | null>();

  public form = this.fb.group({
    key: this.fb.control('', Validators.required),
  });

  private _defaultKeyValue!: string;

  public get key() {
    return this.form?.get('key');
  }

  constructor(private readonly fb: FormBuilder) {}

  public ngOnInit(): void {}

  public onCancel(): void {
    this.closeEvent.emit(null);
    this.resetForm();
  }

  public onConfirm(): void {
    if (!this.key) {
      return;
    }

    this.closeEvent.emit({roleKey: this.key.value});
    this.resetForm();
  }

  private setDefaultKeyValue(value: string) {
    this.key.setValue(value);
  }

  private resetForm(): void {
    setTimeout(() => {
      this.form.reset();
      if (this.type === 'edit') {
        this.setDefaultKeyValue(this._defaultKeyValue);
      }
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
}
