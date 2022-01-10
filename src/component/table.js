import { stringAt } from '../core/alphabet';
import { getFontSizePxByPt } from '../core/font';
import _cell from '../core/cell';
import { formulam } from '../core/formula';
import { formatm } from '../core/format';

import {
  Draw, DrawBox, thinLineWidth, npx,
} from '../canvas/draw';
// gobal var
const cellPaddingWidth = 5;
const tableGridStyle = {
  fillStyle: '#fff',
  lineWidth: thinLineWidth,
  strokeStyle: '#e6e6e6',
};

function getDrawBox(data, rindex, cindex, yoffset = 0) {
  const {
    left, top, width, height,
  } = data.cellRect(rindex, cindex);
  return new DrawBox(left, top + yoffset, width, height, cellPaddingWidth);
}
/*
function renderCellBorders(bboxes, translateFunc) {
  const { draw } = this;
  if (bboxes) {
    const rset = new Set();
    // console.log('bboxes:', bboxes);
    bboxes.forEach(({ ri, ci, box }) => {
      if (!rset.has(ri)) {
        rset.add(ri);
        translateFunc(ri);
      }
      draw.strokeBorders(box);
    });
  }
}
*/

function getHighlightInfo (spreadsheet, rindex, cindex) {
  if (spreadsheet.highlightFormulaCells) {
    const highlightInfo = spreadsheet.highlightFormulaCells.find(coords => coords[0] == cindex && coords[1] == rindex);
    return highlightInfo;
  }
  return null;
}

export function renderCell(spreadsheet, draw, data, rindex, cindex, yoffset = 0, clipX, clipY, areaId = 'main', scrollX, scrollY, frozenWidth, frozenHeight, renderedBorders) {
  const { sortedRowMap, rows, cols } = data;
  if (rows.isHide(rindex) || cols.isHide(cindex)) return;
  let nrindex = rindex;
  if (sortedRowMap.has(rindex)) {
    nrindex = sortedRowMap.get(rindex);
  }

  const cell = data.getCell(nrindex, cindex);
  const highlightInfo = getHighlightInfo(spreadsheet, rindex, cindex);
  if (cell === null && !highlightInfo) return;
  let frozen = false;
  if (cell && 'editable' in cell && cell.editable === false) {
    frozen = true;
  }

  const style = data.getCellStyleOrDefault(nrindex, cindex);
  // render text
  let cellText = '';
  if (cell) {
    if (!data.settings.evalPaused) {
      cellText = _cell.render(spreadsheet, cell.text || '', formulam, (y, x) => (data.getCellTextOrDefault(x, y)));
    } else {
      cellText = cell.text || '';
    }
    if (style.customFormatter) {
      if (!style.customFormatter.prepareCellStyle && data.settings.cellCustomFormatterCreator) {
        data.settings.cellCustomFormatterCreator(style);
      }
      if (style.customFormatter.prepareCellStyle) {
        style.customFormatter.prepareCellStyle(cellText, style);
      }
    }
  }
  const dbox = getDrawBox(data, rindex, cindex, yoffset);
  dbox.bgcolor = style.bgcolor;
  if (style.border !== undefined) {
    dbox.setBorders(style.border);
    // bboxes.push({ ri: rindex, ci: cindex, box: dbox });
    draw.strokeBorders(dbox);
  }
  if (highlightInfo) {
    const borderStyle = ['thick', highlightInfo[2]];
    dbox.setBorders({
      top: borderStyle,
      right: borderStyle,
      bottom: borderStyle,
      left: borderStyle,
    });
    draw.strokeBorders(dbox);
  }
  renderedBorders[`${rindex}_${cindex}`] = {
      top: dbox.borderTop ? dbox.borderTop[0] : 'none',
      right: dbox.borderRight ? dbox.borderRight[0] : 'none',
      bottom: dbox.borderBottom ? dbox.borderBottom[0] : 'none',
      left: dbox.borderLeft ? dbox.borderLeft[0] : 'none',
  };
  if (cell === null) return;
  const prevBottomBorder = renderedBorders[`${rindex - 1}_${cindex}`] ? renderedBorders[`${rindex - 1}_${cindex}`].bottom : 'none';
  const prevRightBorder = renderedBorders[`${rindex}_${cindex - 1}`] ? renderedBorders[`${rindex}_${cindex - 1}`].right : 'none';
  draw.rect(
    dbox,
    () => {
        if (style.format) {
        // console.log(data.formatm, '>>', cell.format);
        cellText = formatm[style.format].render(cellText);
        }
        if (style.customFormatter) {
        if (!style.customFormatter.formatCellText && data.settings.cellCustomFormatterCreator) {
            data.settings.cellCustomFormatterCreator(style);
        }
        if (style.customFormatter.formatCellText) {
            cellText = style.customFormatter.formatCellText(cellText);
        }
        }
        const font = Object.assign({}, style.font);
        font.size = getFontSizePxByPt(font.size);
        // console.log('style:', style);
        draw.text(cellText, dbox, {
          hasAlignSet: style.hasAlignSet,
          align: style.align,
          valign: style.valign,
          font,
          color: style.color,
          strike: style.strike,
          underline: style.underline,
        }, style.textwrap, clipX, clipY, areaId, scrollX, scrollY, frozenWidth, frozenHeight, requiredBoxTotalHeight => {
          setTimeout(() => {
            spreadsheet.sheet.resizeRow(rindex, requiredBoxTotalHeight);
          }, 0);
        });
        // error
        const error = data.validations.getError(rindex, cindex);
        if (error) {
        // console.log('error:', rindex, cindex, error);
        draw.error(dbox);
        }
        if (frozen) {
        draw.frozen(dbox);
        }
    },
    prevBottomBorder === 'thick',
    prevRightBorder === 'thick',
  );
}

