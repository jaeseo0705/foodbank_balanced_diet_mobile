import { nutrientCatalog, makeManualNutrient } from './nutrientCatalog';
import type { NutritionLabelResult, NutritionValue } from './nutrition.types';

export type PublicFood = {
  source_key: string; record_key: string; name: string; category: string; manufacturer: string;
  basis: string; title: string; publisher: string; version: string;
  source_updated_date?: string | null;
  headers: { worksheet?: string; rows: Record<string, Record<string, string>> };
  raw_values: Record<string, string>;
};
export type PublicFoodCell = { column: string; label: string; value: string; nutrientName: string; unit?: string; qualifier?: string };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): v is Record<string, string> => object(v) && Object.values(v).every(x => typeof x === 'string');

export function readPublicFoods(data: unknown): PublicFood[] {
  if (!Array.isArray(data) || !data.every(r => object(r) &&
    ['source_key', 'record_key', 'name', 'category', 'manufacturer', 'basis', 'title', 'publisher', 'version'].every(k => typeof r[k] === 'string') &&
    strings(r.raw_values) && object(r.headers) && object(r.headers.rows) && Object.values(r.headers.rows).every(strings))) {
    throw Error('공공 DB 검색 결과의 형식을 확인하지 못했습니다. 다시 시도해 주세요.');
  }
  return data as PublicFood[];
}

export const publicFoodId = (food: PublicFood) => `${food.source_key}:${food.record_key}`;
const normalize = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[\s_·ㆍ/\-]/g, '');

export function publicFoodCells(food: PublicFood): PublicFoodCell[] {
  const rda = food.source_key === 'rda', headers = food.headers.rows;
  return Object.entries(food.raw_values).map(([column, value]) => {
    const label = (headers[rda ? '2' : '1']?.[column] || headers['1']?.[column] || column).replace(/\s+/g, ' ').trim();
    const match = label.match(/\(\s*(kcal|mg|μg|µg|ug|g|㎎|㎍|㎏)(?:\s+([^()]+))?\s*\)$/i);
    const rawUnit = rda ? headers['3']?.[column]?.trim() : match?.[1];
    const unit = rawUnit?.normalize('NFKC').replace(/µ/g, 'μ').replace(/^ug$/i, 'μg');
    return { column, label: rda && unit ? `${label} (${unit})` : label, value,
      nutrientName: match && !rda ? label.slice(0, match.index).trim() : label,
      unit, qualifier: rda ? undefined : match?.[2]?.trim() };
  });
}

// Only exact nutrient aliases are mapped. Similar chemical names are not interchangeable.
const extraAliases: Record<string, string[]> = {
  A002: ['나트륨 Na'], A006: ['총 트랜스지방산'], A007: ['총 포화지방산'],
  B003: ['니코틴아미드'], B005: ['티아민 B1'], B006: ['리보플라빈 B2'], B007: ['비타민 B6 / 피리독신'],
  B010: ['엽산_엽산당량'], D005: ['총 식이섬유'], E001: ['총 불포화지방산'],
  F001: ['구리 Cu'], F002: ['마그네슘 Mg'], F003: ['망간 Mn'], F004: ['몰리브덴 Mo'],
  F006: ['셀레늄 Se'], F007: ['아연 Zn'], F009: ['요오드 I'], F010: ['인 P'], F011: ['철 Fe'],
  F012: ['칼륨 K'], F013: ['칼슘 Ca'], G001: ['총 아미노산'], G002: ['총 필수아미노산'],
};

function referenceValue(code: string, cell: PublicFoodCell): NutritionValue {
  const item = makeManualNutrient(code)!;
  const text = cell.value.normalize('NFKC').trim();
  const base = { ...item, printedName: cell.label, printedValue: cell.value,
    // Keep source units/qualifiers; do not silently turn mg into g, or vitamin A into RAE.
    unit: cell.unit, unitQualifier: cell.qualifier, notices: [] as string[] };
  const number = '(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
  const bound = text.match(new RegExp(`^(<=|>=|<|>|≤|≥)\\s*(${number})$`));
  if (bound) {
    const operators: Record<string, 'lt' | 'lte' | 'gt' | 'gte'> = { '<': 'lt', '<=': 'lte', '≤': 'lte', '>': 'gt', '>=': 'gte', '≥': 'gte' };
    return { ...base, state: 'bounded', value: bound[2].startsWith('.') ? `0${bound[2]}` : bound[2], operator: operators[bound[1]], needsReview: true, reviewReasons: ['원본의 범위 표시를 확인해 주세요.'] };
  }
  if (new RegExp(`^${number}$`).test(text)) return { ...base, value: text.startsWith('.') ? `0${text}` : text,
    state: /^0*(?:\.0*)?$/.test(text) ? 'explicit_zero' : 'exact', needsReview: false };
  return { ...base, state: /^(tr\.?|trace|미량)$/i.test(text) ? 'trace' : /^[-—–]$/.test(text) ? 'dash' : text ? 'ambiguous' : 'not_detected',
    value: undefined, needsReview: !!text, reviewReasons: text ? [`원본 표시: ${cell.value} — 0으로 바꾸지 않았습니다.`] : [],
    notices: text ? [`공공 DB 원본: ${cell.value}`] : [] };
}

export function publicFoodNutrition(food: PublicFood): NutritionLabelResult {
  const cells = publicFoodCells(food), mapped: NutritionValue[] = [];
  for (const entry of nutrientCatalog) {
    const aliases = [entry.name, ...entry.aliases, ...(extraAliases[entry.code] ?? [])].map(normalize);
    const matches = cells.filter(c => c.unit && (entry.code === 'A001' ? c.unit === 'kcal' : ['g', 'mg', 'μg'].includes(c.unit)) && aliases.includes(normalize(c.nutrientName)));
    if (matches.length === 1) mapped.push(referenceValue(entry.code, matches[0]));
    else if (matches.length > 1) mapped.push({ ...makeManualNutrient(entry.code)!, state: 'conflict', needsReview: true,
      reviewReasons: ['대응하는 원본 열이 여러 개입니다. 원본 항목을 확인해 주세요.'],
      notices: matches.map(c => `${c.label}: ${c.value}`) });
  }
  const required = Array.from({ length: 9 }, (_, i) => `A00${i + 1}`).map(code => mapped.find(v => v.code === code) ?? {
    ...makeManualNutrient(code)!, needsReview: true, reviewReasons: ['공공 DB에 값이 없거나 자동 대응하지 못한 항목입니다. 0을 뜻하지 않습니다.'],
  });
  return { basis: { type: 'unknown', printedText: food.basis ? `${food.basis}당` : '기준량 확인 필요', needsReview: !food.basis, needsUnitWeight: false },
    required, additional: mapped.filter(v => !/^A00[1-9]$/.test(v.code ?? '')),
    review: { unmatched: [], ambiguous: [], conflicts: [], leftoverText: [], notes: [] } };
}
