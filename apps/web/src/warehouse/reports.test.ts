import { describe, expect, it } from 'vitest';
import { csvCell, rowsToCsv } from './reports';

describe('warehouse report CSV helpers', () => {
  it('escapes commas, quotes, and line breaks', () => {
    expect(csvCell('Bin 1, "A"')).toBe('"Bin 1, ""A"""');
    expect(csvCell('line 1\nline 2')).toBe('"line 1\nline 2"');
  });

  it('serializes headers and rows with a trailing newline', () => {
    expect(rowsToCsv(['Name', 'Quantity'], [['Bin 1', 12], ['Empty', null]])).toBe(
      'Name,Quantity\r\nBin 1,12\r\nEmpty,\r\n'
    );
  });
});
