/* global window */
import { h } from './element';
import {
  bind,
  mouseMoveUp,
  bindTouch,
  createEventEmitter,
} from './event';
import Resizer from './resizer';
import Scrollbar from './scrollbar';
import Selector from './selector';
import Editor from './editor';
import Print from './print';
import ContextMenu from './contextmenu';
import Table from './table';
import Toolbar from './toolbar/index';
import FormulaBar from './formulabar';
import ModalValidation from './modal_validation';
import SortFilter from './sort_filter';
import { xtoast } from './message';
import { cssPrefix } from '../config';
import { formulam, formulas } from '../core/formula';
import _cell from '../core/cell';
import { xy2expr, expr2xy } from '../core/alphabet';
import { highlightColors } from "./color_palette";

/**
 * @desc throttle fn
 * @param func function
 * @param wait Delay in milliseconds
 */
function throttle(func, wait) {
  let timeout;
  return (...arg) => {
    const that = this;
    const args = arg;
    if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null;
        func.apply(that, args);
      }, wait);
    }
  };
}

function scrollbarMove() {
  const {
    data, verticalScrollbar, horizontalScrollbar,
  } = this;
  const {
    l, t, left, top, width, height,
  } = data.getSelectedRect();
  const tableOffset = this.getTableOffset();
  // console.log(',l:', l, ', left:', left, ', tOffset.left:', tableOffset.width);
  if (Math.abs(left) + width > tableOffset.width) {
    horizontalScrollbar.move({ left: l + width - tableOffset.width });
  } else {
    const fsw = data.freezeTotalWidth();
    if (left < fsw) {
      horizontalScrollbar.move({ left: l - 1 - fsw });
    }
  }
  // console.log('top:', top, ', height:', height, ', tof.height:', tableOffset.height);
  if (Math.abs(top) + height > tableOffset.height) {
    verticalScrollbar.move({ top: t + height - tableOffset.height - 1 });
  } else {
    const fsh = data.freezeTotalHeight();
    if (top < fsh) {
      verticalScrollbar.move({ top: t - 1 - fsh });
    }
  }
}

function selectorSet(multiple, ri, ci, indexesUpdated = true, moving = false, isHeaderClick = false) {
  if (ri === -1 && ci === -1) return;
  const { table, selector, toolbar, data } = this;
  const cell = data.getCell(ri, ci);
  if (multiple) {
    selector.setEnd(ri, ci, moving, isHeaderClick);
    this.trigger('cells-selected', cell, selector.range);
    this.updateSelectionInfo();
  } else {
    // trigger click event
    selector.set(ri, ci, indexesUpdated);
    this.trigger('cell-selected', cell, ri, ci);
    const text = cell ? cell.text : '';
    this.formulaBar.reset(text);
    this.updateSelectionInfo();
  }
  this.updateContextMenuTargetRange(ri, ci);
  toolbar.reset();
  table.render();
}

function ensureSelectorInSheet() {
  const { data, selector } = this;
  const { sci, eci, sri, eri } = selector.range;
  const nCols = data.cols.len;
  const nRows = data.rows.len;
  
  const sci2 = Math.min(sci, nCols - 1);
  const eci2 = Math.min(eci, nCols - 1);
  const sri2 = Math.min(sri, nRows - 1);
  const eri2 = Math.min(eri, nRows - 1);
  
  if (sci2 !== sci || eci2 !== eci || sri2 !== sri || eri2 !== eri) {
    this.selectorSet(false, sri2, sci2);
    this.selectorSet(true, eri2, eci2);
  }
}

// multiple: boolean
// direction: left | right | up | down | row-first | row-last | col-first | col-last
function selectorMove(multiple, direction) {
  const {
    selector, data,
  } = this;
  const { rows, cols } = data;
  let [ri, ci] = selector.indexes;
  const { eri, eci } = selector.range;
  if (multiple) {
    [ri, ci] = selector.moveIndexes;
  }
  // console.log('selector.move:', ri, ci);
  if (direction === 'left') {
    if (ci > 0) ci -= 1;
  } else if (direction === 'right') {
    if (eci !== ci) ci = eci;
    if (ci < cols.len - 1) ci += 1;
  } else if (direction === 'up') {
    if (ri > 0) ri -= 1;
  } else if (direction === 'down') {
    if (eri !== ri) ri = eri;
    if (ri < rows.len - 1) ri += 1;
  } else if (direction === 'row-first') {
    ci = 0;
  } else if (direction === 'row-last') {
    ci = cols.len - 1;
  } else if (direction === 'col-first') {
    ri = 0;
  } else if (direction === 'col-last') {
    ri = rows.len - 1;
  }
  if (multiple) {
    selector.moveIndexes = [ri, ci];
  }
  selectorSet.call(this, multiple, ri, ci);
  scrollbarMove.call(this);
}

