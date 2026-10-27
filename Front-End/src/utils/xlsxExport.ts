/**
 * 零依赖 XLSX 导出工具
 *
 * 为避免改动 package.json（不新增/升级任何依赖），这里手写最小可用的 .xlsx：
 * - 采用「存储式（不压缩）ZIP」打包 OOXML（SpreadsheetML）
 * - 单元格统一使用 inlineStr 内联字符串，省去 sharedStrings 表
 * - 支持按单元格组合样式（字体颜色/加粗、填充底色、边框、数字格式、对齐、自动换行）
 * - 支持冻结首行、明细区自动筛选
 * Excel / WPS 均可直接打开；适用于中小规模报表导出。
 */

/** 导出列定义 */
export interface XlsxColumn {
  /** 表头文字 */
  title: string;
  /** 列宽（字符数），缺省按表头长度自适应 */
  width?: number;
}

/** 单元格取值：number 写数字单元格；其余转字符串；null/undefined/'' 写空白单元格 */
export type XlsxCellValue = string | number | null | undefined;

/** 边框线型 */
export type XlsxBorderStyle = 'thin' | 'medium' | 'thick' | 'double';

/**
 * 单元格样式：同一份导出内会自动去重（相同组合只生成一份 xf），
 * 因此可以放心按单元格逐一指定，不会把 styles.xml 撑大。
 */
export interface XlsxCellStyle {
  bold?: boolean;
  italic?: boolean;
  /** 字体颜色（RRGGBB，不含 #） */
  color?: string;
  /** 填充底色（RRGGBB，不含 #） */
  backgroundColor?: string;
  /** 数字格式代码，如 '0.00'、'0.00"%"'、'#,##0.00' */
  numberFormat?: string;
  align?: 'left' | 'center' | 'right';
  wrapText?: boolean;
  /** 四周边框 */
  border?: XlsxBorderStyle;
  /** 顶部边框（覆盖 border 的 top） */
  topBorder?: XlsxBorderStyle;
  /** 底部边框（覆盖 border 的 bottom） */
  bottomBorder?: XlsxBorderStyle;
  /** 边框颜色（RRGGBB，不含 #） */
  borderColor?: string;
}

/** 带样式的单元格 */
export interface XlsxCell {
  value: XlsxCellValue;
  style?: XlsxCellStyle;
}

/** 数据行：可用「纯值数组」，也可用对象形式指定整行样式与行高 */
export type XlsxRow =
  | (XlsxCellValue | XlsxCell)[]
  | { cells: (XlsxCellValue | XlsxCell)[]; style?: XlsxCellStyle; height?: number };

/** 导出选项 */
export interface XlsxDownloadOptions {
  /** 表头样式（默认浅蓝底 + 加粗 + 居中） */
  headerStyle?: XlsxCellStyle;
  /** 表头行高（默认 30） */
  headerHeight?: number;
  /** 数据行默认行高（行对象未指定 height 时生效） */
  rowHeight?: number;
  /** 是否冻结首行（默认 false） */
  freezeHeader?: boolean;
  /** 自动筛选覆盖的数据行数（不含表头；若存在底部汇总行，只传明细行数即可把汇总行排除在筛选外） */
  autoFilterRowCount?: number;
}

const encoder = new TextEncoder();

/** XML 文本转义 */
const escapeXml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** 0 基列号 -> Excel 列名（0 -> A，25 -> Z，26 -> AA） */
const columnName = (index: number): string => {
  let name = '';
  let n = index;
  while (n >= 0) {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  }
  return name;
};

// ---------------- 最小 ZIP（存储式，无压缩） ----------------

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const concatBytes = (chunks: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  chunks.forEach(chunk => {
    result.set(chunk, offset);
    offset += chunk.length;
  });
  return result;
};

const u16 = (value: number): Uint8Array => new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);

