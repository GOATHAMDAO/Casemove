import JSZip from 'jszip';

type ReportRow = {
  itemName: string;
  total: number;
  storageTotal: number;
  profileTotals: number[];
  priceEmpireTotal?: number;
  priceEmpireDifference?: number;
  collection?: string;
  rowType?: 'item' | 'heading' | 'spacer';
};

function escapeXml(value: string | number) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(columnIndex: number) {
  let result = '';
  let value = columnIndex;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function stringCell(reference: string, value: string, style?: number) {
  const styleAttribute = style === undefined ? '' : ` s="${style}"`;
  return `<c r="${reference}" t="inlineStr"${styleAttribute}><is><t>${escapeXml(value)}</t></is></c>`;
}

function numberCell(reference: string, value: number, style?: number) {
  const styleAttribute = style === undefined ? '' : ` s="${style}"`;
  return `<c r="${reference}" t="n"${styleAttribute}><v>${value}</v></c>`;
}

function makeSheetXml(profileNames: string[], rows: ReportRow[]) {
  const headers = [
    'Item name',
    'Total',
    'PriceEmpire portfolios',
    'Add / Remove',
    '',
    'Storage units',
    ...profileNames,
  ];
  const lastColumn = columnName(headers.length);
  const sheetRows = [
    `<row r="1">${headers.map((header, index) => stringCell(`${columnName(index + 1)}1`, header, 1)).join('')}</row>`,
    ...rows.map((row, rowIndex) => {
      const sheetRow = rowIndex + 2;
      if (row.rowType === 'spacer') return `<row r="${sheetRow}"/>`;
      if (row.rowType === 'heading') {
        return `<row r="${sheetRow}">${stringCell(`A${sheetRow}`, row.itemName, 2)}</row>`;
      }
      const quantities = [row.total, row.priceEmpireTotal, row.priceEmpireDifference, undefined, row.storageTotal, ...row.profileTotals];
      return `<row r="${sheetRow}">${stringCell(`A${sheetRow}`, row.itemName)}${quantities.map((quantity, index) => quantity === undefined ? '' : numberCell(`${columnName(index + 2)}${sheetRow}`, quantity, index === 2 ? 3 : undefined)).join('')}</row>`;
    }),
  ];

  const columns = headers.map((header, index) => {
    const width = index === 0 ? 44 : header ? Math.max(14, Math.min(28, header.length + 4)) : 3;
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>
  <cols>${columns}</cols>
  <sheetData>${sheetRows.join('')}</sheetData>
  <autoFilter ref="A1:${lastColumn}${Math.max(1, rows.length + 1)}"/>
</worksheet>`;
}

/** Creates a native .xlsx workbook without relying on an external Office installation. */
export async function createSavedProfileReportWorkbook(profileNames: string[], rows: ReportRow[]) {
  const zip = new JSZip();
  const createdAt = new Date().toISOString();

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Inventory report" sheetId="1" r:id="rId1"/></sheets>
</workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
  zip.file('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <numFmts count="1"><numFmt numFmtId="164" formatCode="+0;-0;0"/></numFmts>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
</styleSheet>`);
  zip.file('xl/worksheets/sheet1.xml', makeSheetXml(profileNames, rows));
  zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>Casemove</dc:creator><dc:title>Saved profiles inventory report</dc:title><dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created>
</cp:coreProperties>`);
  zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Casemove</Application></Properties>`);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export type { ReportRow };