// private methods
function overlayerMousemove(evt) {
  // console.log('x:', evt.offsetX, ', y:', evt.offsetY);
  if (evt.buttons !== 0) return;
  if (evt.target.className === `${cssPrefix}-resizer-hover`) return;
  const { offsetX, offsetY } = evt;
  const {
    rowResizer, colResizer, tableEl, data,
  } = this;
  const { rows, cols } = data;
  if (offsetX > cols.indexWidth && offsetY > rows.height) {
    rowResizer.hide();
    colResizer.hide();
    return;
  }
  const tRect = tableEl.box();
  const cRect = data.getCellRectByXY(evt.offsetX, evt.offsetY);
  if (cRect.ri >= 0 && cRect.ci === -1) {
    cRect.width = cols.indexWidth;
    rowResizer.show(cRect, {
      width: tRect.width,
    });
    if (rows.isHide(cRect.ri - 1)) {
      rowResizer.showUnhide(cRect.ri);
    } else {
      rowResizer.hideUnhide();
    }
  } else {
    rowResizer.hide();
  }
  if (cRect.ri === -1 && cRect.ci >= 0) {
    cRect.height = rows.height;
    colResizer.show(cRect, {
      height: tRect.height,
    });
    if (cols.isHide(cRect.ci - 1)) {
      colResizer.showUnhide(cRect.ci);
    } else {
      colResizer.hideUnhide();
    }
  } else {
    colResizer.hide();
  }
}

// let scrollThreshold = 15;
function overlayerMousescroll(evt) {
  // scrollThreshold -= 1;
  // if (scrollThreshold > 0) return;
  // scrollThreshold = 15;

  const { verticalScrollbar, horizontalScrollbar, data } = this;
  const { top } = verticalScrollbar.scroll();
  const { left } = horizontalScrollbar.scroll();
  // console.log('evt:::', evt.wheelDelta, evt.detail * 40);

  const { rows, cols } = data;

  // deltaY for vertical delta
  const { deltaY, deltaX } = evt;
  const loopValue = (ii, vFunc) => {
    let i = ii;
    let v = 0;
    do {
      v = vFunc(i);
      i += 1;
    } while (v <= 0);
    return v;
  };
  // console.log('deltaX', deltaX, 'evt.detail', evt.detail);
  // if (evt.detail) deltaY = evt.detail * 40;
  const moveY = (vertical) => {
    if (vertical > 0) {
      // up
      const ri = data.scroll.ri + 1;
      if (ri < rows.len) {
        const rh = loopValue(ri, i => rows.getHeight(i));
        verticalScrollbar.move({ top: top + rh - 1 });
      }
    } else {
      // down
      const ri = data.scroll.ri - 1;
      if (ri >= 0) {
        const rh = loopValue(ri, i => rows.getHeight(i));
        verticalScrollbar.move({ top: ri === 0 ? 0 : top - rh });
      }
    }
  };

  // deltaX for Mac horizontal scroll
  const moveX = (horizontal) => {
    if (horizontal > 0) {
      // left
      const ci = data.scroll.ci + 1;
      if (ci < cols.len) {
        const cw = loopValue(ci, i => cols.getWidth(i));
        horizontalScrollbar.move({ left: left + cw - 1 });
      }
    } else {
      // right
      const ci = data.scroll.ci - 1;
      if (ci >= 0) {
        const cw = loopValue(ci, i => cols.getWidth(i));
        horizontalScrollbar.move({ left: ci === 0 ? 0 : left - cw });
      }
    }
  };
  const tempY = Math.abs(deltaY);
  const tempX = Math.abs(deltaX);
  const temp = Math.max(tempY, tempX);
  // console.log('event:', evt);
  // detail for windows/mac firefox vertical scroll
  if (/Firefox/i.test(window.navigator.userAgent)) throttle(moveY(evt.detail), 50);
  if (temp === tempX) throttle(moveX(deltaX), 50);
  if (temp === tempY) throttle(moveY(deltaY), 50);
}

function overlayerTouch(direction, distance) {
  const { verticalScrollbar, horizontalScrollbar } = this;
  const { top } = verticalScrollbar.scroll();
  const { left } = horizontalScrollbar.scroll();

  if (direction === 'left' || direction === 'right') {
    horizontalScrollbar.move({ left: left - distance });
  } else if (direction === 'up' || direction === 'down') {
    verticalScrollbar.move({ top: top - distance });
  }
}

function verticalScrollbarSet() {
  const { data, verticalScrollbar } = this;
  const { height } = this.getTableOffset();
  const erth = data.exceptRowTotalHeight(0, -1);
  // console.log('erth:', erth);
  verticalScrollbar.set(height, data.rows.totalHeight() - erth);
}

function horizontalScrollbarSet() {
  const { data, horizontalScrollbar } = this;
  const { width } = this.getTableOffset();
  if (data) {
    horizontalScrollbar.set(width, data.cols.totalWidth());
  }
}

function sheetFreeze() {
  const {
    selector, data, editor,
  } = this;
  const [ri, ci] = data.freeze;
  if (ri > 0 || ci > 0) {
    const fwidth = data.freezeTotalWidth();
    const fheight = data.freezeTotalHeight();
    editor.setFreezeLengths(fwidth, fheight);
  }
  selector.resetAreaOffset();
}

function sheetReset() {
  const {
    data,
    tableEl,
    overlayerEl,
    overlayerCEl,
    table,
    toolbar,
    selector,
    el,
  } = this;
  const tOffset = this.getTableOffset();
  const vRect = this.getRect();
  tableEl.attr(vRect);
  overlayerEl.offset(vRect);
  overlayerCEl.offset(tOffset);
  el.css('width', `${vRect.width}px`);
  verticalScrollbarSet.call(this);
  horizontalScrollbarSet.call(this);
  sheetFreeze.call(this);
  table.render();
  toolbar.reset();
  selector.reset();
  const cell = data.getSelectedCell();
  this.formulaBar.reset(cell && cell.text ? cell.text : '');
  this.updateSelectionInfo();
}

