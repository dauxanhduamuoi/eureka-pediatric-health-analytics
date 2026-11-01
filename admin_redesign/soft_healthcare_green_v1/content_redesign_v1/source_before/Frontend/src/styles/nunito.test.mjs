import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const stylesDirectory = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(stylesDirectory, 'nunito.css'), 'utf8');
const medicalText = 'Theo dõi sức khỏe trẻ em. Giải thích y khoa: bằng chứng còn hạn chế / gián tiếp; '
  + 'chưa được nhân viên y tế kiểm duyệt. Mối liên hệ thống kê không chứng minh quan hệ nhân quả. '
  + 'Nhiệt độ, độ ẩm, lượng mưa và nguồn tham khảo không thay thế chẩn đoán của bác sĩ.';

function fontTable(font, name) {
  for (let index = 0; index < font.readUInt16BE(4); index++) {
    const record = 12 + index * 16;
    if (font.toString('ascii', record, record + 4) === name) return font.readUInt32BE(record + 8);
  }
  throw new Error(`Missing TrueType table: ${name}`);
}

// Inspect the real font's Unicode-to-glyph map, not just its filename or CSS.
function hasGlyph(font, code) {
  const cmap = fontTable(font, 'cmap');
  for (let index = 0; index < font.readUInt16BE(cmap + 2); index++) {
    const record = cmap + 4 + index * 8;
    const platform = font.readUInt16BE(record);
    if (platform !== 0 && platform !== 3) continue;
    const table = cmap + font.readUInt32BE(record + 4);
    const format = font.readUInt16BE(table);
    if (format === 12) {
      for (let group = 0; group < font.readUInt32BE(table + 12); group++) {
        const offset = table + 16 + group * 12;
        const start = font.readUInt32BE(offset);
        if (code >= start && code <= font.readUInt32BE(offset + 4)
          && font.readUInt32BE(offset + 8) + code - start !== 0) return true;
      }
    } else if (format === 4 && code <= 0xffff) {
      const segments = font.readUInt16BE(table + 6) / 2;
      for (let segment = 0; segment < segments; segment++) {
        const end = font.readUInt16BE(table + 14 + segment * 2);
        const start = font.readUInt16BE(table + 16 + segments * 2 + segment * 2);
        if (code < start || code > end) continue;
        const delta = font.readInt16BE(table + 16 + segments * 4 + segment * 2);
        const rangeAddress = table + 16 + segments * 6 + segment * 2;
        const range = font.readUInt16BE(rangeAddress);
        const glyph = range === 0 ? code : font.readUInt16BE(rangeAddress + range + (code - start) * 2);
        if (glyph !== 0 && ((glyph + delta) & 0xffff) !== 0) return true;
      }
    }
  }
  return false;
}

describe('offline Nunito typography', () => {
  for (const filename of ['Nunito-Variable.ttf', 'Nunito-Italic-Variable.ttf']) {
    it(`${filename} covers Vietnamese text and weights 400–700`, () => {
      const font = readFileSync(resolve(stylesDirectory, '../../public/assets/fonts/nunito', filename));
      assert.equal(font.readUInt32BE(0), 0x00010000);
      const codePoints = new Set([
        ...Array.from({ length: 0x1ef9 - 0x1ea0 + 1 }, (_, index) => 0x1ea0 + index),
        ...Array.from((medicalText + 'ĂăÂâĐđÊêÔôƠơƯư').normalize('NFC'), (character) => character.codePointAt(0)),
        ...Array.from(medicalText.normalize('NFD'), (character) => character.codePointAt(0)),
      ]);
      assert.deepEqual([...codePoints].filter((code) => !hasGlyph(font, code)), []);

      const fvar = fontTable(font, 'fvar');
      const axesStart = fvar + font.readUInt16BE(fvar + 4);
      const axesCount = font.readUInt16BE(fvar + 8);
      const axisSize = font.readUInt16BE(fvar + 10);
      const axes = Array.from({ length: axesCount }, (_, index) => axesStart + index * axisSize);
      const weight = axes.find((axis) => font.toString('ascii', axis, axis + 4) === 'wght');
      assert.notEqual(weight, undefined);
      assert.ok(font.readInt32BE(weight + 4) / 65536 <= 400);
      assert.ok(font.readInt32BE(weight + 12) / 65536 >= 700);
    });
  }

  it('uses only local font URLs and preserves a one-import rollback', () => {
    const urls = [...css.matchAll(/url\('([^']+)'\)/g)].map((match) => match[1]);
    assert.deepEqual(urls, [
      '/assets/fonts/nunito/Nunito-Variable.ttf',
      '/assets/fonts/nunito/Nunito-Italic-Variable.ttf',
    ]);
    assert.ok(css.includes("font-family: 'Nunito', 'Segoe UI', Arial, sans-serif"));
    assert.doesNotMatch(css, /https?:\/\//);
    assert.doesNotMatch(css, /(?:font-size|line-height|padding|margin|color|width|height)\s*:/);
    assert.ok(readFileSync(resolve(stylesDirectory, 'index.css'), 'utf8').includes("@import './nunito.css';"));
    assert.ok(readFileSync(resolve(stylesDirectory, 'fonts.css'), 'utf8').includes("font-family: 'Segoe UI', Arial, sans-serif"));
    assert.ok(readFileSync(resolve(stylesDirectory, '../../public/assets/fonts/nunito/OFL.txt'), 'utf8').includes('SIL OPEN FONT LICENSE'));
  });
});
