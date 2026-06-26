/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {CommonModule} from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostBinding,
  Input,
  NgZone,
  OnDestroy,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {ChevronLeft16, ChevronRight16} from '@carbon/icons';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {BehaviorSubject} from 'rxjs';

@Component({
  selector: 'valtimo-carousel',
  templateUrl: './carousel.component.html',
  styleUrls: ['./carousel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [CommonModule, TranslateModule, ButtonModule, IconModule],
})
export class CarouselComponent implements AfterViewInit, OnDestroy {
  @HostBinding('class') public readonly hostClasses = 'valtimo-carousel';

  @Input() public ariaLabel?: string;

  @ViewChild('track') private readonly trackRef!: ElementRef<HTMLElement>;

  public readonly canScrollPrev$ = new BehaviorSubject<boolean>(false);
  public readonly canScrollNext$ = new BehaviorSubject<boolean>(false);
  public readonly itemCount$ = new BehaviorSubject<number>(0);
  public readonly activeIndex$ = new BehaviorSubject<number>(0);
  public readonly dots$ = new BehaviorSubject<number[]>([]);

  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;

  constructor(
    private readonly iconService: IconService,
    private readonly ngZone: NgZone
  ) {
    this.iconService.registerAll([ChevronLeft16, ChevronRight16]);
  }

  public ngAfterViewInit(): void {
    const track = this.trackRef.nativeElement;

    this.resizeObserver = new ResizeObserver(() => this.ngZone.run(() => this.updateScrollState()));
    this.resizeObserver.observe(track);

    this.mutationObserver = new MutationObserver(() =>
      this.ngZone.run(() => this.updateScrollState())
    );
    this.mutationObserver.observe(track, {childList: true});

    this.updateScrollState();
  }

  public ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
  }

  public onScroll(): void {
    this.updateScrollState();
  }

  public scrollPrev(): void {
    this.scrollByViewport(-1);
  }

  public scrollNext(): void {
    this.scrollByViewport(1);
  }

  public scrollToIndex(index: number): void {
    const track = this.trackRef.nativeElement;
    track.scrollTo({left: index * track.clientWidth, behavior: 'smooth'});
  }

  private scrollByViewport(direction: 1 | -1): void {
    const track = this.trackRef.nativeElement;
    track.scrollBy({left: direction * track.clientWidth, behavior: 'smooth'});
  }

  private updateScrollState(): void {
    const track = this.trackRef.nativeElement;
    const maxScrollLeft = track.scrollWidth - track.clientWidth;
    this.canScrollPrev$.next(track.scrollLeft > 0);
    this.canScrollNext$.next(track.scrollLeft < maxScrollLeft - 1);

    const count = track.children.length;
    if (count !== this.itemCount$.value) {
      this.itemCount$.next(count);
      this.dots$.next(Array.from({length: count}, (_, index) => index));
    }

    const activeIndex = track.clientWidth > 0 ? Math.round(track.scrollLeft / track.clientWidth) : 0;
    if (activeIndex !== this.activeIndex$.value) {
      this.activeIndex$.next(activeIndex);
    }
  }
}
