/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import {ComponentFactoryResolver, ComponentRef, ViewContainerRef} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {BehaviorSubject, filter, Observable, take} from 'rxjs';

export interface TabLoader<T_TAB extends Tab> {
  tabs: T_TAB[];

  initial(tabName?: string): void;

  load(tabToLoad: T_TAB): void;
}

export class TabLoaderImpl implements TabLoader<TabImpl> {
  private readonly _activeTab$ = new BehaviorSubject<TabImpl | null>(null);
  private readonly _tabs: TabImpl[] = null;
  private readonly _componentFactoryResolver: ComponentFactoryResolver = null;
  private readonly _viewContainerRef: ViewContainerRef = null;
  private _activeComponent: ComponentRef<any> = null;
  private _activeTab: TabImpl = null;
  private _router: Router;
  private _route: ActivatedRoute;

  constructor(
    tabs: TabImpl[],
    componentFactoryResolver: ComponentFactoryResolver,
    viewContainerRef: ViewContainerRef,
    router: Router,
    route: ActivatedRoute
  ) {
    this._tabs = tabs;
    this._componentFactoryResolver = componentFactoryResolver;
    this._viewContainerRef = viewContainerRef;
    this._router = router;
    this._route = route;
  }

  public get tabs(): TabImpl[] {
    return this._tabs;
  }

  public get activeTab$(): Observable<TabImpl> {
    return this._activeTab$.pipe(filter(tab => !!tab));
  }

  public initial(tabName?: string): void {
    let initialTab!: TabImpl;

    if (tabName) {
      initialTab =
        this._tabs.find(tab => tab.name === tabName) ||
        this._tabs.find(tab => tab.contentKey === tabName);
    }

    if (!initialTab) {
      initialTab = this._tabs[0] || null;
    }

    this.load(initialTab);
  }

  public load(newTab: TabImpl): void {
    if (newTab !== this._activeTab) {
      this._tabs.forEach(tab => tab.deactivate());
      this.replaceView(newTab);
      this.replaceUrlState(newTab);
      this.setActive(newTab);
    }
  }

  public refreshView() {
    this.replaceView(this._activeTab);
  }

  private replaceView(tab: TabImpl): void {
    const componentFactory = this._componentFactoryResolver.resolveComponentFactory(tab.component);
    this._viewContainerRef.clear();
    if (this._activeTab !== null) {
      this._activeComponent.destroy();
    }
    this._activeComponent = this._viewContainerRef.createComponent(componentFactory);
  }

  public replaceUrlState(nextTab: TabImpl): void {
    this._route.params.pipe(take(1)).subscribe(params => {
      const currentUrl = this._router.url;
      const currentDocumentId = params?.documentId;
      const urlBeforeDocumentId = currentUrl.split(currentDocumentId)[0];

      this._router.navigateByUrl(`${urlBeforeDocumentId}${currentDocumentId}/${nextTab.name}`);
    });
  }

  private setActive(tab: TabImpl): void {
    tab.activate();
    this._activeTab = tab;
    this._activeTab$.next(tab);
  }
}

export interface Tab {
  name: string;
  sequence: number;
  component: any;
  title: string;
  contentKey: string;

  activate(): void;

  deactivate(): void;

  isActive(): boolean;
}

export class TabImpl implements Tab {
  private readonly _name: string;
  private readonly _sequence: number;
  private readonly _component: any;
  private readonly _contentKey: string;
  private readonly _title: string;
  private _active = false;
  private _showTasks = false;

  constructor(
    name: string,
    sequence: number,
    component: any,
    contentKey?: string,
    title?: string,
    showTasks: boolean = false
  ) {
    this._name = name;
    this._sequence = sequence;
    this._component = component;

    if (contentKey) this._contentKey = contentKey;
    if (title) this._title = title;
    if (showTasks) this._showTasks = showTasks;
  }

  public get name(): string {
    return this._name;
  }

  public get sequence(): number {
    return this._sequence;
  }

  public get component(): any {
    return this._component;
  }

  public get contentKey(): string {
    return this._contentKey;
  }

  public get title(): string {
    return this._title;
  }

  public get showTasks(): boolean {
    return this._showTasks;
  }

  public activate(): void {
    this._active = true;
  }

  public deactivate(): void {
    this._active = false;
  }

  public isActive(): boolean {
    return this._active;
  }
}
