//* global window */
import { h } from './element';
import Suggest from './suggest';
import Datepicker from './datepicker';
import { cssPrefix } from '../config';
// import { mouseMoveUp } from '../event';

function resetTextareaSize() {
  const { inputText } = this;
  if (!/^\s*$/.test(inputText)) {
    const {
      textlineEl, textEl, areaOffset,
    } = this;
    const txts = inputText.split('\n');
    const maxTxtSize = Math.max(...txts.map(it => it.length));
    const tlOffset = textlineEl.offset();
    const fontWidth = tlOffset.width / inputText.length;
    const tlineWidth = (maxTxtSize + 1) * fontWidth + 5;
    const maxWidth = this.viewFn().width - areaOffset.left - fontWidth;
    let h1 = txts.length;
    if (tlineWidth > areaOffset.width) {
      let twidth = tlineWidth;
      if (tlineWidth > maxWidth) {
        twidth = maxWidth;
        h1 += parseInt(tlineWidth / maxWidth, 10);
        h1 += (tlineWidth % maxWidth) > 0 ? 1 : 0;
      }
      textEl.css('width', `${twidth}px`);
    }
    h1 *= this.rowHeight;
    if (h1 > areaOffset.height) {
      textEl.css('height', `${h1}px`);
    }
  }
}

function insertText({ target }, itxt) {
  const { value, selectionEnd } = target;
  const ntxt = `${value.slice(0, selectionEnd)}${itxt}${value.slice(selectionEnd)}`;
  target.value = ntxt;
  target.setSelectionRange(selectionEnd + 1, selectionEnd + 1);

  this.inputText = ntxt;
  this.textlineEl.html(ntxt);
  resetTextareaSize.call(this);
}

function keydownEventHandler(evt) {
  const { keyCode, altKey, shiftKey } = evt;
  this.checkChooserTrigger(evt);
  const arrowExits = !this.viaF2;
  if (keyCode === 38 || keyCode === 40) {
    if (arrowExits) {
      this.clear();
      if (this.moveCursorFn) {
        this.moveCursorFn(keyCode === 38 ? -1 : 1, shiftKey, false);
      }
    }
    else {
      if (keyCode == 38) {
        this.setCursorPosition(0);
      }
      else if (keyCode == 40) {
        this.setCursorPosition(this.inputText.length);
      }
    }
    return;
  }
  if (keyCode === 37 || keyCode === 39) {
    if (arrowExits) {
      this.clear();
      if (this.moveCursorFn) {
        this.moveCursorFn(keyCode === 37 ? -1 : 1, shiftKey, true);
      }
      return;
    }
    setTimeout(() => {
      this.toggleChooserHint();
    }, 0);
  }
  if (keyCode !== 13 && keyCode !== 9) evt.stopPropagation();
  if (keyCode === 13 && shiftKey) {
    insertText.call(this, evt, '\n');
    evt.stopPropagation();
  }
  if (keyCode === 13 && !altKey) evt.preventDefault();
  if (keyCode === 27) {
    this.inputText = this.initialText;
    this.change('input', this.inputText);
    this.clear();
  }
}

function clickEventHandler(evt) {
  this.toggleChooserHint();
}

function inputEventHandler(evt) {
  const v = evt.target.value;
  // console.log(evt, 'v:', v);
  const { suggest, textlineEl, validator } = this;
  const { cell } = this;
  if (cell !== null) {
    if (('editable' in cell && cell.editable === true) || (cell.editable === undefined)) {
      this.inputText = v;
      if (validator) {
        if (validator.type === 'list') {
          suggest.search(v);
        } else {
          suggest.hide();
        }
      } else {
        const start = v.lastIndexOf('=');
        if (start !== -1) {
          suggest.search(v.substring(start + 1));
        } else {
          suggest.hide();
        }
      }
      this.toggleChooserHint();
      textlineEl.html(v);
      resetTextareaSize.call(this);
      this.change('input', v);
    } else {
      evt.target.value = cell.text;
    }
  } else {
    this.inputText = v;
    if (validator) {
      if (validator.type === 'list') {
        suggest.search(v);
      } else {
        suggest.hide();
      }
    } else {
      const start = v.lastIndexOf('=');
      if (start !== -1) {
        suggest.search(v.substring(start + 1));
      } else {
        suggest.hide();
      }
    }
    this.toggleChooserHint();
    textlineEl.html(v);
    resetTextareaSize.call(this);
    this.change('input', v);
  }
}

