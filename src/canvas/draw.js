/* global window */
function dpr() {
  return window.devicePixelRatio || 1;
}

function thinLineWidth() {
  return dpr() - 0.5;
}

function npx(px) {
  return parseInt(px * dpr(), 10);
}

function revNpx(px) {
  return px / dpr();
}

function npxLine(px) {
  const n = npx(px);
  return n > 0 ? n - 0.5 : 0.5;
}

class DrawBox {
  constructor(x, y, w, h, padding = 0, addedExtraWidth = 0) {
    this.x = x;
    this.y = y;
    this.width = w;
    this.height = h;
    this.padding = padding;
    this.addedExtraWidth = addedExtraWidth;
    this.bgcolor = '#ffffff';
    // border: [width, style, color]
    this.borderTop = null;
    this.borderRight = null;
    this.borderBottom = null;
    this.borderLeft = null;
  }

  setBorders({
    top, bottom, left, right,
  }) {
    if (top) this.borderTop = top;
    if (right) this.borderRight = right;
    if (bottom) this.borderBottom = bottom;
    if (left) this.borderLeft = left;
  }

  innerWidth() {
    return this.width - (this.padding * 2) - 2;
  }

  innerHeight() {
    return this.height - (this.padding * 2) - 2;
  }

  textx(align) {
    const { width, padding } = this;
    let { x } = this;
    if (align === 'left') {
      x += padding;
    } else if (align === 'center') {
      x += width / 2;
    } else if (align === 'right') {
      x += width - padding;
    }
    return x;
  }

  texty(align, h) {
    const { height, padding } = this;
    let { y } = this;
    if (align === 'top') {
      y += padding;
    } else if (align === 'middle') {
      y += height / 2 - h / 2;
    } else if (align === 'bottom') {
      y += height - padding - h;
    }
    return y;
  }

  topxys() {
    const { x, y, width } = this;
    return [[x, y], [x + width, y]];
  }

  rightxys() {
    const {
      x, y, width, height,
    } = this;
    return [[x + width, y], [x + width, y + height]];
  }

  bottomxys() {
    const {
      x, y, width, height,
    } = this;
    return [[x, y + height], [x + width, y + height]];
  }

  leftxys() {
    const {
      x, y, height,
    } = this;
    return [[x, y], [x, y + height]];
  }
}

function drawFontLine(type, tx, ty, align, valign, blheight, blwidth) {
  const floffset = { x: 0, y: 0 };
  if (type === 'underline') {
    if (valign === 'bottom') {
      floffset.y = 0;
    } else if (valign === 'top') {
      floffset.y = -(blheight + 2);
    } else {
      floffset.y = -blheight / 2;
    }
  } else if (type === 'strike') {
    if (valign === 'bottom') {
      floffset.y = blheight / 2;
    } else if (valign === 'top') {
      floffset.y = -((blheight / 2) + 2);
    }
  }

  if (align === 'center') {
    floffset.x = blwidth / 2;
  } else if (align === 'right') {
    floffset.x = blwidth;
  }
  this.line(
    [tx - floffset.x, ty - floffset.y],
    [tx - floffset.x + blwidth, ty - floffset.y],
  );
}

class Draw {
  constructor(el, width, height, clickableElementFinders, clickableElementsContainer, spreadsheet) {
    this.el = el;
    this.ctx = el.getContext('2d');
    this.resize(width, height);
    this.ctx.scale(dpr(), dpr());
    this.clickableElementFinders = clickableElementFinders;
    this.clickableElementsContainer = clickableElementsContainer;
    this.spreadsheet = spreadsheet;
  }

  resize(width, height) {
    // console.log('dpr:', dpr);
    this.el.style.width = `${width}px`;
    this.el.style.height = `${height}px`;
    this.el.width = npx(width);
    this.el.height = npx(height);
  }

  clear() {
    const { width, height } = this.el;
    this.ctx.clearRect(0, 0, width, height);
    return this;
  }

  attr(options) {
    Object.assign(this.ctx, options);
    return this;
  }

  save() {
    this.ctx.save();
    this.ctx.beginPath();
    return this;
  }

  restore() {
    this.ctx.restore();
    return this;
  }
  
  clipRect(x, y,  w, h) {
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
  }

  beginPath() {
    this.ctx.beginPath();
    return this;
  }

  translate(x, y) {
    this.ctx.translate(npx(x), npx(y));
    return this;
  }

  scale(x, y) {
    this.ctx.scale(x, y);
    return this;
  }

  clearRect(x, y, w, h) {
    this.ctx.clearRect(x, y, w, h);
    return this;
  }

