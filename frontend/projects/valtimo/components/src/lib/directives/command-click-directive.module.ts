import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CtrlClickDirective} from './command-click.directive';

@NgModule({
  declarations: [CtrlClickDirective],
  imports: [CommonModule],
  exports: [CtrlClickDirective],
})
export class CommandClickDirectiveModule {}