function setTextareaRange(position) {
  const { el } = this.textEl;
  setTimeout(() => {
    el.focus();
    el.setSelectionRange(position, position);
    this.toggleChooserHint();
  }, 0);
}

function setText(text, position) {
  const { textEl, textlineEl } = this;
  // firefox bug
  textEl.el.blur();

  textEl.val(text);
  textlineEl.html(text);
  setTextareaRange.call(this, position);
}

function suggestItemClick(it) {
  const { inputText, validator } = this;
  let position = 0;
  if (validator && validator.type === 'list') {
    this.inputText = it;
    position = this.inputText.length;
  } else {
    const start = inputText.lastIndexOf('=');
    const sit = inputText.substring(0, start + 1);
    let eit = inputText.substring(start + 1);
    if (eit.indexOf(')') !== -1) {
      eit = eit.substring(eit.indexOf(')'));
    } else {
      eit = '';
    }
    this.inputText = `${sit + it.key}(`;
    // console.log('inputText:', this.inputText);
    position = this.inputText.length;
    this.inputText += `)${eit}`;
  }
  setText.call(this, this.inputText, position);
}

function resetSuggestItems() {
  this.suggest.setItems(this.formulas);
}

function dateFormat(d) {
  let month = d.getMonth() + 1;
  let date = d.getDate();
  if (month < 10) month = `0${month}`;
  if (date < 10) date = `0${date}`;
  return `${d.getFullYear()}-${month}-${date}`;
}

export default class Editor {
  constructor(formulas, viewFn, rowHeight, moveCursorFn, suggestFormulas, choosers, spreadsheet) {
    this.viewFn = viewFn;
    this.rowHeight = rowHeight;
    this.formulas = formulas;
    this.moveCursorFn = moveCursorFn;
    this.choosers = choosers;
    this.spreadsheet = spreadsheet;
    this.suggest = new Suggest(formulas, (it) => {
      suggestItemClick.call(this, it);
    }, '200px', !suggestFormulas);
    this.datepicker = new Datepicker();
    this.datepicker.change((d) => {
      // console.log('d:', d);
      this.setText(dateFormat(d));
      this.clear();
    });
    this.areaEl = h('div', `${cssPrefix}-editor-area`)
      .children(
        this.textEl = h('textarea', '')
          .on('input', evt => inputEventHandler.call(this, evt))
          .on('paste.stop', () => {})
          .on('keydown', evt => keydownEventHandler.call(this, evt))
          .on('click', evt => clickEventHandler.call(this, evt)),
        this.textlineEl = h('div', 'textline'),
        this.suggest.el,
        this.datepicker.el,
      )
      .on('mousemove.stop', () => {})
      .on('mousedown.stop', () => {});
    this.el = h('div', `${cssPrefix}-editor`)
      .child(this.areaEl).hide();
    this.suggest.bindInputEvents(this.textEl);

    this.areaOffset = null;
    this.freeze = { w: 0, h: 0 };
    this.cell = null;
    this.inputText = '';
    this.change = () => {};
  }

  setFreezeLengths(width, height) {
    this.freeze.w = width;
    this.freeze.h = height;
  }

  clear() {
    // const { cell } = this;
    // const cellText = (cell && cell.text) || '';
    if (this.inputText !== '') {
      this.change('finished', this.inputText);
    }
    this.cell = null;
    this.areaOffset = null;
    this.inputText = '';
    this.initialText = '';
    this.el.hide();
    this.textEl.val('');
    this.textlineEl.html('');
    resetSuggestItems.call(this);
    this.datepicker.hide();
    this.hideChooserHint();
  }

  setOffset(offset, suggestPosition = 'top') {
    const {
      textEl, areaEl, suggest, freeze, el,
    } = this;
    if (offset) {
      this.areaOffset = offset;
      const {
        left, top, width, height, l, t,
      } = offset;
      // console.log('left:', left, ',top:', top, ', freeze:', freeze);
      const elOffset = { left: 0, top: 0 };
      // top left
      if (freeze.w > l && freeze.h > t) {
        //
      } else if (freeze.w < l && freeze.h < t) {
        elOffset.left = freeze.w;
        elOffset.top = freeze.h;
      } else if (freeze.w > l) {
        elOffset.top = freeze.h;
      } else if (freeze.h > t) {
        elOffset.left = freeze.w;
      }
      el.offset(elOffset);
      areaEl.offset({ left: left - elOffset.left - 0.8, top: top - elOffset.top - 0.8 });
      textEl.offset({ width: width - 9 + 0.8, height: height - 3 + 0.8 });
      const sOffset = { left: 0 };
      sOffset[suggestPosition] = height;
      suggest.setOffset(sOffset);
      suggest.hide();
    }
  }

