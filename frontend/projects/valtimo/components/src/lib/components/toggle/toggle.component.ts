import {Component, EventEmitter, Input, Output} from '@angular/core';
import {BehaviorSubject} from 'rxjs';

@Component({
  selector: 'v-toggle',
  templateUrl: './toggle.component.html',
  styleUrls: ['./toggle.component.scss'],
  standalone: false,
})
export class ValtimoToggleComponent {
  @Input() public name = '';
  @Input() public disabled = false;
  @Input() public dataTestId?: string;
  @Input() public onText = '';
  @Input() public offText = '';
  @Input() public required = false;
  @Input() public label = '';
  @Input() public size = '';
  @Input() public value = false;
  public toggleValue$ = new BehaviorSubject<any>(undefined);

  toggle(value: boolean): void {
    console.log(value);
    this.toggleValue$.next(value);
  }
}