function clearClipboard() {
  const { data, selector } = this;
  data.clearClipboard();
  selector.hideClipboard();
}

function copy(evt) {
  const { data, selector } = this;
  if (data.settings.mode === 'read') {
    data.copyToSystemClipboard(evt);
    return;
  }
  data.copy();
  data.copyToSystemClipboard(evt);
  selector.showClipboard();
}

function cut(evt) {
  const { data, selector } = this;
  if (data.settings.mode === 'read') {
    data.copyToSystemClipboard(evt);
    return;
  }
  data.cut();
  data.copyToSystemClipboard(evt);
  selector.showClipboard();
}

function paste(what, evt) {
  const { data } = this;
  if (data.settings.mode === 'read') return;
  if (data.paste(what, msg => xtoast('Tip', msg))) {
    sheetReset.call(this);
  } else if (evt) {
    let cdata;
    if (data.settings.clipboard && data.settings.clipboard.getText) {
      cdata = data.settings.clipboard.getText();
    }
    else {
      cdata = evt.clipboardData.getData('text/plain');
    }
    const execPaste = () => {
      this.data.pasteFromText(cdata);
      sheetReset.call(this);
      this.formulaBar.reset(cdata);
      this.updateSelectionInfo();
    };
    if (cdata instanceof Promise) {
      cdata.then(cdataNew => {
        cdata = cdataNew;
        execPaste();
      });
    }
    else {
      execPaste();
    }
  }
}

function hideRowsOrCols() {
  this.data.hideRowsOrCols();
  sheetReset.call(this);
}

function unhideRowsOrCols(type, index) {
  this.data.unhideRowsOrCols(type, index);
  sheetReset.call(this);
}

function autofilter() {
  const { data } = this;
  data.autofilter();
  sheetReset.call(this);
}

function toolbarChangePaintformatPaste() {
  const { toolbar } = this;
  if (toolbar.paintformatActive()) {
    paste.call(this, 'format');
    clearClipboard.call(this);
    toolbar.paintformatToggle();
  }
}

function overlayerMousedown(evt) {
  // console.log(':::::overlayer.mousedown:', evt.detail, evt.button, evt.buttons, evt.shiftKey);
  // console.log('evt.target.className:', evt.target.className);
  const {
    selector, data, table, sortFilter,
  } = this;
  let { offsetX, offsetY } = evt;
  const trigger = evt.target.closest('.spreadsheet-trigger');
  if (trigger) {
    if (evt.ctrlKey || evt.metaKey) {
      return;
    }
    const rect = this.overlayerEl.el.getBoundingClientRect();
    offsetX = evt.clientX - rect.x;
    offsetY = evt.clientY - rect.y;
  }
  const isAutofillEl = evt.target.className === `${cssPrefix}-selector-corner`;
  const cellRect = data.getCellRectByXY(offsetX, offsetY);
  const {
    left, top, width, height,
  } = cellRect;
  let { ri, ci } = cellRect;
  // sort or filter
  const { autoFilter } = data;
  if (autoFilter.includes(ri, ci)) {
    if (left + width - 20 < offsetX && top + height - 20 < offsetY) {
      const items = autoFilter.items(ci, (r, c) => data.rows.getCell(r, c));
      sortFilter.hide();
      sortFilter.set(ci, items, autoFilter.getFilter(ci), autoFilter.getSort(ci));
      sortFilter.setOffset({ left, top: top + height + 2 });
      return;
    }
  }

  // console.log('ri:', ri, ', ci:', ci);
  const isColumnHeaderClick = ri < 0;
  const isRowHeaderClick = ci < 0;
  const isHeaderClick = isColumnHeaderClick || isRowHeaderClick;
  const { sci, eci, sri, eri } = this.selector.range;
  const isSelectedColumnHeaderClick = isColumnHeaderClick && ci >= sci && ci <= eci && sri === 0 && eri === data.rows.len - 1;
  const isSelectedRowHeaderClick = isRowHeaderClick && ri >= sri && ri <= eri && sci === 0 && eci === data.cols.len - 1;
  const isSelectedHeaderRightClick = (isSelectedColumnHeaderClick || isSelectedRowHeaderClick) && evt.buttons === 2;
  if (!evt.shiftKey && !isSelectedHeaderRightClick) {
    // console.log('selectorSetStart:::');
    if (isAutofillEl) {
      selector.showAutofill(ri, ci);
    } else {
      selectorSet.call(this, false, ri, ci);
    }

    // mouse move up
    mouseMoveUp(window, (e) => {
      // console.log('mouseMoveUp::::');
      const trigger = e.target.closest('.spreadsheet-trigger');
      let { offsetX, offsetY } = e;
      if (trigger) {
        if (e.ctrlKey || e.metaKey) {
          return;
        }
        const rect = this.overlayerEl.el.getBoundingClientRect();
        offsetX = e.clientX - rect.x;
        offsetY = e.clientY - rect.y;
      }
      ({ ri, ci } = data.getCellRectByXY(offsetX, offsetY));
      if (isAutofillEl) {
        selector.showAutofill(ri, ci);
      } else if (e.buttons === 1 && !e.shiftKey) {
        selectorSet.call(this, true, ri, ci, true, true);
      }
    }, () => {
      if (isAutofillEl && selector.arange && data.settings.mode !== 'read') {
        if (data.autofill(selector.arange, 'all', msg => xtoast('Tip', msg))) {
          table.render();
        }
      }
      selector.hideAutofill();
      toolbarChangePaintformatPaste.call(this);
    });
  }

  if (!isAutofillEl && evt.buttons === 1) {
    if (evt.shiftKey) {
      // console.log('shiftKey::::');
      selectorSet.call(this, true, ri, ci, true, false, isHeaderClick);
    }
  }
}