function renderAutofilter(viewRange) {
  const { data, draw } = this;
  if (viewRange) {
    const { autoFilter } = data;
    if (!autoFilter.active()) return;
    const afRange = autoFilter.hrange();
    if (viewRange.intersects(afRange)) {
      afRange.each((ri, ci) => {
        const dbox = getDrawBox(data, ri, ci);
        draw.dropdown(dbox);
      });
    }
  }
}

function renderContent(spreadsheet, viewRange, fw, fh, tx, ty, areaId = 'main', frozenWidth, frozenHeight, scrollX, scrollY) {
  const { draw, data } = this;
  draw.save();
  draw.translate(fw, fh)
    .translate(tx, ty);

  const { exceptRowSet } = data;
  // const exceptRows = Array.from(exceptRowSet);
  const filteredTranslateFunc = (ri) => {
    const ret = exceptRowSet.has(ri);
    if (ret) {
      const height = data.rows.getHeight(ri);
      draw.translate(0, -height);
    }
    return !ret;
  };

  const exceptRowTotalHeight = data.exceptRowTotalHeight(viewRange.sri, viewRange.eri);
  const renderedBorders = {};
  // 1 render cell
  draw.save();
  draw.translate(0, -exceptRowTotalHeight);
  viewRange.each((ri, ci) => {
    renderCell(spreadsheet, draw, data, ri, ci, 0, 0, 0, areaId, scrollX, scrollY, frozenWidth, frozenHeight, renderedBorders);
  }, ri => filteredTranslateFunc(ri));
  draw.restore();


  // 2 render mergeCell
  const rset = new Set();
  draw.save();
  draw.translate(0, -exceptRowTotalHeight);
  if (areaId === 'main') {
    draw.clipRect(
      -tx + frozenWidth,
      -ty + frozenHeight,
      viewRange.w,
      viewRange.h
    );
  }
  else if (areaId === 'frozen-left') {
    draw.clipRect(
      0,
      -ty + frozenHeight,
      viewRange.w,
      viewRange.h
    );
  }
  else if (areaId === 'frozen-top') {
    draw.clipRect(
      -tx + frozenWidth,
      0,
      viewRange.w,
      viewRange.h
    );
  }
  data.eachMergesInView(viewRange, ({ sri, sci, eri }) => {
    if (!exceptRowSet.has(sri)) {
      renderCell(spreadsheet, draw, data, sri, sci, 0, frozenWidth - tx, frozenHeight - ty, areaId, scrollX, scrollY, frozenWidth, frozenHeight, renderedBorders);
    } else if (!rset.has(sri)) {
      rset.add(sri);
      const height = data.rows.sumHeight(sri, eri + 1);
      draw.translate(0, -height);
    }
  });
  draw.restore();

  // 3 render autofilter
  renderAutofilter.call(this, viewRange);

  draw.restore();
}

