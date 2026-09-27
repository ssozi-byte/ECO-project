export interface ParsedLine {
  lineNumber: number;
  date: string; // ISO date (day)
  service: string;
  resourceKey: string;
  resourceType?: string;
  region?: string;
  amount: number;
  currency: string;
  tags?: Record<string, string>;
}

export interface ParseResult {
  lines: ParsedLine[];
  quarantined: { lineNumber: number; error: string; raw: string }[];
}

/**
 * Expected CSV format (header row required):
 * date,service,resource_id,resource_type,region,amount,currency,tags
 * tags format: key=value;key2=value2
 */
export function parseBillingCsv(content: string): ParseResult {
  const text = content.replace(/^\uFEFF/, '');
  const rows = splitCsvRows(text);
  if (rows.length === 0) {
    return { lines: [], quarantined: [{ lineNumber: 0, error: 'Empty file', raw: '' }] };
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const required = ['date', 'service', 'resource_id', 'amount'];
  const missing = required.filter((r) => idx(r) === -1);
  if (missing.length > 0) {
    return {
      lines: [],
      quarantined: [
        { lineNumber: 1, error: `Missing columns: ${missing.join(', ')}`, raw: rows[0].join(',') },
      ],
    };
  }

  const iDate = idx('date');
  const iService = idx('service');
  const iResource = idx('resource_id');
  const iType = idx('resource_type');
  const iRegion = idx('region');
  const iAmount = idx('amount');
  const iCurrency = idx('currency');
  const iTags = idx('tags');

  const lines: ParsedLine[] = [];
  const quarantined: ParseResult['quarantined'] = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.length === 1 && cells[0].trim() === '') continue;
    const lineNumber = i + 1;
    try {
      const date = new Date(cells[iDate]);
      if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${cells[iDate]}`);
      const amount = Number(cells[iAmount]);
      if (!Number.isFinite(amount)) throw new Error(`Invalid amount: ${cells[iAmount]}`);
      const tags: Record<string, string> | undefined = iTags >= 0 && cells[iTags]
        ? Object.fromEntries(
            cells[iTags]
              .split(';')
              .filter(Boolean)
              .map((pair) => {
                const [k, ...rest] = pair.split('=');
                return [k.trim(), rest.join('=').trim()];
              })
          )
        : undefined;

      lines.push({
        lineNumber,
        date: date.toISOString().slice(0, 10),
        service: cells[iService]?.trim() || 'unknown',
        resourceKey: cells[iResource]?.trim() || `line-${lineNumber}`,
        resourceType: iType >= 0 ? cells[iType]?.trim() || undefined : undefined,
        region: iRegion >= 0 ? cells[iRegion]?.trim() || undefined : undefined,
        amount,
        currency: (iCurrency >= 0 ? cells[iCurrency]?.trim() : '') || 'USD',
        tags,
      });
    } catch (err) {
      quarantined.push({
        lineNumber,
        error: (err as Error).message,
        raw: cells.join(','),
      });
    }
  }

  return { lines, quarantined };
}

/** Minimal CSV splitter honoring double-quoted fields. */
function splitCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}
