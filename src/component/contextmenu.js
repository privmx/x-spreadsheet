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
  { key: 'insert-row', title: tf('contextmenu.insertRow') },
  { key: 'insert-column', title: tf('contextmenu.insertColumn') },
  { key: 'divider' },
  { key: 'delete-row', title: tf('contextmenu.deleteRow') },
  { key: 'delete-column', title: tf('contextmenu.deleteColumn') },
  { key: 'delete-cell-text', title: tf('contextmenu.deleteCellText') },
  { key: 'hide', title: tf('contextmenu.hide') },
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
        this.itemClick(item.key);
        this.hide();
      })
      .children(
        item.title(),
        h('div', 'label').child(item.label || ''),
      );
  }
  el.key = item.key;
  return el;
}

function buildMenu() {
  return menuItems.map(it => buildMenuItem.call(this, it));
}

export default class ContextMenu {
  constructor(viewFn, isHide = false, isHideForRange = false) {
    this.menuItems = buildMenu.call(this);
    this.el = h('div', `${cssPrefix}-contextmenu`)
      .children(...this.menuItems)
      .hide();
    this.viewFn = viewFn;
    this.itemClick = () => {};
    this.isHide = isHide;
    this.isHideForRange = isHideForRange;
    this.setMode('range');
    this.mode = 'range';
  }

  // row: the whole rows
  // col: the whole cols
  // range: select range
  setMode(mode) {
    const hideEl = this.getItemByKey('hide');
    this.mode = mode;
    if (mode === 'row' || mode === 'col') {
      hideEl.show();
    } else {
      if (this.isHideForRange) {
        this.hide();
      }
      hideEl.hide();
    }
    this.toggleShowRowElements(mode !== 'col');
    this.toggleShowColumnElements(mode !== 'row');
  }
  
  getItemByKey(key) {
    for (const item of this.menuItems) {
      if (item.key === key) {
        return item;
      }
    }
    return null;
  }
  
  toggleShowColumnElements(show) {
    const hide = !show;
    const columnElements = [
      this.getItemByKey('delete-column'),
      this.getItemByKey('insert-column'),
    ];
    for (const element of columnElements) {
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
  
  toggleShowRowElements(show) {
    const hide = !show;
    const rowElements = [
      this.getItemByKey('delete-row'),
      this.getItemByKey('insert-row'),
    ];
    for (const element of rowElements) {
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
