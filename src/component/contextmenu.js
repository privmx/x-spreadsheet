import { h } from './element';
import { bindClickoutside, unbindClickoutside } from './event';
import { cssPrefix } from '../config';
import { tf } from '../locale/locale';

const menuItems = [
  { key: 'copy', title: tf('contextmenu.copy'), label: 'Ctrl+C' },
  { key: 'cut', title: tf('contextmenu.cut'), label: 'Ctrl+X' },
  { key: 'paste', title: tf('contextmenu.paste'), label: 'Ctrl+V' },
  { key: 'paste-value', title: tf('contextmenu.pasteValue'), label: 'Ctrl+Shift+V' },
  { key: 'paste-format', title: tf('contextmenu.pasteFormat'), label: 'Ctrl+Alt+V' },
  { key: 'divider' },
  { key: 'insert-row-before', title: tf('contextmenu.insertRowBefore') },
  { key: 'insert-row-after', title: tf('contextmenu.insertRowAfter') },
  { key: 'insert-rows-before', title: tf('contextmenu.insertRowsBefore') },
  { key: 'insert-rows-after', title: tf('contextmenu.insertRowsAfter') },
  { key: 'insert-column-before', title: tf('contextmenu.insertColumnBefore') },
  { key: 'insert-column-after', title: tf('contextmenu.insertColumnAfter') },
  { key: 'insert-columns-before', title: tf('contextmenu.insertColumnsBefore') },
  { key: 'insert-columns-after', title: tf('contextmenu.insertColumnsAfter') },
  { key: 'divider' },
  { key: 'delete-row', title: tf('contextmenu.deleteRow') },
  { key: 'delete-rows', title: tf('contextmenu.deleteRows') },
  { key: 'delete-column', title: tf('contextmenu.deleteColumn') },
  { key: 'delete-columns', title: tf('contextmenu.deleteColumns') },
  { key: 'delete-cell-text', title: tf('contextmenu.deleteCellText') },
  { key: 'hide', title: tf('contextmenu.hide') },
  { key: 'divider' },
  { key: 'reset-row-height', title: tf('contextmenu.resetRowHeight') },
  { key: 'reset-column-width', title: tf('contextmenu.resetColumnWidth') },
  { key: 'divider' },
  { key: 'validation', title: tf('contextmenu.validation') },
  { key: 'divider' },
  { key: 'cell-printable', title: tf('contextmenu.cellprintable') },
  { key: 'cell-non-printable', title: tf('contextmenu.cellnonprintable') },
  { key: 'divider' },
  { key: 'cell-editable', title: tf('contextmenu.celleditable') },
  { key: 'cell-non-editable', title: tf('contextmenu.cellnoneditable') },
];

function buildMenuItem(item) {
  let el = null;
  if (item.key === 'divider') {
    el = h('div', `${cssPrefix}-item divider`);
  }
  else {
    el = h('div', `${cssPrefix}-item`)
      .on('click', () => {
        if (item.callback) {
          item.callback(this.targetRange);
        }
        this.itemClick(item.key);
        this.hide();
      })
      .children(
        item.title(),
        h('div', 'label').child(item.label || ''),
      );
  }
  el.attr("data-key", item.key);
  el.key = item.key;
  return el;
}

function buildMenu(extraItems) {
  const processedMenuItems = [...menuItems];
  if (extraItems && extraItems.length > 0) {
    processedMenuItems.push({ key: 'divider' });
    for (const item of extraItems) {
      processedMenuItems.push(item);
    }
  }
  if (this.contextMenuOptions && this.contextMenuOptions.itemsCallback) {
    this.contextMenuOptions.itemsCallback(processedMenuItems);
  }
  return processedMenuItems.map(it => buildMenuItem.call(this, it));
}

export default class ContextMenu {
  constructor(viewFn, isHide = false, isHideForRange = false, contextMenuOptions = null) {
    this.contextMenuOptions = contextMenuOptions;
    this.menuItems = buildMenu.call(this, contextMenuOptions.extraItems);
    this.el = h('div', `${cssPrefix}-contextmenu`)
      .children(...this.menuItems)
      .hide();
    this.viewFn = viewFn;
    this.itemClick = () => {};
    this.isHide = isHide;
    this.isHideForRange = isHideForRange;
    this.setTargetRange({ sci: 0, eci: 0, sri: 0, eri: 0 });
  }