function editorSetOffset() {
  const { editor, data } = this;
  const sOffset = data.getSelectedRect();
  const tOffset = this.getTableOffset();
  let sPosition = 'top';
  // console.log('sOffset:', sOffset, ':', tOffset);
  if (sOffset.top > tOffset.height / 2) {
    sPosition = 'bottom';
  }
  editor.setOffset(sOffset, sPosition);
  this.clickableElementsInner.offset({
    left: -this.data.scroll.x,
    top: -this.data.scroll.y,
  });
}

function editorSet(initialText, viaF2) {
  const { editor, data } = this;
  if (data.settings.mode === 'read') return;
  editorSetOffset.call(this);
  editor.setCell(data.getSelectedCell(), data.getSelectedValidator(), initialText, viaF2);
  clearClipboard.call(this);
  this.updateHighlightedFormulaReferences();
}

function verticalScrollbarMove(distance) {
  const { data, table, selector } = this;
  data.scrolly(distance, () => {
    selector.resetBRLAreaOffset();
    editorSetOffset.call(this);
    table.render();
  });
}

function horizontalScrollbarMove(distance) {
  const { data, table, selector } = this;
  data.scrollx(distance, () => {
    selector.resetBRTAreaOffset();
    editorSetOffset.call(this);
    table.render();
  });
}

function rowResizerFinished(cRect, distance) {
  const { ri } = cRect;
  const { table, selector, data } = this;
  const { range } = selector;
  if (range.eri === ri) {
    for (let _ri = range.sri; _ri <= range.eri; ++_ri) {
      data.setRowHeight(_ri, distance);
    }
  }
  else {
    data.setRowHeight(ri, distance);
  }
  table.render();
  selector.resetAreaOffset();
  verticalScrollbarSet.call(this);
  editorSetOffset.call(this);
}

function colResizerFinished(cRect, distance) {
  const { ci } = cRect;
  const { table, selector, data } = this;
  const { range } = selector;
  if (range.eci === ci) {
    for (let _ci = range.sci; _ci <= range.eci; ++_ci) {
      data.setColWidth(_ci, distance);
    }
  }
  else {
      data.setColWidth(ci, distance);
  }
  // console.log('data:', data);
  table.render();
  selector.resetAreaOffset();
  horizontalScrollbarSet.call(this);
  editorSetOffset.call(this);
}

function dataSetCellText(text, state = 'finished') {
  const { data, table } = this;
  // const [ri, ci] = selector.indexes;
  if (data.settings.mode === 'read') return;
  data.setSelectedCellText(text, state);
  const { ri, ci } = data.selector;
  if (state === 'finished') {
    table.render();
  } else {
    this.trigger('cell-edited', text, ri, ci);
  }
}

function insertDeleteRowColumn(type) {
  const { data, selector } = this;
  const nSelectedRows = selector.range.eri - selector.range.sri + 1;
  const nSelectedCols = selector.range.eci - selector.range.sci + 1;
  let needsEnsuringSelectorInSheet = false;
  if (data.settings.mode === 'read') return;
  if (type === 'insert-row-before' || type === 'insert-rows-before') {
    data.insert('row', 'before', nSelectedRows);
  } else if (type === 'insert-row-after' || type === 'insert-rows-after') {
    data.insert('row', 'after', nSelectedRows);
  } else if (type === 'delete-row' || type === 'delete-rows') {
    data.delete('row');
    needsEnsuringSelectorInSheet = true;
  } else if (type === 'insert-column-before' || type === 'insert-columns-before') {
    data.insert('column', 'before', nSelectedCols);
  } else if (type === 'insert-column-after' || type === 'insert-columns-after') {
    data.insert('column', 'after', nSelectedCols);
  } else if (type === 'delete-column' || type === 'delete-columns') {
    data.delete('column');
    needsEnsuringSelectorInSheet = true;
  } else if (type === 'reset-row-height') {
    for (let ri = selector.range.sri; ri <= selector.range.eri; ++ri) {
      data.rows.setHeight(ri, 25);
    }
  } else if (type === 'reset-column-width') {
    for (let ci = selector.range.sci; ci <= selector.range.eci; ++ci) {
      data.cols.setWidth(ci, 100);
    }
  } else if (type === 'delete-cell') {
    data.deleteCell();
  } else if (type === 'delete-cell-format') {
    data.deleteCell('format');
  } else if (type === 'delete-cell-text') {
    data.deleteCell('text');
  } else if (type === 'cell-printable') {
    data.setSelectedCellAttr('printable', true);
  } else if (type === 'cell-non-printable') {
    data.setSelectedCellAttr('printable', false);
  } else if (type === 'cell-editable') {
    data.setSelectedCellAttr('editable', true);
  } else if (type === 'cell-non-editable') {
    data.setSelectedCellAttr('editable', false);
  }
  if (needsEnsuringSelectorInSheet) {
    ensureSelectorInSheet.call(this);
  }
  clearClipboard.call(this);
  sheetReset.call(this);
}

