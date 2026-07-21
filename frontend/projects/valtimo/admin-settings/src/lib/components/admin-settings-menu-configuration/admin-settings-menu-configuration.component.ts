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
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import {ScrollingModule} from '@angular/cdk/scrolling';
import {ChangeDetectionStrategy, Component, computed, OnInit, signal} from '@angular/core';
import {takeUntilDestroyed, toObservable, toSignal} from '@angular/core/rxjs-interop';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  AdminSettingsService,
  buildMenuConfigurationFromRuntimeMenu,
  ConfirmationModalModule,
  DragDropListComponent,
  FitPageDirective,
  getMenuCatalogEntry,
  hasSavedMenuConfiguration,
  MdiIconSelectorComponent,
  MENU_CONFIGURATION_VERSION,
  MENU_ITEM_CATALOG,
  MenuConfiguration,
  MenuConfigurationItem,
  MenuItemPlacement,
  TooltipModule,
} from '@valtimo/components';
import {ConfigService, IncludeFunction} from '@valtimo/shared';
import {ExternalPluginMenuPage, ExternalPluginPageService} from '@valtimo/plugin';
import {
  ButtonModule,
  IconModule,
  IconService,
  InputModule,
  LayerModule,
  LoadingModule,
  ModalModule,
  NotificationModule,
  SelectModule,
  TagModule,
} from 'carbon-components-angular';
import {Add16, Edit16, Locked16, TrashCan16} from '@carbon/icons';
import {catchError, forkJoin, merge, of} from 'rxjs';
import {MENU_CONFIGURATION_TEST_IDS} from '../../constants';
import {BuilderNode, PaletteGroup, PaletteItem} from '../../models';

@Component({
  standalone: true,
  selector: 'valtimo-admin-settings-menu-configuration',
  templateUrl: './admin-settings-menu-configuration.component.html',
  styleUrls: ['./admin-settings-menu-configuration.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ScrollingModule,
    DragDropListComponent,
    FitPageDirective,
    MdiIconSelectorComponent,
    ConfirmationModalModule,
    TooltipModule,
    ButtonModule,
    IconModule,
    InputModule,
    LayerModule,
    LoadingModule,
    ModalModule,
    NotificationModule,
    SelectModule,
    TagModule,
  ],
})
export class AdminSettingsMenuConfigurationComponent implements OnInit {
  protected readonly testIds = MENU_CONFIGURATION_TEST_IDS;

  public readonly $loading = signal<boolean>(true);
  public readonly $saving = signal<boolean>(false);
  public readonly $saved = signal<boolean>(false);
  public readonly $structure = signal<BuilderNode[]>([]);

  /** Drives the post-save "reload now?" confirmation modal. */
  private readonly _$reloadModalOpen = signal<boolean>(false);
  public readonly reloadModalOpen$ = toObservable(this._$reloadModalOpen);
  public readonly $pluginPages = signal<Array<ExternalPluginMenuPage>>([]);

  /** True while a drag is in progress, so the panels can desaturate the sections that cannot receive it. */
  public readonly $dragging = signal<boolean>(false);

  public readonly $editorOpen = signal<boolean>(false);
  public readonly $editorKind = signal<MenuConfigurationItem['kind']>('catalog');
  /** True while editing a required item (Admin/Settings) — its Include-function field is suppressed. */
  public readonly $editorRequired = signal<boolean>(false);

  /**
   * Bumped whenever ngx-translate (re)loads, so the translated palette/section labels — resolved
   * imperatively via `translateService.instant` inside computeds — recompute once translations arrive
   * (a plain computed would otherwise keep the raw keys captured on first, pre-load evaluation).
   */
  private readonly $translationTick = signal<number>(0);

  public readonly $paletteGroups = computed<PaletteGroup[]>(() => {
    this.$translationTick();
    return this._buildPaletteGroups();
  });