  setCell(cell, validator, initialText, viaF2) {
    // console.log('::', validator);
    const { el, datepicker, suggest } = this;
    el.show();
    this.cell = cell;
    const text = (cell && cell.text) || '';
    this.setText(text);
    this.initialText = typeof(initialText) === "string" ? initialText : text;
    this.viaF2 = !!viaF2;

    this.validator = validator;
    if (validator) {
      const { type } = validator;
      if (type === 'date') {
        datepicker.show();
        if (!/^\s*$/.test(text)) {
          datepicker.setValue(text);
        }
      }
      if (type === 'list') {
        suggest.setItems(validator.values());
        suggest.search('');
      }
    }
  }

  setText(text) {
    this.inputText = text;
    // console.log('text>>:', text);
    setText.call(this, text, text.length);
    resetTextareaSize.call(this);
  }
  
  appendText(text) {
    this.setText(this.inputText + text);
  }
  
  injectText(text, idxStart, idxEnd = -1) {
    const left = this.inputText.substr(0, idxStart);
    const right = this.inputText.substr(idxEnd >= 0 ? idxEnd : idxStart);
    this.setText(left + text + right);
  }
  
  getCursorPosition() {
    return [this.textEl.el.selectionStart, this.textEl.el.selectionEnd];
  }
  
  setCursorPosition(idxStart, idxEnd = -1) {
    this.textEl.el.selectionStart = idxStart;
    this.textEl.el.selectionEnd = idxEnd >= 0 ? idxEnd : idxStart;
  }
  
  isEnteringFormula() {
    return this.inputText && this.inputText.startsWith('=');
  }
  
  toggleChooserHint() {
    if (document.activeElement != this.textEl.el) {
      return;
    }
    const text = this.inputText;
    const selection = {
      start: this.textEl.el.selectionStart,
      end: this.textEl.el.selectionEnd,
    };
    
    let hint = null;
    let currentChooser = null;
    for (const chooser of this.choosers) {
      const chooserHint = chooser.getHint.call(this.spreadsheet, text, selection);
      if (chooserHint !== false) {
        hint = chooserHint;
        currentChooser = chooser;
        break;
      }
    }
    
    if (hint) {
      this.showChooserHint(hint.html, hint, currentChooser);
    }
    else {
      this.hideChooserHint();
    }
  }
  
  showChooserHint(html, hint, chooser) {
    if (!this.chooserHintEl) {
      this.chooserHintEl = h('div', `${cssPrefix}-chooser-hint`);
      this.areaEl.child(this.chooserHintEl);
    }
    this.chooserHintEl.el.innerHTML = html;
    this.currentChooserHint = hint;
    this.currentChooser = chooser;
  }
  
  hideChooserHint() {
    if (this.chooserHintEl) {
      try {
        this.areaEl.removeChild(this.chooserHintEl);
      }
      catch {
      }
      try {
        this.chooserHintEl.el.remove();
      }
      catch {
      }
      this.currentChooser = null;
      this.currentChooserHint = null;
      this.chooserHintEl = null;
    }
  }

  checkChooserTrigger(evt) {
    if (!this.currentChooser) {
      return;
    }
    const trigger = this.currentChooserHint.triggers.filter(trigger => {
      if (evt.keyCode !== trigger.keyCode) {
        return false;
      }
      if (typeof(trigger.ctrlOrMeta) === 'boolean' && (evt.ctrlKey !== trigger.ctrlOrMeta && evt.metaKey !== trigger.ctrlOrMeta)) {
        return false;
      }
      if (typeof(trigger.shift) === 'boolean' && evt.shiftKey !== trigger.shift) {
        return false;
      }
      if (typeof(trigger.alt) === 'boolean' && evt.altKey !== trigger.alt) {
        return false;
      }
      return true;
    })[0];
    if (!trigger) {
      return;
    }
    const text = this.inputText;
    const selection = {
      start: this.textEl.el.selectionStart,
      end: this.textEl.el.selectionEnd,
    };
    const res = this.currentChooser.onTriggered.call(this.spreadsheet, text, selection);
    if (!res) {
      return;
    }
    res.then(data => {
      const { text, cursorPosition } = data;
      this.setText(text);
      this.setCursorPosition(cursorPosition.start, cursorPosition.end);
      setTimeout(() => {
        this.setCursorPosition(cursorPosition.start, cursorPosition.end);
      }, 0);
    });
  }
  
}