function toolbarChange(type, value) {
  const { data } = this;
  if (type === 'undo') {
    this.undo();
  } else if (type === 'redo') {
    this.redo();
  } else if (type === 'print') {
    this.print.preview();
  } else if (type === 'paintformat') {
    if (value === true) copy.call(this);
    else clearClipboard.call(this);
  } else if (type === 'clearformat') {
    insertDeleteRowColumn.call(this, 'delete-cell-format');
  } else if (type === 'link') {
    // link
  } else if (type === 'chart') {
    // chart
  } else if (type === 'autofilter') {
    // filter
    autofilter.call(this);
  } else if (type === 'freeze') {
    if (value) {
      const { ri, ci } = data.selector;
      this.freeze(ri, ci);
    } else {
      this.freeze(0, 0);
    }
  } else {
    data.setSelectedCellAttr(type, value);
    if (type === 'formula' && !data.selector.multiple()) {
      editorSet.call(this);
    }
    sheetReset.call(this);
  }
}

function sortFilterChange(ci, order, operator, value) {
  // console.log('sort:', sortDesc, operator, value);
  this.data.setAutoFilter(ci, order, operator, value);
  sheetReset.call(this);
}

function sheetInitEvents() {
  const {
    selector,
    overlayerEl,
    rowResizer,
    colResizer,
    verticalScrollbar,
    horizontalScrollbar,
    editor,
    contextMenu,
    toolbar,
    modalValidation,
    sortFilter,
  } = this;
  // overlayer
  overlayerEl
    .on('mousemove', (evt) => {
      overlayerMousemove.call(this, evt);
    })
    .on('mousedown', (evt) => {
      let formulaCellRow;
      let formulaCellCol;
      let editorCursorPos;
      if (editor.isEnteringFormula()) {
        this.isSelectingCellsForFormula = true;
        formulaCellRow = this.selector.range.sri;
        formulaCellCol = this.selector.range.sci;
        editorCursorPos = this.editor.getCursorPosition();
      }
      else {
        editor.clear();
      }
      contextMenu.hide();
      // the left mouse button: mousedown → mouseup → click
      // the right mouse button: mousedown → contenxtmenu → mouseup
      if (evt.buttons === 2) {
        let { offsetX, offsetY } = evt;
        const trigger = evt.target.closest('.spreadsheet-trigger');
        if (trigger) {
          if (evt.ctrlKey || evt.metaKey) {
            return;
          }
          const rect = this.overlayerEl.el.getBoundingClientRect();
          offsetX = evt.clientX - rect.x;
          offsetY = evt.clientY - rect.y;
        }
        const cellRect = this.data.getCellRectByXY(offsetX, offsetY);
        const { ri, ci } = cellRect;
        this.updateContextMenuTargetRange(ri, ci);
        if (this.data.xyInSelectedRect(evt.offsetX, evt.offsetY)) {
          contextMenu.setPosition(evt.offsetX, evt.offsetY);
        } else {
          overlayerMousedown.call(this, evt);
          contextMenu.setPosition(evt.offsetX, evt.offsetY);
        }
        evt.stopPropagation();
      } else if (evt.detail === 2) {
        editorSet.call(this);
      } else {
        overlayerMousedown.call(this, evt);
      }
      
      if (this.isSelectingCellsForFormula) {
        const overlayerMouseup = () => {
          document.removeEventListener('mouseup', overlayerMouseup);
          this.isSelectingCellsForFormula = false;
          const col0 = this.selector.range.sci;
          const col1 = this.selector.range.eci;
          const row0 = this.selector.range.sri;
          const row1 = this.selector.range.eri;
          const isConstXY = evt.ctrlKey || evt.metaKey;
          const rangeStart = xy2expr(col0, row0, isConstXY, isConstXY);
          const rangeEnd = xy2expr(col1, row1, isConstXY, isConstXY);
          const isSingleCell = rangeStart === rangeEnd;
          const rangeText = isSingleCell ? rangeStart : `${rangeStart}:${rangeEnd}`;
          this.editor.injectText(rangeText, editorCursorPos[0], editorCursorPos[1]);
          this.spreadsheet.setSelectedRange({ row0: formulaCellRow, row1: formulaCellRow, col0: formulaCellCol, col1: formulaCellCol });
          this.editor.textEl.focus();
          this.editor.setCursorPosition(editorCursorPos[0] + rangeText.length);
          setTimeout(() => {
            this.editor.setCursorPosition(editorCursorPos[0] + rangeText.length);
          }, 0);
          this.formulaBar.setText(editor.inputText);
          this.updateHighlightedFormulaReferences();
        };
        document.addEventListener('mouseup', overlayerMouseup);
      }
    })
    .on('mousewheel.stop', (evt) => {
      overlayerMousescroll.call(this, evt);
    })
    .on('mouseout', (evt) => {
      const { offsetX, offsetY } = evt;
      if (offsetY <= 0) colResizer.hide();
      if (offsetX <= 0) rowResizer.hide();
    });

  selector.inputChange = (v) => {
    dataSetCellText.call(this, v, 'input');
    editorSet.call(this);
  };

  // slide on mobile
  bindTouch(overlayerEl.el, {
    move: (direction, d) => {
      overlayerTouch.call(this, direction, d);
    },
  });

  // toolbar change
  toolbar.change = (type, value) => toolbarChange.call(this, type, value);

  // sort filter ok
  sortFilter.ok = (ci, order, o, v) => sortFilterChange.call(this, ci, order, o, v);

  // resizer finished callback
  rowResizer.finishedFn = (cRect, distance) => {
    rowResizerFinished.call(this, cRect, distance);
  };
  colResizer.finishedFn = (cRect, distance) => {
    colResizerFinished.call(this, cRect, distance);
  };
  // resizer unhide callback
  rowResizer.unhideFn = (index) => {
    unhideRowsOrCols.call(this, 'row', index);
  };
  colResizer.unhideFn = (index) => {
    unhideRowsOrCols.call(this, 'col', index);
  };
  // scrollbar move callback
  verticalScrollbar.moveFn = (distance, evt) => {
    verticalScrollbarMove.call(this, distance, evt);
  };
  horizontalScrollbar.moveFn = (distance, evt) => {
    horizontalScrollbarMove.call(this, distance, evt);
  };
  // editor
  editor.change = (state, itext) => {
    if (state === 'finished') {
      this.formulaBar.reset(itext);
      this.updateSelectionInfo();
    }
    else {
      this.formulaBar.setText(itext);
      this.updateSelectionInfo();
    }
    dataSetCellText.call(this, itext, state);
    this.updateHighlightedFormulaReferences();
  };
  // modal validation
  modalValidation.change = (action, ...args) => {
    if (action === 'save') {
      this.data.addValidation(...args);
    } else {
      this.data.removeValidation();
    }
  };
  // contextmenu
  contextMenu.itemClick = (type) => {
    // console.log('type:', type);
    if (type === 'validation') {
      modalValidation.setValue(this.data.getSelectedValidation());
    } else if (type === 'copy') {
      copy.call(this);
    } else if (type === 'cut') {
      cut.call(this);
    } else if (type === 'paste') {
      paste.call(this, 'all');
    } else if (type === 'paste-value') {
      paste.call(this, 'text');
    } else if (type === 'paste-format') {
      paste.call(this, 'format');
    } else if (type === 'hide') {
      hideRowsOrCols.call(this);
    } else {
      insertDeleteRowColumn.call(this, type);
    }
  };

  bind(window, 'resize', () => {
    this.reload();
  });

  bind(window, 'click', (evt) => {
    this.focusing = this.spreadsheetEl.contains(evt.target);
  });

  bind(window, 'paste', (evt) => {
    if (!this.focusing) return;
    paste.call(this, 'all', evt);
    evt.preventDefault();
  });

  bind(window, 'copy', (evt) => {
    if (!this.focusing) return;
    if (document.activeElement === this.formulaBar.inputEl.el) {
      return;
    }
    copy.call(this, evt);
    evt.preventDefault();
  });
  
  bind(window, 'cut', (evt) => {
    if (!this.focusing) return;
    if (document.activeElement === this.formulaBar.inputEl.el) {
      return;
    }
    cut.call(this, evt);
    evt.preventDefault();
  });

  // for selector
  bind(window, 'keydown', (evt) => {
    if (!this.focusing) return;
    const keyCode = evt.keyCode || evt.which;
    const {
      key, altKey, ctrlKey, shiftKey, metaKey,
    } = evt;
    // console.log('keydown.evt: ', keyCode);
    if (ctrlKey || metaKey) {
      // const { sIndexes, eIndexes } = selector;
      // let what = 'all';
      // if (shiftKey) what = 'text';
      // if (altKey) what = 'format';
      switch (keyCode) {
        case 90:
          // undo: ctrl + z
          this.undo();
          evt.preventDefault();
          break;
        case 89:
          // redo: ctrl + y
          this.redo();
          evt.preventDefault();
          break;
        case 67:
          // ctrl + c
          // => copy
          // copy.call(this);
          // evt.preventDefault();
          break;
        case 88:
          // ctrl + x
          // cut.call(this);
          // evt.preventDefault();
          break;
        case 85:
          // ctrl + u
          toolbar.trigger('underline');
          evt.preventDefault();
          break;
        case 86:
          // ctrl + v
          // => paste
          // evt.preventDefault();
          break;
        case 37:
          // ctrl + left
          selectorMove.call(this, shiftKey, 'row-first');
          evt.preventDefault();
          break;
        case 38:
          // ctrl + up
          selectorMove.call(this, shiftKey, 'col-first');
          evt.preventDefault();
          break;
        case 39:
          // ctrl + right
          selectorMove.call(this, shiftKey, 'row-last');
          evt.preventDefault();
          break;
        case 40:
          // ctrl + down
          selectorMove.call(this, shiftKey, 'col-last');
          evt.preventDefault();
          break;
        case 32:
          // ctrl + space, all cells in col
          selectorSet.call(this, false, -1, this.data.selector.ci, false);
          evt.preventDefault();
          break;
        case 66:
          // ctrl + B
          toolbar.trigger('bold');
          break;
        case 73:
          // ctrl + I
          toolbar.trigger('italic');
          break;
        default:
          break;
      }
    } else {
      // console.log('evt.keyCode:', evt.keyCode);
      switch (keyCode) {
        case 32:
          if (shiftKey) {
            // shift + space, all cells in row
            selectorSet.call(this, false, this.data.selector.ri, -1, false);
          }
          break;
        case 27: // esc
          contextMenu.hide();
          clearClipboard.call(this);
          break;
        case 37: // left
          selectorMove.call(this, shiftKey, 'left');
          evt.preventDefault();
          break;
        case 38: // up
          selectorMove.call(this, shiftKey, 'up');
          evt.preventDefault();
          break;
        case 39: // right
          selectorMove.call(this, shiftKey, 'right');
          evt.preventDefault();
          break;
        case 40: // down
          selectorMove.call(this, shiftKey, 'down');
          evt.preventDefault();
          break;
        case 9: // tab
          editor.clear();
          // shift + tab => move left
          // tab => move right
          selectorMove.call(this, false, shiftKey ? 'left' : 'right');
          evt.preventDefault();
          break;
        case 13: // enter
          editor.clear();
          // shift + enter => move up
          // enter => move down
          selectorMove.call(this, false, altKey ? 'up' : 'down');
          evt.preventDefault();
          break;
        case 8: // backspace
          insertDeleteRowColumn.call(this, 'delete-cell-text');
          evt.preventDefault();
          break;
        default:
          break;
      }

      if (key === 'Delete') {
        insertDeleteRowColumn.call(this, 'delete-cell-text');
        evt.preventDefault();
      } else if ((keyCode >= 65 && keyCode <= 90)
        || (keyCode >= 48 && keyCode <= 57)
        || (keyCode >= 96 && keyCode <= 105)
        || (keyCode >= 186 && keyCode <= 192)
        || (keyCode >= 219 && keyCode <= 222)
        || evt.key === '='
      ) {
        const selectedCell = this.data.getSelectedCell();
        const initialText = selectedCell ? selectedCell.text : '';
        dataSetCellText.call(this, evt.key, 'input');
        editorSet.call(this, initialText);
        this.formulaBar.setText(editor.inputText);
      } else if (keyCode === 113) {
        // F2
        editorSet.call(this, null, true);
      }
    }
  });
}

