declare module 'x-data-spreadsheet' {
  export interface ExtendToolbarOption {
    tip?: string;
    el?: HTMLElement;
    icon?: string;
    onClick?: (data: object, sheet: object) => void
  }
  
  export interface CellSelectionRange {
    sci: number;
    eci: number;
    sri: number;
    eri: number;
  }
  export interface Options {
    mode?: 'edit' | 'read';
    showToolbar?: boolean;
    showGrid?: boolean;
    showContextmenu?: boolean;
    showContextMenuForCells?: boolean;
    showBottomBar?: boolean;
    suggestFormulas?: boolean;
    extendToolbar?: {
      left?: ExtendToolbarOption[],
      right?: ExtendToolbarOption[],
    };
    autoFocus?: boolean;
    view?: {
      height: () => number;
      width: () => number;
    };
    row?: {
      len: number;
      height: number;
    };
    col?: {
      len: number;
      width: number;
      indexWidth: number;
      minWidth: number;
    };
    style?: {
      bgcolor: string;
      align: 'left' | 'center' | 'right';
      valign: 'top' | 'middle' | 'bottom';
      textwrap: boolean;
      strike: boolean;
      underline: boolean;
      color: string;
      font: {
        name: 'Helvetica';
        size: number;
        bold: boolean;
        italic: false;
      };
    };
    cellHeaderStyle?: {
      bgcolor: string;
      selectedBgcolor: string;
      cornerBgcolor: string;
      fontFamily: string;
    };
    toolbar?: {
      misc: {
        undo: boolean;
        redo: boolean;
        print: boolean;
        paintFormat: boolean;
        clearFormat: boolean;
      };
      format: {
        format: boolean;
      };
      font: {
        family: boolean;
        size: boolean;
      };
      textStyle: {
        bold: boolean;
        italic: boolean;
        underline: boolean;
        strike: boolean;
        color: boolean;
      };
      cell: {
        fill: boolean;
        borders: boolean;
        merge: boolean;
      };
      cellText: {
        horizontalAlignment: boolean;
        verticalAlignment: boolean;
        wrap: boolean;
      };
      tools: {
        freezeCell: boolean;
        filter: boolean;
        formulas: boolean;
      };
      itemsCallback: (items: any|any[]) => void;
    };
    formulaBar?: {
      location: 'belowToolbar' | 'nextToToolbar',
    };
    contextMenu?: {
      itemsCallback: (items: Array<{ key: string }>) => void;
      extraItems: Array<{ key: string, title: () => string, callback: (range: CellSelectionRange) => void, isVisibleCallback: (range: CellSelectionRange) => boolean }>;
      preShowCallback: (elementsContainer: HTMLElement, targetRange: { sci: number, eci: number, sri: number, eri: number }) => void;
    };
    clipboard?: {
      setText?: (text: string, event?: ClipboardEvent) => void;
      getText?: (event?: ClipboardEvent) => string | Promise<string>;
    };
    cellCustomFormatterCreator?: (cellStyle: CellStyle) => void;
  }

  export type CELL_SELECTED = 'cell-selected';
  export type CELLS_SELECTED = 'cells-selected';
  export type CELL_EDITED = 'cell-edited';
  export type UNDO_PERFORMED = 'undo-performed';
  export type REDO_PERFORMED = 'redo-performed';

  export type CellMerge = [number, number];

  export interface SpreadsheetEventHandler {
    (
      envt: CELL_SELECTED,
      callback: (cell: Cell, rowIndex: number, colIndex: number) => void
    ): void;
    (
      envt: CELLS_SELECTED,
      callback: (
        cell: Cell,
        parameters: { sri: number; sci: number; eri: number; eci: number }
      ) => void
    ): void;
    (
      evnt: CELL_EDITED,
      callback: (text: string, rowIndex: number, colIndex: number) => void
    ): void;
    (
      evnt: UNDO_PERFORMED,
      callback: () => void
    ): void;
    (
      evnt: REDO_PERFORMED,
      callback: () => void
    ): void;
  }

  export interface ColProperties {
    width?: number;
  }

  /**
   * Data for representing a cell
   */
  export interface CellData {
    text: string;
    style?: number;
    merge?: CellMerge;
  }
  /**
   * Data for representing a row
   */
  export interface RowData {
    cells: {
      [key: number]: CellData;
    }
  }