function renderSelectedHeaderCell(x, y, w, h) {
  const { draw } = this;
  draw.save();
  draw.attr({ fillStyle: this.spreadsheet.data.settings.cellHeaderStyle.selectedBgcolor })
    .fillRect(x, y, w, h);
  draw.restore();
}

// viewRange
// type: all | left | top
// w: the fixed width of header
// h: the fixed height of header
// tx: moving distance on x-axis
// ty: moving distance on y-axis
function renderFixedHeaders(type, viewRange, w, h, tx, ty) {
  const { draw, data } = this;
  const sumHeight = viewRange.h; // rows.sumHeight(viewRange.sri, viewRange.eri + 1);
  const sumWidth = viewRange.w; // cols.sumWidth(viewRange.sci, viewRange.eci + 1);
  const nty = ty + h;
  const ntx = tx + w;

  draw.save();
  // draw rect background
  draw.attr({ fillStyle: this.spreadsheet.data.settings.cellHeaderStyle.bgcolor });
  if (type === 'all' || type === 'left') draw.fillRect(0, nty, w, sumHeight);
  if (type === 'all' || type === 'top') draw.fillRect(ntx, 0, sumWidth, h);

  const {
    sri, sci, eri, eci,
  } = data.selector.range;
  // console.log(data.selectIndexes);
  // draw text
  // text font, align...
  draw.attr({
    textAlign: 'center',
    textBaseline: 'middle',
    font: `500 ${npx(12)}px ${this.spreadsheet.data.settings.cellHeaderStyle.fontFamily}`,
    fillStyle: '#585757',
    lineWidth: thinLineWidth(),
    strokeStyle: '#e6e6e6',
  });
  // y-header-text
  if (type === 'all' || type === 'left') {
    data.rowEach(viewRange.sri, viewRange.eri, (i, y1, rowHeight) => {
      const y = nty + y1;
      const ii = i;
      draw.line([0, y], [w, y]);
      if (sri <= ii && ii < eri + 1) {
        renderSelectedHeaderCell.call(this, 0, y, w, rowHeight);
      }
      draw.fillText(ii + 1, w / 2, y + (rowHeight / 2));
      if (i > 0 && data.rows.isHide(i - 1)) {
        draw.save();
        draw.attr({ strokeStyle: '#c6c6c6' });
        draw.line([5, y + 5], [w - 5, y + 5]);
        draw.restore();
      }
    });
    draw.line([0, sumHeight + nty], [w, sumHeight + nty]);
    draw.line([w, nty], [w, sumHeight + nty]);
  }
  // x-header-text
  if (type === 'all' || type === 'top') {
    data.colEach(viewRange.sci, viewRange.eci, (i, x1, colWidth) => {
      const x = ntx + x1;
      const ii = i;
      draw.line([x, 0], [x, h]);
      if (sci <= ii && ii < eci + 1) {
        renderSelectedHeaderCell.call(this, x, 0, colWidth, h);
      }
      draw.fillText(stringAt(ii), x + (colWidth / 2), h / 2);
      if (i > 0 && data.cols.isHide(i - 1)) {
        draw.save();
        draw.attr({ strokeStyle: '#c6c6c6' });
        draw.line([x + 5, 5], [x + 5, h - 5]);
        draw.restore();
      }
    });
    draw.line([sumWidth + ntx, 0], [sumWidth + ntx, h]);
    draw.line([0, h], [sumWidth + ntx, h]);
  }
  draw.restore();
}

function renderFixedLeftTopCell(fw, fh) {
  const { draw } = this;
  draw.save();
  // left-top-cell
  draw.attr({ fillStyle: this.spreadsheet.data.settings.cellHeaderStyle.cornerBgcolor })
    .fillRect(0, 0, fw, fh);
  draw.restore();
}