export default class Sheet {
  constructor(targetEl, data, spreadsheet) {
    this.spreadsheetEl = targetEl;
    this.spreadsheet = spreadsheet;
    this.eventMap = createEventEmitter();
    const { view, showToolbar, showContextmenu, showContextMenuForCells, formulaBar, contextMenu } = data.settings;
    this.el = h('div', `${cssPrefix}-sheet`);
    this.toolbar = new Toolbar(data, view.width, !showToolbar);
    this.formulaBar = new FormulaBar(data.settings.mode !== 'read', formulaBar, value => {
      dataSetCellText.call(this, value, 'finished');
      if (this.editor.cell) {
        this.editor.setText(value, true);
        this.updateHighlightedFormulaReferences();
      }
    });
    this.print = new Print(data, spreadsheet);
    targetEl.children(this.toolbar.el, this.formulaBar.el, this.el, this.print.el);
    this.data = data;
    // table
    this.tableEl = h('canvas', `${cssPrefix}-table`);
    // resizer
    this.rowResizer = new Resizer(false, data.rows.height);
    this.colResizer = new Resizer(true, data.cols.minWidth);
    // scrollbar
    this.verticalScrollbar = new Scrollbar(true);
    this.horizontalScrollbar = new Scrollbar(false);
    // editor
    this.editor = new Editor(
      formulas,
      () => this.getTableOffset(),
      data.rows.height,
      (direction, shiftKey, horizontal) => {
        if (direction < 0) {
          selectorMove.call(this, shiftKey, horizontal ? 'left' : 'up');
        }
        else if (direction > 0) {
          selectorMove.call(this, shiftKey, horizontal ? 'right' : 'down');
        }
      },
      data.settings.suggestFormulas,
      this.spreadsheet.getChoosers(),
      this.spreadsheet,
    );
    // data validation
    this.modalValidation = new ModalValidation();
    // contextMenu
    this.contextMenu = new ContextMenu(() => this.getRect(), !showContextmenu, !showContextMenuForCells, contextMenu);
    // selector
    this.selector = new Selector(data);
    this.clickableElementsInner = h('div', `${cssPrefix}-overlayer-clickable-elements-inner`);
    this.clickableElementsContainer = h('div', `${cssPrefix}-overlayer-clickable-elements-container`)
      .child(this.clickableElementsInner);
    this.overlayerCEl = h('div', `${cssPrefix}-overlayer-content`)
      .children(
        this.editor.el,
        this.selector.el,
        this.clickableElementsContainer,
      );
    this.overlayerEl = h('div', `${cssPrefix}-overlayer`)
      .child(this.overlayerCEl);
    // sortFilter
    this.sortFilter = new SortFilter();
    // root element
    this.el.children(
      this.tableEl,
      this.overlayerEl.el,
      this.rowResizer.el,
      this.colResizer.el,
      this.verticalScrollbar.el,
      this.horizontalScrollbar.el,
      this.contextMenu.el,
      this.modalValidation.el,
      this.sortFilter.el,
    );
    // table
    this.table = new Table(this.tableEl.el, data, this.spreadsheet, this.clickableElementsInner);
    sheetInitEvents.call(this);
    sheetReset.call(this);
    // init selector [0, 0]
    selectorSet.call(this, false, 0, 0);
    this.selectorSet = selectorSet;
    this.clearClipboard = clearClipboard;
    this.isSelectingCellsForFormula = false;
  }

