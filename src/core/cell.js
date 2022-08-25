import { expr2xy, xy2expr } from './alphabet';
import { numberCalc } from './helper';
import { formulam } from './formula';

// Converting infix expression to a suffix expression
// src: AVERAGE(SUM(A1,A2), B1) + 50 + B20
// return: [A1, A2], SUM[, B1],AVERAGE,50,+,B20,+
const infixExprToSuffixExpr = (src) => {
  const operatorStack = [];
  const stack = [];
  let subStrs = []; // SUM, A1, B2, 50 ...
  let fnArgType = 0; // 1 => , 2 => :
  let fnArgOperator = '';
  let fnArgsLens = [];
  let oldc = '';
  for (let i = 0; i < src.length; i += 1) {
    const c = src.charAt(i);
    if (c !== ' ') {
      if (c == '#' && src.substr(i, 4).toUpperCase() == '#REF') {
        stack.push('"#REF');
        i += 3;
      } else if (c >= 'a' && c <= 'z') {
        subStrs.push(c.toUpperCase());
      } else if ((c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z') || c === '.' || c == '$') {
        subStrs.push(c);
      } else if (c === '"') {
        i += 1;
        while (src.charAt(i) !== '"' && i < src.length) {
          subStrs.push(src.charAt(i));
          i += 1;
        }
        stack.push(`"${subStrs.join('')}`);
        subStrs = [];
      } else if (c === '-' && /[+\-*/,(]/.test(oldc)) {
        subStrs.push(c);
      } else {
        // console.log('subStrs:', subStrs.join(''), stack);
        if (c !== '(' && subStrs.length > 0) {
          stack.push(subStrs.join(''));
        }
        if (c === ')') {
          let c1 = operatorStack.pop();
          if (fnArgType === 2) {
            // fn argument range => A1:B5
            try {
              let [ex, ey] = expr2xy(stack.pop());
              let [sx, sy] = expr2xy(stack.pop());
              if (ex < sx) {
                [sx, ex] = [ex, sx];
              }
              if (ey < sy) {
                [sy, ey] = [ey, sy];
              }
              // console.log('::', sx, sy, ex, ey);
              let rangelen = 0;
              for (let x = sx; x <= ex; x += 1) {
                for (let y = sy; y <= ey; y += 1) {
                  stack.push(xy2expr(x, y));
                  rangelen += 1;
                }
              }
              stack.push([c1, rangelen]);
            } catch (e) {
              // console.log(e);
            }
          } else if (fnArgType === 1 || fnArgType === 3) {
            if (fnArgType === 3) stack.push(fnArgOperator);
            // fn argument => A1,A2,B5
            stack.push([c1, fnArgsLens[fnArgsLens.length - 1]]);
            fnArgsLens.splice(fnArgsLens.length - 1, 1);
          } else {
            // console.log('c1:', c1, fnArgType, stack, operatorStack);
            while (c1 !== '(') {
              if (isFormulaName(c1)) {
                stack.push([c1,fnArgsLens[fnArgsLens.length - 1]]);
                fnArgsLens.splice(fnArgsLens.length - 1, 1);
              }
              else {
                stack.push(c1);
              }
              if (operatorStack.length <= 0) break;
              c1 = operatorStack.pop();
            }
          }
          fnArgType = 0;
        } else if (c === '=' || c === '>' || c === '<') {
          const nc = src.charAt(i + 1);
          fnArgOperator = c;
          if (nc === '=' || nc === '-') {
            fnArgOperator += nc;
            i += 1;
          }
          fnArgType = 3;
        } else if (c === ':') {
          fnArgType = 2;
        } else if (c === ',') {
          if (fnArgType === 3) {
            stack.push(fnArgOperator);
          }
          fnArgType = 1;
          if (fnArgsLens.length === 0) {
            fnArgsLens.push(1);
          }
          fnArgsLens[fnArgsLens.length - 1] += 1;
        } else if (c === '(') {
          if (subStrs.length > 0) {
            // function
            operatorStack.push(subStrs.join(''));
            if (isFormulaName(subStrs.join(''))) {
              fnArgsLens.push(1);
            }
          }
          else {
            const startIdx = i + 1;
            const endIdx = getClosingBracketIndex(src, startIdx);
            if (endIdx >= 0) {
              const inner = infixExprToSuffixExpr(src.substring(startIdx, endIdx));
              i = endIdx;
              stack.push(...inner);
            }
          }
        } else {
          // priority: */ > +-
          // console.log('xxxx:', operatorStack, c, stack);
          if (operatorStack.length > 0 && (c === '+' || c === '-')) {
            let top = operatorStack[operatorStack.length - 1];
            if (top !== '(') stack.push(operatorStack.pop());
            if (top === '*' || top === '/') {
              while (operatorStack.length > 0) {
                top = operatorStack[operatorStack.length - 1];
                if (top !== '(') stack.push(operatorStack.pop());
                else break;
              }
            }
          } else if (operatorStack.length > 0) {
            const top = operatorStack[operatorStack.length - 1];
            if (top === '*' || top === '/') stack.push(operatorStack.pop());
          }
          operatorStack.push(c);
        }
        subStrs = [];
      }
      oldc = c;
    }
  }
  if (subStrs.length > 0) {
    stack.push(subStrs.join(''));
  }
  while (operatorStack.length > 0) {
    stack.push(operatorStack.pop());
  }
  return stack;
};

const isFormulaName = text => {
  if (typeof(text) !== 'string') {
    return false;
  }
  return text in formulam;
};

const getClosingBracketIndex = (str, startIdx) => {
  let depth = 1;
  for (let i = startIdx; i < str.length; ++i) {
    const c = str[i];
    if (c === ')') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
    else if (c === '(') {
      depth++;
    }
  }
  return -1;
};

const evalSubExpr = (subExpr, cellRender) => {
  const [fl] = subExpr;
  let expr = subExpr;
  if (fl === '"') {
    return subExpr.substring(1);
  }
  let ret = 1;
  if (fl === '-') {
    expr = subExpr.substring(1);
    ret = -1;
  }
  if (expr[0] >= '0' && expr[0] <= '9') {
    return ret * Number(expr);
  }
  const [x, y] = expr2xy(expr);
  const cellValue = cellRender(x, y);
  if (ret === 1 && typeof(cellValue) === 'string'){ 
    return cellValue === '' ? 0 : cellValue;
  }
  return ret * cellValue;
};

// evaluate the suffix expression
// srcStack: <= infixExprToSufixExpr
// formulaMap: {'SUM': {}, ...}
// cellRender: (x, y) => {}
const evalSuffixExpr = (spreadsheet, srcStack, formulaMap, cellRender, cellList) => {
  for (const cell of cellList) {
    if (srcStack.includes(cell)) {
      return '#ERR';
    }
  }
  const stack = [];
  // console.log(':::::formulaMap:', formulaMap);
  for (let i = 0; i < srcStack.length; i += 1) {
    // console.log(':::>>>', srcStack[i]);
    const expr = srcStack[i];
    const fc = expr[0];
    if (expr === '+') {
      const top = stack.pop();
      stack.push(numberCalc('+', stack.pop(), top));
    } else if (expr === '-') {
      if (stack.length === 1) {
        const top = stack.pop();
        stack.push(numberCalc('*', top, -1));
      } else {
        const top = stack.pop();
        stack.push(numberCalc('-', stack.pop(), top));
      }
    } else if (expr === '*') {
      stack.push(numberCalc('*', stack.pop(), stack.pop()));
    } else if (expr === '/') {
      const top = stack.pop();
      stack.push(numberCalc('/', stack.pop(), top));
    } else if (fc === '=' || fc === '>' || fc === '<') {
      let top = stack.pop();
      if (!Number.isNaN(top)) top = Number(top);
      let left = stack.pop();
      if (!Number.isNaN(left)) left = Number(left);
      let ret = false;
      if (fc === '=') {
        ret = (left === top);
      } else if (expr === '>') {
        ret = (left > top);
      } else if (expr === '>=') {
        ret = (left >= top);
      } else if (expr === '<') {
        ret = (left < top);
      } else if (expr === '<=') {
        ret = (left <= top);
      }
      stack.push(ret);
    } else if (Array.isArray(expr)) {
      const [formula, len] = expr;
      const params = [];
      for (let j = 0; j < len; j += 1) {
        params.push(stack.pop());
      }
      try {
        stack.push(formulaMap[formula].render.call(spreadsheet, params.reverse()));
      }
      catch {
        return '#ERR';
      }
    } else {
      if (cellList.includes(expr)) {
        return '#ERR';
      }
      if ((fc >= 'a' && fc <= 'z') || (fc >= 'A' && fc <= 'Z')) {
        cellList.push(expr);
      }
      stack.push(evalSubExpr(expr, cellRender));
      cellList.pop();
    }
    // console.log('stack:', stack);
  }
  if (typeof(stack[0]) === 'number' && isNaN(stack[0])) {
    return '#ERR';
  }
  if (typeof(stack[0]) === 'string' && (stack[0].includes('#ERR') || stack[0].includes('NaN'))) {
    return '#ERR';
  }
  return `${stack[0]}`;
};

function isFormulaSyntaxValid(str) {
  const stack = [];
  for (let i = 0; i < str.length; ++i) {
    const c = str[i];
    if (c === '(') {
      stack.push('(');
    }
    else if (c === ')') {
      if (stack.pop() !== '(') {
        return false;
      }
    }
  }
  return stack.length === 0;
}

const cellRender = (spreadsheet, src, formulaMap, getCellText, cellList = []) => {
  if (src[0] === '=') {
    if (!isFormulaSyntaxValid(src)) {
      return '#ERR';
    }
    const stack = infixExprToSuffixExpr(src.substring(1));
    if (stack.length <= 0) return src;
    return evalSuffixExpr(
      spreadsheet,
      stack,
      formulaMap,
      (x, y) => cellRender(spreadsheet, getCellText(x, y), formulaMap, getCellText, cellList),
      cellList,
    );
  }
  return src;
};

export default {
  render: cellRender,
};
export {
  infixExprToSuffixExpr,
};