  /**
   * All structure drop-list ids (root + every container), so each list — including palette lists and
   * the nested container lists — connects to every structure list **by id**. CDK resolves these ids
   * globally, so connections work regardless of DOM/DI nesting (a `cdkDropListGroup` would not see a
   * nested list whose template is declared outside the group element).
   */
  public readonly $structureListIds = computed<string[]>(() => {
    // Container lists are listed BEFORE the root list so that, where a nested section's drop zone
    // overlaps the root list's area, CDK resolves to the inner (section) list first. The result:
    // dropping inside a section's box lands in that section, while the section header row and the
    // top-level gaps (covered only by the root list) still drop at the top level.
    const containerIds: string[] = [];
    this._walk(this.$structure(), node => {
      if (this.isContainer(node)) containerIds.push(this.containerListId(node));
    });
    return [...containerIds, 'structure-root'];
  });

  public readonly includeFunctionKeys: string[] = Object.keys(IncludeFunction).filter(key =>
    isNaN(Number(key))
  );

  public readonly editorForm = this.fb.group({
    title: this.fb.control('', Validators.required),
    link: this.fb.control(''),
    icon: this.fb.control<string | null>(null),
    includeFunction: this.fb.control<string | null>(null),
    section: this.fb.control<string>('root'),
  });

  /** Sections an item can be placed in via the editor: top level + each container present in the tree. */
  public readonly $sectionOptions = computed<Array<{value: string; label: string}>>(() => {
    this.$translationTick();
    const options = [
      {
        value: 'root',
        label: this.translateService.instant('adminSettings.menuConfiguration.editor.sectionRoot'),
      },
    ];
    this.$structure().forEach(node => {
      if (this.isContainer(node))
        options.push({value: this._sectionValue(node), label: this.displayTitle(node)});
    });
    return options;
  });

  /** Kinds that can be freely placed in any section (and so get the editor's Section selector). */
  private readonly SECTION_CAPABLE_KINDS: ReadonlyArray<MenuConfigurationItem['kind']> = [
    'custom-link',
    'section-header',
    'plugin-page',
  ];

  public readonly $editorShowSection = computed<boolean>(() =>
    this.SECTION_CAPABLE_KINDS.includes(this.$editorKind())
  );

  /** Tracks the editor's currently selected section so the icon field can react to placement changes. */
  private readonly $editorSection = toSignal(this.editorForm.controls.section.valueChanges, {
    initialValue: this.editorForm.controls.section.value,
  });

  /**
   * The icon only surfaces in the rendered menu for top-level entries, so the editor hides the icon
   * field for section headers and for any item placed inside a section (a sub-menu item).
   */
  public readonly $editorShowIcon = computed<boolean>(
    () => this.$editorKind() !== 'section-header' && this.$editorSection() === 'root'
  );

  private _editingUid: string | null = null;
  private _pendingPaletteItem: PaletteItem | null = null;
  private _uidCounter = 0;

  // Drop predicates — placement constraints. Every predicate also defers to a deeper nested list under
  // the pointer (see `_pointerOverDeeperList`), so the innermost list always wins: without this, the
  // root list — which geometrically encloses every nested list — would steal freely-placeable ('any')
  // items (custom links, section headers, plugin pages) out of a section while you reorder inside it,
  // because root accepts them (catalog items are protected only by their placement constraint).
  // Palette lists reject all drops (you drag *out* of them).
  public readonly topEnterPredicate = (drag: CdkDrag, drop: CdkDropList): boolean =>
    !this._pointerOverDeeperList(drop) && ['top', 'any'].includes(this._placementOf(drag.data));
  public readonly adminEnterPredicate = (drag: CdkDrag, drop: CdkDropList): boolean =>
    !this._pointerOverDeeperList(drop) && this._containerAccepts('admin', drag.data);
  public readonly developmentEnterPredicate = (drag: CdkDrag, drop: CdkDropList): boolean =>
    !this._pointerOverDeeperList(drop) && this._containerAccepts('development', drag.data);
  // A custom section only accepts freely-placeable ('any') items — never another section or a
  // placement-constrained catalog page — so the menu never nests beyond the two levels it renders.
  public readonly groupEnterPredicate = (drag: CdkDrag, drop: CdkDropList): boolean =>
    !this._pointerOverDeeperList(drop) && this._placementOf(drag.data) === 'any';
  public readonly paletteEnterPredicate = (): boolean => false;

  /** Last known pointer position during a drag, used to resolve nested drop-list ambiguity. */
  private _pointer = {x: 0, y: 0};
  private readonly _trackPointer = (event: PointerEvent | TouchEvent): void => {
    const point = 'touches' in event ? event.touches[0] : event;
    if (point) this._pointer = {x: point.clientX, y: point.clientY};
  };

