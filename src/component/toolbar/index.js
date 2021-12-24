/* global window */

import Align from './align';
import Valign from './valign';
import Autofilter from './autofilter';
import Bold from './bold';
import Italic from './italic';
import Strike from './strike';
import Underline from './underline';
import Border from './border';
import Clearformat from './clearformat';
import Paintformat from './paintformat';
import TextColor from './text_color';
import FillColor from './fill_color';
import FontSize from './font_size';
import Font from './font';
import Format from './format';
import Formula from './formula';
import Freeze from './freeze';
import Merge from './merge';
import Redo from './redo';
import Undo from './undo';
import Print from './print';
import Textwrap from './textwrap';
import More from './more';
import Item from './item';

import { h } from '../element';
import { cssPrefix } from '../../config';
import { bind } from '../event';
import { t } from '../../locale/locale';

function buildDivider() {
  return h('div', `${cssPrefix}-toolbar-divider`);
}

function initBtns2() {
  this.btns2 = [];
  this.items.forEach((it) => {
    if (Array.isArray(it)) {
      it.forEach(({ el }) => {
        const rect = el.box();
        const { marginLeft, marginRight } = el.computedStyle();
        this.btns2.push([el, rect.width + parseInt(marginLeft, 10) + parseInt(marginRight, 10)]);
      });
    } else {
      const rect = it.box();
      const { marginLeft, marginRight } = it.computedStyle();
      this.btns2.push([it, rect.width + parseInt(marginLeft, 10) + parseInt(marginRight, 10)]);
    }
  });
}

function moreResize() {
  const {
    el, btns, moreEl, btns2,
  } = this;
  const { moreBtns, contentEl } = moreEl.dd;
  el.css('width', `${this.widthFn()}px`);
  const elBox = el.box();

  let sumWidth = 160;
  let sumWidth2 = 12;
  const list1 = [];
  const list2 = [];
  btns2.forEach(([it, w], index) => {
    sumWidth += w;
    if (index === btns2.length - 1 || sumWidth < elBox.width) {
      list1.push(it);
    } else {
      sumWidth2 += w;
      list2.push(it);
    }
  });
  btns.html('').children(...list1);
  moreBtns.html('').children(...list2);
  contentEl.css('width', `${sumWidth2}px`);
  if (list2.length > 0) {
    moreEl.show();
  } else {
    moreEl.hide();
  }
}

function genBtn(it) {
  const btn = new Item();
  btn.el.on('click', () => {
    if (it.onClick) it.onClick(this.data.getData(), this.data);
  });
  btn.tip = it.tip || '';

  let { el } = it;

  if (it.icon) {
    el = h('img').attr('src', it.icon);
  }

  if (el) {
    const icon = h('div', `${cssPrefix}-icon`);
    icon.child(el);
    btn.el.child(icon);
  }

  return btn;
}

function removeNullToolbarItems(items) {
  // Remove items that are null
  for (const idx in items) {
    if (Array.isArray(items[idx])) {
      items[idx] = items[idx].filter(item => item !== null);
    }
  }
  
  // Remove blocks that have no items
  const idxsToRemove = [];
  for (const idx in items) {
    if (Array.isArray(items[idx]) && items[idx].length === 0) {
      idxsToRemove.push(idx);
    }
  }
  idxsToRemove.reverse().forEach(idx => {
    items.splice(idx, 1);
  });
  
  // Remove dividers that don't have blocks of items that surround them
  idxsToRemove.length = 0;
  let prevIsBlock = false;
  let nextIsBlock = false;
  for (let idx = items.length - 1; idx >= 0; --idx) {
    const item = items[idx];
    if (!Array.isArray(item)) {
      prevIsBlock = Array.isArray(items[idx - 1]);
      nextIsBlock = Array.isArray(items[idx + 1]);
      if (!prevIsBlock || !nextIsBlock) {
        items.splice(idx, 1);
      }
    }
  }
}

