import {AfterContentInit, ContentChild, Directive, TemplateRef} from '@angular/core';
import {take} from 'rxjs';
import {PageTitleService} from '../components/page-title/page-title.service';

@Directive({selector: '[renderInPageHeader]'})
export class RenderInPageHeaderDirective implements AfterContentInit {
  @ContentChild(TemplateRef) templateRef;
  constructor(private readonly pageTitleService: PageTitleService) {}

  ngAfterContentInit(): void {
    this.pageTitleService.pageActionsViewContainerRef$.pipe(take(1)).subscribe(pageActionsVcr => {
      if (this.templateRef) {
        pageActionsVcr.clear();
        pageActionsVcr.createEmbeddedView(this.templateRef);
        this.pageTitleService.setHasPageActions(true);
      }
    });
  }
}