  /**
   * True when a `.valtimo-drag-drop-list` nested *inside* `drop` currently sits under the pointer.
   * Such a deeper list is the more specific target, so `drop` should decline the item — this keeps a
   * reorder inside a section from being hijacked by the enclosing (ancestor) list.
   */
  private _pointerOverDeeperList(drop: CdkDropList): boolean {
    const nested = (drop.element.nativeElement as HTMLElement).querySelectorAll(
      '.valtimo-drag-drop-list'
    );
    return Array.from(nested).some(list => {
      const r = list.getBoundingClientRect();
      return (
        this._pointer.x >= r.left &&
        this._pointer.x <= r.right &&
        this._pointer.y >= r.top &&
        this._pointer.y <= r.bottom
      );
    });
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly adminSettingsService: AdminSettingsService,
    private readonly pluginPageService: ExternalPluginPageService,
    private readonly configService: ConfigService,
    private readonly translateService: TranslateService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Add16, Edit16, Locked16, TrashCan16]);

    merge(
      this.translateService.onLangChange,
      this.translateService.onDefaultLangChange,
      this.translateService.onTranslationChange
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.$translationTick.update(tick => tick + 1));
  }

  public ngOnInit(): void {
    this.load();
  }

  // ----- Loading & seeding -----

  public load(): void {
    this.$loading.set(true);
    forkJoin({
      dto: this.adminSettingsService
        .getMenuConfiguration()
        .pipe(catchError(() => of({configuration: {}}))),
      pages: this.pluginPageService.getMenuPages().pipe(catchError(() => of([]))),
    }).subscribe(({dto, pages}) => {
      this.$pluginPages.set(pages);
      const items = hasSavedMenuConfiguration(dto)
        ? (dto.configuration.items as MenuConfigurationItem[])
        : buildMenuConfigurationFromRuntimeMenu(this.configService.config?.menu?.menuItems ?? [])
            .items;
      this.$structure.set(this._assignUids(items));
      this.$loading.set(false);
    });
  }

  public onReset(): void {
    this.load();
  }

  // ----- Drag & drop -----

  public onDragStarted(): void {
    this.$dragging.set(true);
    document.addEventListener('pointermove', this._trackPointer, true);
    document.addEventListener('touchmove', this._trackPointer, true);
  }

  public onDragEnded(): void {
    this.$dragging.set(false);
    document.removeEventListener('pointermove', this._trackPointer, true);
    document.removeEventListener('touchmove', this._trackPointer, true);
  }

  public onDrop(event: CdkDragDrop<BuilderNode[]>): void {
    const isFromPalette = event.previousContainer.id.startsWith('palette-');

    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else if (isFromPalette) {
      const node = this._paletteItemToNode(event.item.data as PaletteItem);
      if (!node) return;
      event.container.data.splice(event.currentIndex, 0, node);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }

    this._bump();
  }

  // ----- Palette actions -----

  public onAddPaletteItem(item: PaletteItem): void {
    // Catalog items have a fixed placement — add them straight to the matching section.
    if (item.paletteType === 'catalog') {
      const node = this._paletteItemToNode(item);
      if (!node) return;
      this._defaultTargetFor(item).push(node);
      this._bump();
      return;
    }

    // Generic (custom link, section header, section/group) + plugin-page items open the editor so
    // the admin can set the title and pick the section (top level, Admin, a custom section, …)
    // before the item is committed to the tree.
    this.openNewItemEditor(item);
  }

  // ----- Row actions -----

  public openEditor(node: BuilderNode): void {
    this._editingUid = node._uid;
    this._pendingPaletteItem = null;
    this.$editorKind.set(node.kind);
    this.$editorRequired.set(this.isRequired(node));

    this.editorForm.reset({
      title: this._editableTitle(node),
      link: node.kind === 'custom-link' ? node.link : this._displayRoute(node),
      icon: this._mdiKeyFromIconClass(this._displayIconClass(node)),
      // Empty string (not null) so the "Geen" option (value="") is selected on open when the item
      // carries no include function — a null value would leave the native select blank.
      includeFunction:
        node.kind === 'catalog' && !this.isRequired(node) && node.includeFunction !== undefined
          ? IncludeFunction[node.includeFunction]
          : '',
      section: this._findSectionOf(node._uid),
    });

    this._syncLinkControl(node.kind);
    this.$editorOpen.set(true);
  }

  public openNewItemEditor(item: PaletteItem): void {
    this._editingUid = null;
    this._pendingPaletteItem = item;
    this.$editorKind.set(item.paletteType);
    this.$editorRequired.set(false);

    const defaultTitle =
      item.paletteType === 'section-header'
        ? this.translateService.instant('adminSettings.menuConfiguration.defaults.sectionHeader')
        : item.paletteType === 'custom-link'
          ? this.translateService.instant('adminSettings.menuConfiguration.defaults.customLink')
          : item.paletteType === 'group'
            ? this.translateService.instant('adminSettings.menuConfiguration.defaults.group')
            : item.label;

    this.editorForm.reset({
      title: defaultTitle,
      link: item.paletteType === 'custom-link' ? '/' : '',
      icon: item.icon ? this._mdiKeyFromIconClass(item.icon) : null,
      includeFunction: '',
      section: 'root',
    });

    this._syncLinkControl(item.paletteType);
    this.$editorOpen.set(true);
  }

  public onEditorSave(): void {
    if (this.editorForm.invalid) return;
    const value = this.editorForm.getRawValue();

    const node =
      this._editingUid !== null
        ? this._findByUid(this.$structure(), this._editingUid)
        : this._pendingPaletteItem
          ? this._paletteItemToNode(this._pendingPaletteItem)
          : null;
    if (!node) {
      this.closeEditor();
      return;
    }

    node.title = (value.title ?? '').trim();
    if (node.kind === 'custom-link') {
      node.link = (value.link ?? '').trim();
    }
    if (node.kind === 'catalog' || node.kind === 'custom-link' || node.kind === 'plugin-page') {
      const iconClass = this._iconClassFromMdiKey(value.icon);
      if (iconClass) {
        node.icon = iconClass;
      } else if (this._editingUid !== null) {
        delete node.icon;
      }
    }
    if (node.kind === 'catalog') {
      // Required items must never carry an include function (it could hide them at runtime).
      node.includeFunction =
        this.isRequired(node) || !value.includeFunction
          ? undefined
          : IncludeFunction[value.includeFunction as keyof typeof IncludeFunction];
      if (node.includeFunction === undefined) delete node.includeFunction;
    }

    this._placeNode(node, value.section ?? 'root');
    this._bump();
    this.closeEditor();
  }

  public closeEditor(): void {
    this.$editorOpen.set(false);
    this._editingUid = null;
    this._pendingPaletteItem = null;
  }

  /** Commits a (new or edited) node into the chosen section, moving it if its section changed. */
  private _placeNode(node: BuilderNode, section: string): void {
    const sectionCapable = this.SECTION_CAPABLE_KINDS.includes(node.kind);

    if (this._editingUid !== null) {
      // Existing node: only move it when it is section-capable and the section actually changed.
      if (sectionCapable && this._findSectionOf(node._uid) !== section) {
        this._removeByUid(this.$structure(), node._uid);
        this._targetForSection(section).push(node);
      }
      return;
    }

    // New node: place into the chosen section (top level for non-section-capable kinds).
    const target = sectionCapable ? this._targetForSection(section) : this.$structure();
    target.push(node);
  }

  private _syncLinkControl(kind: MenuConfigurationItem['kind']): void {
    if (kind === 'custom-link') {
      this.editorForm.controls.link.enable();
    } else {
      this.editorForm.controls.link.disable();
    }
  }

  public onRemove(node: BuilderNode): void {
    if (this.isRequired(node)) return;
    this._removeByUid(this.$structure(), node._uid);
    this._bump();
  }

  public onSave(): void {
    this.$saving.set(true);
    this.$saved.set(false);
    const configuration: MenuConfiguration = {
      version: MENU_CONFIGURATION_VERSION,
      items: this._stripUids(this.$structure()),
    };
    this.adminSettingsService.updateMenuConfiguration({configuration}).subscribe({
      next: () => {
        this.$saving.set(false);
        this._$reloadModalOpen.set(true);
      },
      error: () => this.$saving.set(false),
    });
  }

  /** Reload the app so the freshly saved menu takes effect. */
  public onReloadConfirm(): void {
    window.location.reload();
  }

  /** Dismiss the reload modal, leaving a persistent inline reminder that a reload is still pending. */
  public onReloadDismiss(): void {
    this._$reloadModalOpen.set(false);
    this.$saved.set(true);
  }

  /** Dismiss the persistent "menu saved" reminder. */
  public onDismissSavedNotification(): void {
    this.$saved.set(false);
  }

  // ----- Display helpers (used by the template) -----

  public isContainer(node: BuilderNode): boolean {
    return (
      node.kind === 'group' ||
      (node.kind === 'catalog' && (node.itemId === 'admin' || node.itemId === 'development'))
    );
  }

  public isRequired(node: BuilderNode): boolean {
    return node.kind === 'catalog' && !!getMenuCatalogEntry(node.itemId)?.required;
  }

  public hasRuntimeSubmenu(node: BuilderNode): boolean {
    return node.kind === 'catalog' && (node.itemId === 'cases' || node.itemId === 'objects');
  }

  public displayTitle(node: BuilderNode): string {
    if (node.kind === 'catalog') {
      return this.translateService.instant(
        node.title ?? getMenuCatalogEntry(node.itemId)?.defaultTitleKey ?? node.itemId
      );
    }
    return node.title;
  }

  public childrenOf(node: BuilderNode): BuilderNode[] {
    return this._childArray(node) ?? [];
  }

  public containerListId(node: BuilderNode): string {
    return `structure-children-${node.kind === 'catalog' ? node.itemId : node._uid}`;
  }

  public containerEnterPredicate(node: BuilderNode): (drag: CdkDrag, drop: CdkDropList) => boolean {
    if (node.kind === 'group') return this.groupEnterPredicate;
    if (node.kind === 'catalog' && node.itemId === 'development')
      return this.developmentEnterPredicate;
    return this.adminEnterPredicate;
  }

  public iconClassOf(node: BuilderNode): string | null {
    return this._displayIconClass(node);
  }

  public routeOf(node: BuilderNode): string {
    return this._displayRoute(node);
  }

  public trackByUid = (_: number, node: BuilderNode): string => node._uid;

  // ----- Private helpers -----

  private _displayIconClass(node: BuilderNode): string | null {
    if (node.kind === 'catalog')
      return node.icon ?? getMenuCatalogEntry(node.itemId)?.defaultIcon ?? null;
    if (node.kind === 'custom-link' || node.kind === 'plugin-page' || node.kind === 'group') {
      return node.icon ?? null;
    }
    return null;
  }

  private _displayRoute(node: BuilderNode): string {
    switch (node.kind) {
      case 'catalog':
        return getMenuCatalogEntry(node.itemId)?.link ?? '';
      case 'custom-link':
        return node.link;
      case 'plugin-page':
        return `/plugin-pages/${node.configurationId}${node.bundleKey ? `/${node.bundleKey}` : ''}`;
      default:
        return '';
    }
  }

  private _editableTitle(node: BuilderNode): string {
    if (node.kind === 'catalog')
      return node.title ?? getMenuCatalogEntry(node.itemId)?.defaultTitleKey ?? '';
    return node.title;
  }

  private _placementOf(data: PaletteItem | BuilderNode): MenuItemPlacement {
    if (data && 'paletteType' in data) {
      if (data.paletteType === 'catalog' && data.itemId) {
        return getMenuCatalogEntry(data.itemId)?.placement ?? 'any';
      }
      // A section (group) is top-level only; everything else generic is freely placeable.
      return data.paletteType === 'group' ? 'top' : 'any';
    }
    if (data && 'kind' in data && data.kind === 'catalog') {
      return getMenuCatalogEntry(data.itemId)?.placement ?? 'any';
    }
    return data && 'kind' in data && data.kind === 'group' ? 'top' : 'any';
  }

  private _containerAccepts(
    placement: MenuItemPlacement,
    data: PaletteItem | BuilderNode
  ): boolean {
    const itemPlacement = this._placementOf(data);
    return itemPlacement === 'any' || itemPlacement === placement;
  }

  private _paletteItemToNode(item: PaletteItem): BuilderNode | null {
    switch (item.paletteType) {
      case 'catalog':
        return item.itemId ? this._withUid({kind: 'catalog', itemId: item.itemId}) : null;
      case 'group':
        return this._withUid({
          kind: 'group',
          title: this.translateService.instant('adminSettings.menuConfiguration.defaults.group'),
          children: [],
        });
      case 'section-header':
        return this._withUid({
          kind: 'section-header',
          title: this.translateService.instant(
            'adminSettings.menuConfiguration.defaults.sectionHeader'
          ),
        });
      case 'custom-link':
        return this._withUid({
          kind: 'custom-link',
          title: this.translateService.instant(
            'adminSettings.menuConfiguration.defaults.customLink'
          ),
          link: '/',
        });
      case 'plugin-page':
        return item.page
          ? this._withUid({
              kind: 'plugin-page',
              configurationId: item.page.configurationId,
              bundleKey: item.page.bundleKey ?? undefined,
              title: item.label,
              icon: item.page.icon ?? undefined,
            })
          : null;
      default:
        return null;
    }
  }

  private _defaultTargetFor(item: PaletteItem): BuilderNode[] {
    // Drag is unconstrained for these items, but the Add button still drops a page into its natural
    // home section by default (its catalog category), falling back to the top level.
    if (item.paletteType === 'catalog' && item.itemId) {
      const category = getMenuCatalogEntry(item.itemId)?.category;
      if (category === 'admin') return this._targetForSection('admin');
      if (category === 'development') return this._targetForSection('development');
    }
    return this.$structure();
  }

  /** A container's stable section id: catalog `itemId` for Admin/Development, `_uid` for a custom section. */
  private _sectionValue(node: BuilderNode): string {
    return node.kind === 'catalog' ? node.itemId : node._uid;
  }

  /** The array that backs a section id (`'root'`, a catalog `itemId`, or a group `_uid`), creating children if needed. */
  private _targetForSection(section: string): BuilderNode[] {
    if (!section || section === 'root') return this.$structure();
    const container = this.$structure().find(
      node => this.isContainer(node) && this._sectionValue(node) === section
    );
    if (container && (container.kind === 'catalog' || container.kind === 'group')) {
      container.children = (container.children as BuilderNode[]) ?? [];
      return container.children as BuilderNode[];
    }
    return this.$structure();
  }

  /** Which section a node currently lives in: `'root'` or the containing section's id. */
  private _findSectionOf(uid: string): string {
    if (this.$structure().some(node => node._uid === uid)) return 'root';
    for (const node of this.$structure()) {
      const children = this._childArray(node);
      if (children && children.some(child => child._uid === uid)) {
        return this._sectionValue(node);
      }
    }
    return 'root';
  }

  private _buildPaletteGroups(): PaletteGroup[] {
    const placedCatalog = new Set<string>();
    const placedPlugins = new Set<string>();
    this._walk(this.$structure(), node => {
      if (node.kind === 'catalog') placedCatalog.add(node.itemId);
      if (node.kind === 'plugin-page')
        placedPlugins.add(this._pluginKey(node.configurationId, node.bundleKey));
    });

    const fromCatalog = (category: string): PaletteItem[] =>
      MENU_ITEM_CATALOG.filter(
        entry => entry.category === category && !placedCatalog.has(entry.itemId)
      ).map(entry => ({
        paletteType: 'catalog',
        itemId: entry.itemId,
        label: this.translateService.instant(entry.defaultTitleKey),
        icon: entry.defaultIcon,
      }));

    const pluginPages: PaletteItem[] = this.$pluginPages()
      .filter(page => !placedPlugins.has(this._pluginKey(page.configurationId, page.bundleKey)))
      .map(page => ({
        paletteType: 'plugin-page',
        page,
        label: this._localizedPluginTitle(page),
        icon: page.icon ?? undefined,
      }));

    return [
      {
        categoryKey: 'generic',
        items: [
          {
            paletteType: 'group',
            label: this.translateService.instant('adminSettings.menuConfiguration.generic.group'),
          },
          {
            paletteType: 'section-header',
            label: this.translateService.instant(
              'adminSettings.menuConfiguration.generic.sectionHeader'
            ),
          },
          {
            paletteType: 'custom-link',
            label: this.translateService.instant(
              'adminSettings.menuConfiguration.generic.customLink'
            ),
          },
        ],
      },
      {categoryKey: 'main', items: fromCatalog('main')},
      {categoryKey: 'admin', items: fromCatalog('admin')},
      {categoryKey: 'development', items: fromCatalog('development')},
      {categoryKey: 'pluginPages', items: pluginPages},
    ];
  }

  private _localizedPluginTitle(page: ExternalPluginMenuPage): string {
    const lang = this.translateService.currentLang ?? this.translateService.defaultLang ?? 'en';
    return page.titleTranslations?.[lang] ?? page.title ?? page.configurationTitle;
  }

  private _pluginKey(configurationId: string, bundleKey: string | null | undefined): string {
    return `${configurationId}:${bundleKey ?? ''}`;
  }

  /**
   * The MDI icon selector works with the full MDI class token (e.g. `mdi-view-dashboard`) — its
   * preview binds the value straight onto an element class and `POPULAR_MDI_ICONS` is `mdi-*` keyed
   * — so we keep the `mdi-` prefix here (stripping it broke the preview and double-prefixed on save).
   */
  private _mdiKeyFromIconClass(iconClass: string | null): string | null {
    if (!iconClass) return null;
    const match = iconClass.match(/(mdi-[a-z0-9-]+)/i);
    return match ? match[1] : null;
  }

  /** Builds the menu `iconClass` from the selector's MDI class token (`mdi-view-dashboard` → `icon mdi mdi-view-dashboard`). */
  private _iconClassFromMdiKey(key: string | null | undefined): string | undefined {
    return key ? `icon mdi ${key}` : undefined;
  }

  // ----- Tree utilities -----

  /** The editable children array of a branch node (catalog group or custom section), else null. */
  private _childArray(node: BuilderNode): BuilderNode[] | null {
    if ((node.kind === 'catalog' || node.kind === 'group') && Array.isArray(node.children)) {
      return node.children as BuilderNode[];
    }
    return null;
  }

  private _withUid(node: MenuConfigurationItem): BuilderNode {
    return {...node, _uid: `node-${this._uidCounter++}`} as BuilderNode;
  }

  private _assignUids(items: MenuConfigurationItem[]): BuilderNode[] {
    return items.map(item => {
      const node = this._withUid(item);
      const children = this._childArray(node);
      if (children) {
        (node as {children: BuilderNode[]}).children = this._assignUids(children);
      }
      return node;
    });
  }

  private _walk(nodes: BuilderNode[], visit: (node: BuilderNode) => void): void {
    nodes.forEach(node => {
      visit(node);
      const children = this._childArray(node);
      if (children) this._walk(children, visit);
    });
  }

  private _findByUid(nodes: BuilderNode[], uid: string): BuilderNode | null {
    for (const node of nodes) {
      if (node._uid === uid) return node;
      const children = this._childArray(node);
      if (children) {
        const found = this._findByUid(children, uid);
        if (found) return found;
      }
    }
    return null;
  }

  private _removeByUid(nodes: BuilderNode[], uid: string): boolean {
    const index = nodes.findIndex(node => node._uid === uid);
    if (index >= 0) {
      nodes.splice(index, 1);
      return true;
    }
    return nodes.some(node => {
      const children = this._childArray(node);
      return !!children && this._removeByUid(children, uid);
    });
  }

  /** Deep-clones array references so the OnPush drag-drop lists re-render after an in-place mutation. */
  private _bump(): void {
    this.$saved.set(false);
    this.$structure.set(this._clone(this.$structure()));
  }

  private _clone(nodes: BuilderNode[]): BuilderNode[] {
    return nodes.map(node => {
      const copy = {...node} as BuilderNode;
      const children = this._childArray(node);
      if (children) (copy as {children: BuilderNode[]}).children = this._clone(children);
      return copy;
    });
  }

  /** Produces the persisted structure without the transient `_uid` fields. */
  private _stripUids(nodes: BuilderNode[]): MenuConfigurationItem[] {
    return nodes.map(node => {
      const {_uid, ...rest} = node as BuilderNode & {_uid: string};
      const clean = rest as MenuConfigurationItem;
      if ((clean.kind === 'catalog' || clean.kind === 'group') && Array.isArray(clean.children)) {
        clean.children = this._stripUids(clean.children as BuilderNode[]);
      }
      return clean;
    });
  }
}