const u32 = (value: number): Uint8Array =>
  new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const buildZip = (entries: ZipEntry[]): Uint8Array<ArrayBuffer> => {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  entries.forEach(({ name, data }) => {
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const size = data.length;

    const local = concatBytes([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0),
      nameBytes, data,
    ]);
    localParts.push(local);

    centralParts.push(concatBytes([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), nameBytes,
    ]));

    offset += local.length;
  });

  const central = concatBytes(centralParts);
  const endOfCentralDirectory = concatBytes([
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(central.length), u32(offset), u16(0),
  ]);

  return concatBytes([...localParts, central, endOfCentralDirectory]);
};

// ---------------- 样式注册表 ----------------

/** 边框单边 XML：style 缺省为空边框 */
const borderSideXml = (tag: 'left' | 'right' | 'top' | 'bottom', style: XlsxBorderStyle | undefined, color: string): string =>
  style ? `<${tag} style="${style}"><color rgb="FF${color}"/></${tag}>` : `<${tag}/>`;

/**
 * 样式注册表：扫描所有单元格后按「字体/填充/边框/数字格式/对齐」组合去重，
 * 再统一生成 styles.xml，避免为每种组合手写索引。
 */
class StyleRegistry {
  private readonly fonts: string[] = ['<font><sz val="11"/><name val="Calibri"/></font>'];
  private readonly fills: string[] = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
  ];
  private readonly borders: string[] = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  private readonly numFmts: { id: number; code: string }[] = [];
  private readonly xfs: string[] = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  private readonly fontIds = new Map<string, number>([['', 0]]);
  private readonly fillIds = new Map<string, number>([['', 0]]);
  private readonly borderIds = new Map<string, number>([['', 0]]);
  private readonly numFmtIds = new Map<string, number>();
  private readonly xfIds = new Map<string, number>([['', 0]]);
  private nextNumFmtId = 164;

  /** 解析单元格样式，返回 cellXfs 下标 */
  resolve(style: XlsxCellStyle | undefined, value: XlsxCellValue): number {
    const s = style ?? {};
    const bold = s.bold ? '1' : '0';
    const italic = s.italic ? '1' : '0';
    const color = s.color ?? '';
    const fillColor = s.backgroundColor ?? '';
    const borderKey = [
      s.border ?? '',
      s.topBorder ?? '',
      s.bottomBorder ?? '',
      s.borderColor ?? '',
    ].join('|');
    const align = s.align ?? (typeof value === 'number' ? 'right' : 'left');
    const wrap = s.wrapText ? '1' : '0';
    const numFmtId = this.resolveNumFmt(s.numberFormat);
    const xfKey = [bold, italic, color, fillColor, borderKey, numFmtId, align, wrap].join('|');

    const cached = this.xfIds.get(xfKey);
    if (cached !== undefined) return cached;

    const fontKey = [bold, italic, color].join('|');
    let fontId = this.fontIds.get(fontKey);
    if (fontId === undefined) {
      fontId = this.fonts.length;
      this.fonts.push(
        `<font>${s.bold ? '<b/>' : ''}${s.italic ? '<i/>' : ''}`
          + `${color ? `<color rgb="FF${color}"/>` : ''}<sz val="11"/><name val="Calibri"/></font>`,
      );
      this.fontIds.set(fontKey, fontId);
    }

    let fillId = this.fillIds.get(fillColor);
    if (fillId === undefined) {
      fillId = this.fills.length;
      this.fills.push(
        `<fill><patternFill patternType="solid"><fgColor rgb="FF${fillColor}"/><bgColor indexed="64"/></patternFill></fill>`,
      );
      this.fillIds.set(fillColor, fillId);
    }

    let borderId = this.borderIds.get(borderKey);
    if (borderId === undefined) {
      borderId = this.borders.length;
      const borderColor = s.borderColor ?? 'D9D9D9';
      this.borders.push(
        '<border>'
          + borderSideXml('left', s.border, borderColor)
          + borderSideXml('right', s.border, borderColor)
          + borderSideXml('top', s.topBorder ?? s.border, borderColor)
          + borderSideXml('bottom', s.bottomBorder ?? s.border, borderColor)
          + '<diagonal/></border>',
      );
      this.borderIds.set(borderKey, borderId);
    }

    const xf = `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"`
      + `${numFmtId ? ' applyNumberFormat="1"' : ''} applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">`
      + `<alignment horizontal="${align}" vertical="middle"${s.wrapText ? ' wrapText="1"' : ''}/></xf>`;
    const index = this.xfs.length;
    this.xfs.push(xf);
    this.xfIds.set(xfKey, index);
    return index;
  }

  /** 自定义数字格式（缺省 General=0）；相同格式代码复用同一 id */
  private resolveNumFmt(format: string | undefined): number {
    if (!format) return 0;
    const cached = this.numFmtIds.get(format);
    if (cached !== undefined) return cached;
    const id = this.nextNumFmtId;
    this.nextNumFmtId += 1;
    this.numFmts.push({ id, code: format });
    this.numFmtIds.set(format, id);
    return id;
  }

  toXml(): string {
    const numFmtXml = this.numFmts.length
      ? `<numFmts count="${this.numFmts.length}">${this.numFmts
        .map(({ id, code }) => `<numFmt numFmtId="${id}" formatCode="${escapeXml(code)}"/>`)
        .join('')}</numFmts>`
      : '';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
      + numFmtXml
      + `<fonts count="${this.fonts.length}">${this.fonts.join('')}</fonts>`
      + `<fills count="${this.fills.length}">${this.fills.join('')}</fills>`
      + `<borders count="${this.borders.length}">${this.borders.join('')}</borders>`
      + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
      + `<cellXfs count="${this.xfs.length}">${this.xfs.join('')}</cellXfs>`
      + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
      + '</styleSheet>';
  }
}

