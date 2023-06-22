import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RenderInPageHeaderDirective} from './render-in-page-header.directive';

@NgModule({
  declarations: [RenderInPageHeaderDirective],
  imports: [CommonModule],
  exports: [RenderInPageHeaderDirective],
})
export class RenderInPageHeaderDirectiveModule {}