  fillRect(x, y, w, h) {
    this.ctx.fillRect(npx(x) - 0.5, npx(y) - 0.5, npx(w), npx(h));
    return this;
  }

  fillText(text, x, y) {
    this.ctx.fillText(text, npx(x), npx(y));
    return this;
  }
  
  getTextWidth(text, font = null) {
    if (font) {
      this.ctx.save();
      this.attr({
        font: `${font.italic ? 'italic' : ''} ${font.bold ? 'bold' : ''} ${npx(font.size)}px ${font.name}`,
      });
    }
    const width = this.ctx.measureText(text).width;
    if (font) {
      this.ctx.restore();
    }
    return width;
  }

  /*
    txt: render text
    box: DrawBox
    attr: {
      align: left | center | right
      valign: top | middle | bottom
      color: '#333333',
      strike: false,
      font: {
        name: 'Arial',
        size: 14,
        bold: false,
        italic: false,
      }
    }
    textWrap: text wrapping
  */
  text(mtxt, box, attr = {}, textWrap = true, clipX, clipY, areaId, scrollX, scrollY, frozenWidth, frozenHeight, missingHeightCb) {
    const { ctx } = this;
    const {
      hasAlignSet, align: _align, valign, font, color, strike, underline,
    } = attr;
    const align = (hasAlignSet || isNaN(mtxt)) ? _align : 'right';
    const baseTx = box.textx(align);
    ctx.save();
    ctx.beginPath();
    this.attr({
      textBaseline: valign,
      font: `${font.italic ? 'italic' : ''} ${font.bold ? 'bold' : ''} ${npx(font.size)}px ${font.name}`,
      fillStyle: color,
      strokeStyle: color,
    });
    const txts = `${mtxt}`.split('\n');
    const biw = box.innerWidth();
    const ntxts = [];
    txts.forEach((_it) => {
      const [clickable, it, texts] = this.parseClickableElements(_it);
      const txtWidth = this.getTextWidth(it);
      if (textWrap && txtWidth > npx(biw)) {
        let textLine = { w: 0, len: 0, start: 0 };
        let lastSpaceIdx = -1;
        let wAfterLastSpace = 0;
        for (let i = 0; i < it.length; i += 1) {
          if (textLine.w >= npx(biw)) {
            if (lastSpaceIdx > -1) {
              textLine.len = lastSpaceIdx - textLine.start;
              textLine.w -= wAfterLastSpace;
            }
            const segments = this.getTextSegments(texts, textLine.start, textLine.len);
            ntxts.push(segments);
            if (lastSpaceIdx > -1) {
              i = lastSpaceIdx + 1;
              lastSpaceIdx = -1;
              wAfterLastSpace = 0;
            }
            textLine = { w: 0, len: 0, start: i };
          }
          textLine.len += 1;
          let cw = this.getTextWidth(it[i]) + 1;
          textLine.w += cw;
          wAfterLastSpace += cw;
          if (it[i] === ' ' || it[i] === '\t') {
            lastSpaceIdx = i;
            wAfterLastSpace = 0;
          }
        }
        if (textLine.len > 0) {
          const segments = this.getTextSegments(texts, textLine.start, textLine.len);
          ntxts.push(segments);
        }
      } else {
        ntxts.push(texts);
      }
    });
    const txtHeight = (ntxts.length - 1) * (font.size + 2);
    
    if (textWrap) {
        const totalTextHeight = txtHeight + font.size;
        const boxInnerHeight = box.innerHeight();
        const boxTotalHeight = box.height;
        if (totalTextHeight > boxInnerHeight) {
            const missingBoxHeight = Math.ceil(totalTextHeight - boxInnerHeight);
            const requiredBoxTotalHeight = boxTotalHeight + missingBoxHeight;
            if (missingHeightCb) {
                missingHeightCb(requiredBoxTotalHeight);
            }
        }
    }
    
    let ty = box.texty(valign, txtHeight);
    ntxts.forEach((txts) => {
      let dx = 0;
      const textWidths = [];
      let totalWidth = 0;
      for (const txt of txts) {
        const txtWidth = revNpx(this.getTextWidth(txt.text));
        textWidths.push(txtWidth);
        totalWidth += txtWidth;
      }
      let tx = baseTx;
      if (align == 'right') {
        tx -= totalWidth;
      }
      else if (align == 'center') {
        tx -= totalWidth / 2;
      }
      for (const i in txts) {
        const txt = txts[i];
        const txtWidth = textWidths[i];
        if (!txt.el) {
          this.fillText(txt.text, tx + dx, ty);
        }
        if (strike) {
          drawFontLine.call(this, 'strike', tx + dx, ty, align, valign, font.size, txtWidth);
        }
        if (underline) {
          drawFontLine.call(this, 'underline', tx + dx, ty, align, valign, font.size, txtWidth);
        }
        if (txt.el && this.clickableElementsContainer) {
          const newEl = document.createElement("div");
          newEl.innerHTML = '<div class="spreadsheet-trigger-container"><div class="spreadsheet-trigger">' + txt.el.finder.render.call(this.spreadsheet, txt.text, txt.el.data) + '</div></div>';
          this.clickableElementsContainer.el.appendChild(newEl.children[0]);
          const elem = this.clickableElementsContainer.el.children[this.clickableElementsContainer.el.children.length - 1];
          const elem2 = elem.children[0];
          elem.style.width = box.width + 'px';
          elem.style.height = box.height + 'px';
          const boxX = box.x - (areaId === 'frozen-left' || areaId === 'frozen-corner' ? scrollX : 0);
          const boxY = box.y - (areaId === 'frozen-top' || areaId === 'frozen-corner' ? scrollY : 0);
          elem.style.left = boxX + 'px';
          elem.style.top = boxY + 'px';
          const clipLeft = Math.max(0, clipX - box.x - (areaId === 'frozen-left' ? frozenWidth : 0));
          const clipTop = Math.max(0, clipY - box.y - (areaId === 'frozen-top' ? frozenHeight : 0));
          elem.style.clip = `rect(${clipTop}px, 10000px, 10000px, ${clipLeft}px)`;
          elem2.style.left = Math.floor(tx + dx - box.x) + 'px';
          let dt = 0;
          if (valign == 'top') {
            dt = (font.size + 2) / 2 - 1;
          }
          else if (valign == 'bottom') {
            dt = -(font.size + 2) / 2 + 1;
          }
          elem2.style.top = Math.floor(ty - 8 - box.y + dt) + 'px';
          elem2.addEventListener("click", evt => {
            if (evt.ctrlKey || evt.metaKey) {
              txt.el.finder.onCtrlClick.call(this.spreadsheet, txt.el.data);
            }
          });
        }
        dx += txtWidth;
      }
      ty += font.size + 2;
    });
    ctx.restore();
    return this;
  }
  