  on(eventName, func) {
    this.eventMap.on(eventName, func);
    return this;
  }

  trigger(eventName, ...args) {
    const { eventMap } = this;
    eventMap.fire(eventName, args);
  }

  resetData(data) {
    // before
    this.editor.clear();
    // after
    this.data = data;
    verticalScrollbarSet.call(this);
    horizontalScrollbarSet.call(this);
    this.toolbar.resetData(data);
    this.print.resetData(data);
    this.selector.resetData(data);
    this.table.resetData(data);
  }

  loadData(data) {
    this.data.setData(data);
    sheetReset.call(this);
    return this;
  }

  // freeze rows or cols
  freeze(ri, ci) {
    const { data } = this;
    data.setFreeze(ri, ci);
    sheetReset.call(this);
    return this;
  }

  undo() {
    this.data.undo(() => {
      this.trigger('undo-performed');
    });
    sheetReset.call(this);
  }

  redo() {
    this.data.redo(() => {
      this.trigger('redo-performed');
    });
    sheetReset.call(this);
  }

  reload() {
    sheetReset.call(this);
    return this;
  }

  getRect() {
    const { data } = this;
    return { width: data.viewWidth(), height: data.viewHeight() };
  }

  getTableOffset() {
    const { rows, cols } = this.data;
    const { width, height } = this.getRect();
    return {
      width: width - cols.indexWidth,
      height: height - rows.height,
      left: cols.indexWidth,
      top: rows.height,
    };
  }
  
