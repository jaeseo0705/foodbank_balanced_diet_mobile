import type { OcrLine } from './ocr.types';
import type { NutritionBasis, NutritionLabelResult, NutritionValue } from './nutrition.types';

export function describeNutritionBasis(basis: NutritionBasis): string {
  if (basis.printedText?.trim()) return basis.printedText.replace(/\s+/g, ' ').trim();
  const amount = basis.quantity && basis.unit ? `${basis.quantity} ${basis.unit}` : '';
  switch (basis.type) {
    case 'total_package': return '총 내용량당';
    case 'per_quantity': return amount ? `${amount}당` : '확인 필요';
    case 'per_serving': return `1회 제공량${amount ? `(${amount})` : ''}당`;
    case 'per_unit': return basis.countUnit && basis.count ? `${basis.count}${basis.countUnit}${amount ? `(${amount})` : ''}당` : '확인 필요';
    case 'per_daily_intake': return '1일 섭취량당';
    default: return '확인 필요';
  }
}

const compact = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[\s·ㆍ:|]/g, '');

export function orderNutritionValues(result: NutritionLabelResult, lines: OcrLine[]): NutritionValue[] {
  // Retain internal core/additional classification; presentation follows the photograph.
  const rows = [...lines].sort((a, b) => {
    const delta = a.bounds.y - b.bounds.y;
    return Math.abs(delta) < Math.min(a.bounds.height, b.bounds.height) * 0.5
      ? a.bounds.x - b.bounds.x : delta;
  });
  const all = [...result.required, ...result.additional];
  const position = (item: NutritionValue) => {
    const names = [item.printedName, item.name].filter((s): s is string => !!s && !s.includes('이름 없음')).map(compact);
    for (let index = 0; index < rows.length; index++) {
      const text = compact(rows[index].text);
      const offsets = names.map(name => {
        let offset = text.indexOf(name);
        while (offset > 0 && /[가-힣a-z]/.test(text[offset - 1])) offset = text.indexOf(name, offset + 1);
        return offset;
      }).filter(offset => offset >= 0);
      if (offsets.length) return index + Math.min(...offsets) / Math.max(1, text.length);
      if (item.code === 'A001' && item.printedValue && text.includes(compact(item.printedValue))) return index;
    }
    return Number.POSITIVE_INFINITY;
  };
  return all.map((item, index) => ({ item, index, position: position(item) }))
    .sort((a, b) => a.position - b.position || a.index - b.index).map(({ item }) => item);
}