export default class Toolbar {
  constructor(data, widthFn, isHide = false) {
    this.data = data;
    this.change = () => {};
    this.widthFn = widthFn;
    this.isHide = isHide;
    const style = data.defaultStyle();
    const ts = data.settings.toolbar;
    this.items = [
      [
        this.createItem(() => this.undoEl = new Undo(), ts.misc.undo),
        this.createItem(() => this.redoEl = new Redo(), ts.misc.redo),
        this.createItem(() => new Print(), ts.misc.print),
        this.createItem(() => this.paintformatEl = new Paintformat(), ts.misc.paintFormat),
        this.createItem(() => this.clearformatEl = new Clearformat(), ts.misc.clearFormat),
      ],
      buildDivider(),
      [
        this.createItem(() => this.formatEl = new Format(), ts.format.format),
      ],
      buildDivider(),
      [
        this.createItem(() => this.fontEl = new Font(), ts.font.family),
        this.createItem(() => this.fontSizeEl = new FontSize(), ts.font.size),
      ],
      buildDivider(),
      [
        this.createItem(() => this.boldEl = new Bold(), ts.textStyle.bold),
        this.createItem(() => this.italicEl = new Italic(), ts.textStyle.italic),
        this.createItem(() => this.underlineEl = new Underline(), ts.textStyle.underline),
        this.createItem(() => this.strikeEl = new Strike(), ts.textStyle.strike),
        this.createItem(() => this.textColorEl = new TextColor(style.color), ts.textStyle.color),
      ],
      buildDivider(),
      [
        this.createItem(() => this.fillColorEl = new FillColor(style.bgcolor), ts.cell.fill),
        this.createItem(() => this.borderEl = new Border(), ts.cell.borders),
        this.createItem(() => this.mergeEl = new Merge(), ts.cell.merge),
      ],
      buildDivider(),
      [
        this.createItem(() => this.alignEl = new Align(style.align), ts.cellText.horizontalAlignment),
        this.createItem(() => this.valignEl = new Valign(style.valign), ts.cellText.verticalAlignment),
        this.createItem(() => this.textwrapEl = new Textwrap(), ts.cellText.wrap),
      ],
      buildDivider(),
      [
        this.createItem(() => this.freezeEl = new Freeze(), ts.tools.freezeCell),
        this.createItem(() => this.autofilterEl = new Autofilter(), ts.tools.filter),
        this.createItem(() => this.formulaEl = new Formula(), ts.tools.formulas),
      ],
    ];
    removeNullToolbarItems(this.items);
    if (ts.itemsCallback) {
      ts.itemsCallback(this.items);
    }

    const { extendToolbar = {} } = data.settings;

    if (extendToolbar.left && extendToolbar.left.length > 0) {
      this.items.unshift(buildDivider());
      const btns = extendToolbar.left.map(genBtn.bind(this));

      this.items.unshift(btns);
    }
    if (extendToolbar.right && extendToolbar.right.length > 0) {
      this.items.push(buildDivider());
      const btns = extendToolbar.right.map(genBtn.bind(this));
      this.items.push(btns);
    }

    this.items.push([this.moreEl = new More()]);

    this.el = h('div', `${cssPrefix}-toolbar`);
    this.btns = h('div', `${cssPrefix}-toolbar-btns`);

    this.items.forEach((it) => {
      if (Array.isArray(it)) {
        it.forEach((i) => {
          this.btns.child(i.el);
        });
      } else {
        this.btns.child(it.el);
      }
    });

    this.el.child(this.btns);
    if (isHide) {
      this.el.hide();
    } else {
      this.reset();
      setTimeout(() => {
        initBtns2.call(this);
        moreResize.call(this);
      }, 0);
      bind(window, 'resize', () => {
        moreResize.call(this);
      });
    }
  }
  
  createItem(creatorFunc, returnCondition) {
    const el = creatorFunc();
    el.change = (...args) => {
      if (args[0] === 'merge' && args[1] === true) {
        this.checkMergeWarning().then(merge => {
          if (merge) {
            this.change(...args);
          }
          else {
            this.mergeEl.setState(false, false);
          }
        })
      }
      else {
        this.change(...args);
      }
    };
    return returnCondition ? el : null;
  }

  paintformatActive() {
    return this.paintformatEl.active();
  }

  paintformatToggle() {
    this.paintformatEl.toggle();
  }

  trigger(type) {
    this[`${type}El`].click();
  }

  resetData(data) {
    this.data = data;
    this.reset();
  }
  
  checkMergeWarning() {
    return Promise.resolve().then(() => {
      const values = this.data.collectMergeValues();
      if (values.length > 1) {
        return window.confirm(t('warning.mergingMultipleValues'));
      }
      return true;
    });
  }

  reset() {
    if (this.isHide) return;
    const { data } = this;
    const style = data.getSelectedCellStyle();
    // console.log('canUndo:', data.canUndo());
    this.undoEl.setState(!data.canUndo());
    this.redoEl.setState(!data.canRedo());
    this.mergeEl.setState(data.canUnmerge(), !data.selector.multiple());
    this.autofilterEl.setState(!data.canAutofilter());
    // this.mergeEl.disabled();
    // console.log('selectedCell:', style, cell);
    const { font, format } = style;
    this.formatEl.setState(format);
    this.fontEl.setState(font.name);
    this.fontSizeEl.setState(font.size);
    this.boldEl.setState(font.bold);
    this.italicEl.setState(font.italic);
    this.underlineEl.setState(style.underline);
    this.strikeEl.setState(style.strike);
    this.textColorEl.setState(style.color);
    this.fillColorEl.setState(style.bgcolor);
    this.alignEl.setState(style.align);
    this.valignEl.setState(style.valign);
    this.textwrapEl.setState(style.textwrap);
    // console.log('freeze is Active:', data.freezeIsActive());
    this.freezeEl.setState(data.freezeIsActive());
  }
}