  setSelectedCellCustomFormatter(formatter) {
    this.data.setSelectedCellCustomFormatter(formatter);
    sheetReset.call(this);
  }
  
  clearSelectedCellCustomFormatter() {
    this.data.clearSelectedCellCustomFormatter();
    sheetReset.call(this);
  }
  
  updateSelectionInfo() {
    const { data } = this;
    const { rows, selector } = data;
    const numericValues = [];
    if (selector.range.sri !== selector.range.eri || selector.range.sci !== selector.range.eci) {
      for (let ri = selector.range.sri; ri <= selector.range.eri; ++ri) {
        for (let ci = selector.range.sci; ci <= selector.range.eci; ++ci) {
          const cell = rows.getCell(ri, ci);
          if (cell && cell.text && cell.text.length > 0) {
            let text = cell.text;
            if (text.startsWith('=')) {
              text = _cell.render(this.spreadsheet, cell.text || '', formulam, (y, x) => (data.getCellTextOrDefault(x, y)));
            }
            if (!isNaN(text)) {
              numericValues.push(parseFloat(text));
            }
          }
        }
      }
    }
    if (numericValues.length === 0) {
      this.formulaBar.setSelectionInfoText('');
    }
    else {
      const sum = numericValues.reduce((prev, curr) => prev + curr);
      const avg = sum / numericValues.length;
      
      const formatNumber = num => {
        const nDigits = 3;
        const p = Math.pow(10, nDigits);
        let str = (Math.round(p * num) / p).toFixed(nDigits);
        while (str[str.length - 1] === '.' || str[str.length - 1] == '0') {
          const c = str[str.length - 1];
          str = str.substr(0, str.length - 1);
          if (c === '.') {
            break;
          }
        }
        return str;
      };
      
      const sumStr = formatNumber(sum);
      const avgStr = formatNumber(avg);
      
      this.formulaBar.setSelectionInfoText(`Sum: ${sumStr}; Avg: ${avgStr}`);
    }
  }
  
  updateHighlightedFormulaReferences() {
    const { editor, formulaBar } = this;
    let highlight = !!editor.isOn && editor.inputText && editor.inputText[0] === '=';
    if (highlight) {
      const matches = [...editor.inputText.matchAll(/\$?([a-zA-Z]{1,3}\$?\d+:\$?[a-zA-Z]{1,3}\$?\d+|\$?[a-zA-Z]{1,3}\$?\d+)/g)];
      let nextColorIndex = 0;
      const cells = [];
      let formulaHtml = editor.inputText;
      let deltaPos = 0;
      matches.forEach(match => {
        const str = match[0];
        const color = highlightColors[nextColorIndex];
        nextColorIndex = (nextColorIndex + 1) % highlightColors.length;
        if (str.includes(':')) {
          const [start, end] = str.split(':').map(expr => expr2xy(expr));
          for (let x = start[0]; x <= end[0]; ++x) {
            for (let y = start[1]; y <= end[1]; ++y) {
              cells.push([x, y, color]);
            }
          }
        }
        else {
          cells.push([...expr2xy(str), color]);
        }
        
        const prefix = formulaHtml.substring(0, match.index + deltaPos);
        const suffix = formulaHtml.substring(match.index + str.length + deltaPos);
        const prevLength = formulaHtml.length;
        formulaHtml = `${prefix}<span style="color:${color};">${str}</span>${suffix}`;
        const newLength = formulaHtml.length;
        deltaPos += newLength - prevLength;
      });
      this.spreadsheet.highlightFormulaCells = cells;
      editor.setFormulaHtml(formulaHtml);
      formulaBar.setFormulaHtml(formulaHtml);
    }
    else {
      this.spreadsheet.highlightFormulaCells = undefined;
      editor.setFormulaHtml("");
      formulaBar.setFormulaHtml("");
    }
    this.table.render();
  }

  updateContextMenuTargetRange(ri, ci) {
    const { contextMenu, selector } = this;
    const rng = selector.range;
    contextMenu.setTargetRange({
      sci: ci === -1 ? -1 : rng.sci,
      eci: ci === -1 ? -1 : rng.eci,
      sri: ri === -1 ? -1 : rng.sri,
      eri: ri === -1 ? -1 : rng.eri,
    });
  }
  
  resizeRowAfterClearingEditor(ri, height) {
    const fn = () => { rowResizerFinished.call(this, { ri }, height); };
    if (this.editor.isOn) {
      this.editor.onClearActions.push(fn);
    }
    else {
      fn();
    }
  }
  
}