// ---------------- OOXML 各部件 ----------------

const CONTENT_TYPES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
  + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
  + '<Default Extension="xml" ContentType="application/xml"/>'
  + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
  + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
  + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
  + '</Types>';

const ROOT_RELS_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
  + '</Relationships>';

const WORKBOOK_RELS_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
  + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
  + '</Relationships>';

/** 工作表名合法化：去除 []:*?/\ 并限制 31 个字符 */
const sanitizeSheetName = (name: string): string => {
  const cleaned = name.replace(/[[\]:*?/\\]/g, '').slice(0, 31);
  return cleaned || 'Sheet1';
};

const buildWorkbookXml = (sheetName: string): string =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
  + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
  + `<sheets><sheet name="${escapeXml(sanitizeSheetName(sheetName))}" sheetId="1" r:id="rId1"/></sheets>`
  + '</workbook>';

/** 纯值单元格 / 带样式单元格统一为对象 */
const normalizeCell = (cell: XlsxCellValue | XlsxCell): XlsxCell => {
  if (cell != null && typeof cell === 'object' && 'value' in cell) return cell;
  return { value: cell as XlsxCellValue };
};

/** 数据行统一为对象形式 */
const normalizeRow = (row: XlsxRow): { cells: (XlsxCellValue | XlsxCell)[]; style?: XlsxCellStyle; height?: number } =>
  Array.isArray(row) ? { cells: row } : row;