  /**
   * Data for representing a sheet
   */
  export interface SheetData {
    name?: string;
    freeze?: string;
    styles?: CellStyle[];
    merges?: string[];
    cols?: {
      len?: number;
      [key: number]: ColProperties;
    };
    rows?: {
      [key: number]: RowData
    };
  }

  /**
   * Data for representing a spreadsheet
   */
  export interface SpreadsheetData {
    [index: number]: SheetData;
  }

  export interface CustomFormatter {
    prepareCellStyle: (cellText: string, cellStyle: CellStyle) => void,
    formatCellText: (cellText: string) => string,
    param: any,
  }
  
  export interface CellStyle {
    align?: 'left' | 'center' | 'right';
    valign?: 'top' | 'middle' | 'bottom';
    font?: {
      bold?: boolean;
    }
    bgcolor?: string;
    textwrap?: boolean;
    color?: string;
    border?: {
      top?: string[];
      right?: string[];
      bottom?: string[];
      left?: string[];
    };
    customFormatter?: CustomFormatter;
  }
  export interface Editor {}
  export interface Element {}

  export interface Row {}
  export interface Table {}
  export interface Cell {}
  export interface Sheet {}

  export default class Spreadsheet {
    constructor(container: string | HTMLElement, opts?: Options);
    on: SpreadsheetEventHandler;
    /**
     * retrieve cell
     * @param rowIndex {number} row index
     * @param colIndex {number} column index
     * @param sheetIndex {number} sheet iindex
     */
    cell(rowIndex: number, colIndex: number, sheetIndex: number): Cell;
    /**
     * retrieve cell style
     * @param rowIndex
     * @param colIndex
     * @param sheetIndex
     */
    cellStyle(
      rowIndex: number,
      colIndex: number,
      sheetIndex: number
    ): CellStyle;
    /**
     * set selected cell custom formatter
     * @param formatter
     */
    setSelectedCellCustomFormatter(
       formatter: CustomFormatter
    );
    /**
     * clear selected cell custom formatter
     */
    clearSelectedCellCustomFormatter();
    /**
     * get/set cell text
     * @param rowIndex
     * @param colIndex
     * @param text
     * @param sheetIndex
     */
    cellText(
      rowIndex: number,
      colIndex: number,
      text: string,
      sheetIndex?: number
    ): this;
    /**
     * remove current sheet
     */
    deleteSheet(): void;

    /**s
     * load data
     * @param json
     */
    loadData(json: Record<string, any>): this;
    /**
     * get data
     */
    getData(): Record<string, any>;
    /**
     * bind handler to change event, including data change and user actions
     * @param callback
     */
    change(callback: (json: Record<string, any>) => void): this;
    /**
     * reRender
     */
    reRender(): this;
    /**
     * get selected range
     * @param sheetIndex
     */
    getSelectedRange(sheetIndex?: number): { col0: number, col1: number, row0: number, row1: number };
    /**
     * set selected range
     * @param sheetIndex
     */
    setSelectedRange(range: { col0: number, col1: number, row0: number, row1: number }, sheetIndex?: number): void;
    /**
     * clear custom clipboard
     * @param text
     */
    clearCustomClipboard(): void;
    /**
     * set locale
     * @param lang
     * @param message
     */
    static locale(lang: string, message: object): void;
    /**
     * add custom formula
     * @param key
     * @param title
     * @param render
     */
    static addCustomFormula(
      key: string,
      title: string,
      render: (arr: (number|string)[]) => number|string
    ): void;
    /**
     * add clickable element finder
     * @param finder
     * @param render
     * @param onCtrlClick
     */
    static addClickableElementFinder(
      finder: (text: string) => Array<{ start: number, length: number, extraPreSpaces: number, extraPostSpaces: number, data: string }>,
      render: (text: string, data: string) => string,
      onCtrlClick: (data: string) => void
    ): void;
    /**
     * add chooser
     * @param getHint
     * @param onTriggered
     */
    static addChooser(
      getHint: (text: string, selection: { start: number, end: number}) => { html: string, triggers: Array<{ keyCode: number, ctrlOrMeta?: boolean, shift?: boolean, alt?: boolean }> } | false,
      onTriggered: (text: string, selection: { start: number, end: number}) => Promise<{ text: string, cursorPosition: { start: number, end: number} } | false>,
    ): void;
  }
  global {
    interface Window {
      x_spreadsheet(container: string | HTMLElement, opts?: Options): Spreadsheet; 
    }
  }
}