function renderContentGrid({
  sri, sci, eri, eci, w, h,
}, fw, fh, tx, ty) {
  const { draw, data } = this;
  const { settings } = data;

  draw.save();
  draw.attr(tableGridStyle)
    .translate(fw + tx, fh + ty);
  // const sumWidth = cols.sumWidth(sci, eci + 1);
  // const sumHeight = rows.sumHeight(sri, eri + 1);
  // console.log('sumWidth:', sumWidth);
  // draw.clearRect(0, 0, w, h);
  if (!settings.showGrid) {
    draw.restore();
    return;
  }
  // console.log('rowStart:', rowStart, ', rowLen:', rowLen);
  data.rowEach(sri, eri, (i, y, ch) => {
    // console.log('y:', y);
    if (i !== sri) draw.line([0, y], [w, y]);
    if (i === eri) draw.line([0, y + ch], [w, y + ch]);
  });
  data.colEach(sci, eci, (i, x, cw) => {
    if (i !== sci) draw.line([x, 0], [x, h]);
    if (i === eci) draw.line([x + cw, 0], [x + cw, h]);
  });
  draw.restore();
}

function renderFreezeHighlightLine(fw, fh, ftw, fth) {
  const { draw, data } = this;
  const twidth = data.viewWidth() - fw;
  const theight = data.viewHeight() - fh;
  draw.save()
    .translate(fw, fh)
    .attr({ strokeStyle: 'rgba(75, 137, 255, .6)' });
  draw.line([0, fth], [twidth, fth]);
  draw.line([ftw, 0], [ftw, theight]);
  draw.restore();
}

/** end */
class Table {
  constructor(el, data, spreadsheet, clickableElementsInner) {
    this.el = el;
    this.draw = new Draw(el, data.viewWidth(), data.viewHeight(), spreadsheet.getClickableElementFinders(), clickableElementsInner, spreadsheet);
    this.data = data;
    this.spreadsheet = spreadsheet;
    this.clickableElementsInner = clickableElementsInner;
  }

  resetData(data) {
    this.data = data;
    this.render();
  }

  render() {
    this.clickableElementsInner.el.innerHTML = '';
    // resize canvas
    const { data } = this;
    const { rows, cols } = data;
    // fixed width of header
    const fw = cols.indexWidth;
    // fixed height of header
    const fh = rows.height;

    this.draw.resize(data.viewWidth(), data.viewHeight());
    this.clear();

    const viewRange = data.viewRange();
    // renderAll.call(this, viewRange, data.scroll);
    const tx = data.freezeTotalWidth();
    const ty = data.freezeTotalHeight();
    const { x, y } = data.scroll;
    // 1
    renderContentGrid.call(this, viewRange, fw, fh, tx, ty);
    renderContent.call(this, this.spreadsheet, viewRange, fw, fh, -x, -y, 'main', tx, ty, -x, -y);
    renderFixedHeaders.call(this, 'all', viewRange, fw, fh, tx, ty);
    renderFixedLeftTopCell.call(this, fw, fh);
    const [fri, fci] = data.freeze;
    if (fri > 0 || fci > 0) {
      // 2
      if (fri > 0) {
        const vr = viewRange.clone();
        vr.sri = 0;
        vr.eri = fri - 1;
        vr.h = ty;
        renderContentGrid.call(this, vr, fw, fh, tx, 0);
        renderContent.call(this, this.spreadsheet, vr, fw, fh, -x, 0, 'frozen-top', tx, ty, -x, -y);
        renderFixedHeaders.call(this, 'top', vr, fw, fh, tx, 0);
      }
      // 3
      if (fci > 0) {
        const vr = viewRange.clone();
        vr.sci = 0;
        vr.eci = fci - 1;
        vr.w = tx;
        renderContentGrid.call(this, vr, fw, fh, 0, ty);
        renderFixedHeaders.call(this, 'left', vr, fw, fh, 0, ty);
        renderContent.call(this, this.spreadsheet, vr, fw, fh, 0, -y, 'frozen-left', tx, ty, -x, -y);
      }
      // 4
      const freezeViewRange = data.freezeViewRange();
      renderContentGrid.call(this, freezeViewRange, fw, fh, 0, 0);
      renderFixedHeaders.call(this, 'all', freezeViewRange, fw, fh, 0, 0);
      renderContent.call(this, this.spreadsheet, freezeViewRange, fw, fh, 0, 0, 'frozen-corner', tx, ty, -x, -y);
      // 5
      renderFreezeHighlightLine.call(this, fw, fh, tx, ty);
    }
  }

  clear() {
    this.draw.clear();
  }
}

export default Table;