  setTargetRange(range) {
    this.targetRange = range;
    const hideEl = this.getItemByKey('hide');
    let mode = 'range';
    if (range.sci < 0) {
      mode = 'row';
    }
    else if (range.sri < 0) {
      mode = 'col';
    }
    this.mode = mode;
    if (mode === 'range') {
      if (this.isHideForRange) {
        this.hide();
      }
      if (hideEl) {
        hideEl.hide();
      }
    } else {
      if (hideEl) {
        hideEl.show();
      }
    }
    for (const item of this.contextMenuOptions.extraItems) {
      const show = item.isVisibleCallback(range);
      this.toggleShowElements([this.getItemByKey(item.key)], show);
    }
    this.toggleShowSingleColumnElements(range.sci >= 0 && range.sci === range.eci);
    this.toggleShowMultiColumnElements(range.sci >= 0 && range.sci !== range.eci);
    this.toggleShowSingleRowElements(range.sri >= 0 && range.sri === range.eri);
    this.toggleShowMultiRowElements(range.sri >= 0 && range.sri !== range.eri);
    this.toggleShowElements([this.getItemByKey('reset-column-width')], range.sci >= 0);
    this.toggleShowElements([this.getItemByKey('reset-row-height')], range.sri >= 0);
    
    for (const item of this.menuItems) {
      if (item.key === 'divider') {
        item.show();
      }
    }
    
    let hasPrevVisibleItem = false;
    for (let i = 0; i < this.menuItems.length; ++i) {
      const item = this.menuItems[i];
      if (item.key === 'divider') {
        if (!hasPrevVisibleItem) {
          item.hide();
        }
        hasPrevVisibleItem = false;
      }
      else {
        hasPrevVisibleItem = hasPrevVisibleItem || !item.isHidden();
      }
    }
    hasPrevVisibleItem = false;
    for (let i = this.menuItems.length - 1; i > 0; --i) {
      const item = this.menuItems[i]; 
      if (item.key === 'divider') {
        if (!hasPrevVisibleItem) {
          item.hide();
        }
        hasPrevVisibleItem = false;
      }
      else {
        hasPrevVisibleItem = hasPrevVisibleItem || !item.isHidden();
      }
    }
  }
  
  getItemByKey(key) {
    for (const item of this.menuItems) {
      if (item.key === key) {
        return item;
      }
    }
    return null;
  }
  
  toggleShowSingleColumnElements(show) {
    const elements = [
      this.getItemByKey('delete-column'),
      this.getItemByKey('insert-column-before'),
      this.getItemByKey('insert-column-after'),
    ];
    this.toggleShowElements(elements, show);
  }
  
  toggleShowMultiColumnElements(show) {
    const elements = [
      this.getItemByKey('delete-columns'),
      this.getItemByKey('insert-columns-before'),
      this.getItemByKey('insert-columns-after'),
    ];
    this.toggleShowElements(elements, show);
  }
  
  toggleShowSingleRowElements(show) {
    const elements = [
      this.getItemByKey('delete-row'),
      this.getItemByKey('insert-row-before'),
      this.getItemByKey('insert-row-after'),
    ];
    this.toggleShowElements(elements, show);
  }
  
  toggleShowMultiRowElements(show) {
    const elements = [
      this.getItemByKey('delete-rows'),
      this.getItemByKey('insert-rows-before'),
      this.getItemByKey('insert-rows-after'),
    ];
    this.toggleShowElements(elements, show);
  }
  
  toggleShowElements(elements, show) {
    const hide = !show;
    for (const element of elements) {
      if (element) {
        if (hide) {
          element.hide();
        }
        else {
          element.show();
        }
      }
    }
  }

  hide() {
    const { el } = this;
    el.hide();
    unbindClickoutside(el);
  }

  setPosition(x, y) {
    if (this.isHide) return;
    if (this.isHideForRange && this.mode === 'range') return;
    const { el } = this;
    if (this.origElements) {
      const el = this.el.el;
      for (let i = el.children.length - 1; i >= 0; --i) {
        el.removeChild(el.children[i]);
      }
      for (let i = 0; i < this.origElements.length; ++i) {
        el.appendChild(this.origElements[i]);
      }
    }
    this.origElements = this.el.el.querySelectorAll('.x-spreadsheet-item');
    if (this.contextMenuOptions && this.contextMenuOptions.preShowCallback) {
      this.contextMenuOptions.preShowCallback(el.el, this.targetRange);
    }
    const { width } = el.show().offset();
    const view = this.viewFn();
    const vhf = view.height / 2;
    let left = x;
    if (view.width - x <= width) {
      left -= width;
    }
    el.css('left', `${left}px`);
    if (y > vhf) {
      el.css('bottom', `${view.height - y}px`)
        .css('max-height', `${y}px`)
        .css('top', 'auto');
    } else {
      el.css('top', `${y}px`)
        .css('max-height', `${view.height - y}px`)
        .css('bottom', 'auto');
    }
    bindClickoutside(el);
  }
}