const buildWorksheetXml = (
  columns: XlsxColumn[],
  rows: XlsxRow[],
  options: XlsxDownloadOptions,
): { sheetXml: string; stylesXml: string } => {
  const registry = new StyleRegistry();
  const colon = columns.length;
  const lastColumn = columnName(Math.max(0, colon - 1));

  const headerStyle: XlsxCellStyle = options.headerStyle ?? {
    bold: true,
    backgroundColor: 'DDEBF7',
    align: 'center',
  };
  const headerXf = registry.resolve(headerStyle, '');
  const headerHeight = options.headerHeight ?? 30;

  const headerRow = `<row r="1" ht="${headerHeight}" customHeight="1">${columns
    .map((col, i) => `<c r="${columnName(i)}1" t="inlineStr" s="${headerXf}"><is><t xml:space="preserve">${escapeXml(col.title)}</t></is></c>`)
    .join('')}</row>`;

  const bodyRows = rows
    .map((input, rowIndex) => {
      const { cells, style: rowStyle, height } = normalizeRow(input);
      const excelRow = rowIndex + 2;
      const cellsXml = cells
        .map((raw, colIndex) => {
          const { value, style: cellStyle } = normalizeCell(raw);
          const mergedStyle = rowStyle || cellStyle ? { ...rowStyle, ...cellStyle } : undefined;
          const styleIndex = registry.resolve(mergedStyle, value);
          const ref = `${columnName(colIndex)}${excelRow}`;
          if (typeof value === 'number' && Number.isFinite(value)) {
            return `<c r="${ref}" s="${styleIndex}"><v>${value}</v></c>`;
          }
          const text = value == null ? '' : String(value);
          if (text === '') {
            // 空白但带样式的单元格仍需输出，才能保住底色与边框（如汇总行连续的色带）
            return styleIndex ? `<c r="${ref}" s="${styleIndex}"/>` : '';
          }
          return `<c r="${ref}" s="${styleIndex}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
        })
        .join('');
      const rowHeight = height ?? options.rowHeight;
      return `<row r="${excelRow}"${rowHeight ? ` ht="${rowHeight}" customHeight="1"` : ''}>${cellsXml}</row>`;
    })
    .join('');

  const colsXml = columns.length
    ? `<cols>${columns
      .map((col, i) => {
        // 中文按 2 个字符宽估算；过长的表头交给自动换行，避免整张表横向过宽
        const width = col.width ?? Math.min(24, Math.max(11, col.title.length * 2 + 2));
        return `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`;
      })
      .join('')}</cols>`
    : '';

  const sheetViewsXml = options.freezeHeader
    ? '<sheetViews><sheetView tabSelected="1" workbookViewId="0">'
      + '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
      + '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>'
      + '</sheetView></sheetViews>'
    : '';

  const autoFilterRows = options.autoFilterRowCount ?? 0;
  const autoFilterXml = autoFilterRows > 0
    ? `<autoFilter ref="A1:${lastColumn}${autoFilterRows + 1}"/>`
    : '';

  const sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + `<dimension ref="A1:${lastColumn}${rows.length + 1}"/>`
    + sheetViewsXml
    + '<sheetFormatPr defaultRowHeight="15"/>'
    + colsXml
    + `<sheetData>${headerRow}${bodyRows}</sheetData>`
    + autoFilterXml
    + '</worksheet>';

  return { sheetXml, stylesXml: registry.toXml() };
};

/**
 * 生成 .xlsx 并触发浏览器下载
 * @param fileName 文件名（需含 .xlsx）
 * @param sheetName 工作表名
 * @param columns 列定义（表头 + 列宽）
 * @param rows 数据行，每行按列顺序取值（值或 { value, style }），也可用行对象指定整行样式/行高
 * @param options 表头样式、行高、冻结首行、自动筛选范围
 */
export const downloadXlsx = (
  fileName: string,
  sheetName: string,
  columns: XlsxColumn[],
  rows: XlsxRow[],
  options: XlsxDownloadOptions = {},
): void => {
  const { sheetXml, stylesXml } = buildWorksheetXml(columns, rows, options);

  const files: ZipEntry[] = [
    { name: '[Content_Types].xml', data: encoder.encode(CONTENT_TYPES_XML) },
    { name: '_rels/.rels', data: encoder.encode(ROOT_RELS_XML) },
    { name: 'xl/workbook.xml', data: encoder.encode(buildWorkbookXml(sheetName)) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(WORKBOOK_RELS_XML) },
    { name: 'xl/styles.xml', data: encoder.encode(stylesXml) },
    { name: 'xl/worksheets/sheet1.xml', data: encoder.encode(sheetXml) },
  ];

  const zip = buildZip(files);
  const blob = new Blob([zip], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