  getTextSegments(texts, start, length) {
    const segments = [];
    let prevLen = 0;
    for (const data of texts) {
      const dataStart = prevLen;
      prevLen = dataStart + data.text.length;
      const dataEnd = dataStart + data.text.length;
      if (dataEnd < start || dataStart > start + length) {
        continue;
      }
      if (dataStart >= start && dataEnd <= start + length) {
        segments.push(data);
        continue;
      }
      if (dataStart >= start && dataEnd > start + length) {
        // rm tail
        const d = data.text.length - (dataEnd - (start + length));
        const txt = data.text.substr(0, d);
        if (txt.length > 0) {
          segments.push({
            text: txt,
            el: data.el,
          });
        }
        continue;
      }
      if (dataStart < start && dataEnd <= start + length) {
        // rm head
        const d = start - dataStart;
        const txt = data.text.substr(d);
        if (txt.length > 0) {
          segments.push({
            text: txt,
            el: data.el,
          });
        }
        continue;
      }
      if (dataStart < start && dataEnd > start + length) {
        // rm head & tail
        const d1 = start - dataStart;
        const d2 = data.text.length - (dataEnd - (start + length));
        const txt = data.text.substr(d1, d2 - d1);
        if (txt.length > 0) {
          segments.push({
            text: txt,
            el: data.el,
          });
        }
        continue;
      }
    }
    return segments;
  }
  
  parseClickableElements(text) {
    if (!this.clickableElementFinders) {
      return [];
    }
    const els = [];
    const texts = [];
    for (const finder of this.clickableElementFinders) {
      const found = finder.finder(text);
      els.push(...found.map(x => {
        x.finder = finder;
        return x;
      }));
    }
    const idxsToRemove = [];
    for (let i = 0; i < els.length; ++i) {
      const el = els[i];
      for (let j = 0; j < els.length; ++j) {
        if (i === j) {
          continue;
        }
        const el2 = els[j];
        if (el.start >= el2.start && el.start < el2.start + el2.length) {
          idxsToRemove.push(i);
          break;
        }
      }
    }
    for (let i = idxsToRemove.length - 1; i >= 0; --i) {
      els.splice(idxsToRemove[i], 1);
    }
    let prevEnd = -1;
    for (const idx in els) {
      const el = els[idx];
      const left = text.substr(0, el.start);
      const forEl = text.substr(el.start, el.length);
      const right = text.substr(el.start + el.length);
      const leftPartial = prevEnd < 0 ? left : left.substr(prevEnd);
      if (leftPartial.length > 0) {
        texts.push({ text: leftPartial });
      }
      prevEnd = el.start + el.length;
      const txt = ' '.repeat(el.extraPreSpaces) + forEl + ' '.repeat(el.extraPostSpaces);
      if (txt.length > 0) {
        texts.push({
          text: txt,
          el: el,
        });
      }
      if (right.length > 0 && parseInt(idx) + 1 === els.length) {
        texts.push({ text: right });
      }
    }
    
    if (texts.length === 0) {
      texts.push({ text: text });
    }
    
    let newText = texts.map(txt => txt.text).join('');
    
    return [els, newText, texts];
  }

