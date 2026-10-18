/**
 * 零依赖 XLSX 导出工具
 *
 * 为避免改动 package.json（不新增/升级任何依赖），这里手写最小可用的 .xlsx：
 * - 采用「存储式（不压缩）ZIP」打包 OOXML（SpreadsheetML）
 * - 单元格统一使用 inlineStr 内联字符串，省去 sharedStrings 表
 * - 表头使用加粗样式（styles.xml）
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

/** 两种单元格格式：0=默认，1=表头加粗 */
const STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + '<fonts count="2">'
  + '<font><sz val="11"/><name val="Calibri"/></font>'
  + '<font><b/><sz val="11"/><name val="Calibri"/></font>'
  + '</fonts>'
  + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="2">'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
  + '</cellXfs>'
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
  + '</styleSheet>';

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

const buildWorksheetXml = (columns: XlsxColumn[], rows: XlsxCellValue[][]): string => {
  const colsXml = columns.length
    ? `<cols>${columns
      .map((col, i) => {
        const width = col.width ?? Math.max(10, col.title.length * 2 + 2);
        return `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`;
      })
      .join('')}</cols>`
    : '';

  const headerRow = `<row r="1">${columns
    .map((col, i) => `<c r="${columnName(i)}1" t="inlineStr" s="1"><is><t xml:space="preserve">${escapeXml(col.title)}</t></is></c>`)
    .join('')}</row>`;

  const bodyRows = rows
    .map((row, rowIndex) => {
      const excelRow = rowIndex + 2;
      const cells = row
        .map((value, colIndex) => {
          const ref = `${columnName(colIndex)}${excelRow}`;
          if (typeof value === 'number' && Number.isFinite(value)) {
            return `<c r="${ref}"><v>${value}</v></c>`;
          }
          const text = value == null ? '' : String(value);
          if (text === '') return '';
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
        })
        .join('');
      return `<row r="${excelRow}">${cells}</row>`;
    })
    .join('');

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + colsXml
    + `<sheetData>${headerRow}${bodyRows}</sheetData>`
    + '</worksheet>';
};

/**
 * 生成 .xlsx 并触发浏览器下载
 * @param fileName 文件名（需含 .xlsx）
 * @param sheetName 工作表名
 * @param columns 列定义（表头 + 列宽）
 * @param rows 数据行，每行按列顺序取值
 */
export const downloadXlsx = (
  fileName: string,
  sheetName: string,
  columns: XlsxColumn[],
  rows: XlsxCellValue[][],
): void => {
  const files: ZipEntry[] = [
    { name: '[Content_Types].xml', data: encoder.encode(CONTENT_TYPES_XML) },
    { name: '_rels/.rels', data: encoder.encode(ROOT_RELS_XML) },
    { name: 'xl/workbook.xml', data: encoder.encode(buildWorkbookXml(sheetName)) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(WORKBOOK_RELS_XML) },
    { name: 'xl/styles.xml', data: encoder.encode(STYLES_XML) },
    { name: 'xl/worksheets/sheet1.xml', data: encoder.encode(buildWorksheetXml(columns, rows)) },
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
