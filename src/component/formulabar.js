import { h } from './element';
import { cssPrefix } from '../config';

export default class FormulaBar {
  constructor(editable, formulaBarOptions, onInputCallback) {
    this.editable = editable;
    this.formulaBarOptions = formulaBarOptions;
    this.el = h('div', `${cssPrefix}-formulabar ${cssPrefix}-${formulaBarOptions.location === 'nextToToolbar' ? 'next-to-toolbar' : 'below-toolbar'}`)
      .child(
        this.inputEl = h('input', '')
          .on("keydown", evt => {
            if (evt.keyCode !== 13 && evt.keyCode !== 27) {
              evt.stopPropagation();
            }
            if (evt.keyCode === 27) {
              this.reset(this.initialText);
              if (onInputCallback) {
                onInputCallback(this.text);
              }
            }
          })
          .on("input", () => {
            if (onInputCallback) {
              this.text = this.inputEl.val();
              onInputCallback(this.text);
            }
          })
      )
      .child(
        this.selectionInfoEl = h('div', `${cssPrefix}-selection-info`)
      );
    if (!this.editable) {
      this.inputEl.el.readOnly = true;
    }
  }
  
  setSelectionInfoText(text) {
    this.selectionInfoEl.el.textContent = text;
  }
  
  reset(text) {
    this.initialText = text;
    this.text = text;
    this.inputEl.val(text);
  }
  
  setText(text) {
    this.text = text;
    this.inputEl.val(text);
  }
  
}