  border(style, color) {
    const { ctx } = this;
    ctx.lineWidth = thinLineWidth;
    ctx.strokeStyle = color;
    // console.log('style:', style);
    if (style === 'medium') {
      ctx.lineWidth = npx(2) - 0.5;
    } else if (style === 'thick') {
      ctx.lineWidth = npx(3);
    } else if (style === 'dashed') {
      ctx.setLineDash([npx(3), npx(2)]);
    } else if (style === 'dotted') {
      ctx.setLineDash([npx(1), npx(1)]);
    } else if (style === 'double') {
      ctx.setLineDash([npx(2), 0]);
    }
    return this;
  }

  line(...xys) {
    const { ctx } = this;
    if (xys.length > 1) {
      ctx.beginPath();
      const [x, y] = xys[0];
      ctx.moveTo(npxLine(x), npxLine(y));
      for (let i = 1; i < xys.length; i += 1) {
        const [x1, y1] = xys[i];
        ctx.lineTo(npxLine(x1), npxLine(y1));
      }
      ctx.stroke();
    }
    return this;
  }

  strokeBorders(box) {
    const { ctx } = this;
    ctx.save();
    // border
    const {
      borderTop, borderRight, borderBottom, borderLeft,
    } = box;
    if (borderTop) {
      this.border(...borderTop);
      // console.log('box.topxys:', box.topxys());
      this.line(...box.topxys());
    }
    if (borderRight) {
      this.border(...borderRight);
      this.line(...box.rightxys());
    }
    if (borderBottom) {
      this.border(...borderBottom);
      this.line(...box.bottomxys());
    }
    if (borderLeft) {
      this.border(...borderLeft);
      this.line(...box.leftxys());
    }
    ctx.restore();
  }

  dropdown(box) {
    const { ctx } = this;
    const {
      x, y, width, height,
    } = box;
    const sx = x + width - 15;
    const sy = y + height - 15;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(npx(sx), npx(sy));
    ctx.lineTo(npx(sx + 8), npx(sy));
    ctx.lineTo(npx(sx + 4), npx(sy + 6));
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 0, 0, .45)';
    ctx.fill();
    ctx.restore();
  }

  error(box) {
    const { ctx } = this;
    const { x, y, width } = box;
    const sx = x + width - 1;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(npx(sx - 8), npx(y - 1));
    ctx.lineTo(npx(sx), npx(y - 1));
    ctx.lineTo(npx(sx), npx(y + 8));
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 0, 0, .65)';
    ctx.fill();
    ctx.restore();
  }

  frozen(box) {
    const { ctx } = this;
    const { x, y, width } = box;
    const sx = x + width - 1;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(npx(sx - 8), npx(y - 1));
    ctx.lineTo(npx(sx), npx(y - 1));
    ctx.lineTo(npx(sx), npx(y + 8));
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 255, 0, .85)';
    ctx.fill();
    ctx.restore();
  }

  rect(box, dtextcb, addExtraPaddingTop, addExtraPaddingLeft) {
    const { ctx } = this;
    const {
      x, y, width, height, bgcolor,
    } = box;
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = bgcolor || '#fff';
    ctx.rect(
        npxLine(x + 1) - (addExtraPaddingLeft ? 0 : 0.5),
        npxLine(y + 1) - (addExtraPaddingTop ? 0 : 0.5),
        npx(width - 2) + 0 + (addExtraPaddingLeft ? 0 : 1),
        npx(height - 2) + 0 + (addExtraPaddingTop ? 0 : 1)
    );
    ctx.clip();
    ctx.fill();
    dtextcb();
    ctx.restore();
  }
}

export default {};
export {
  Draw,
  DrawBox,
  thinLineWidth,
  npx,
  revNpx,
};
