import rules from '../../modules/foodbank-vision-ocr/ios/Resources/korean_nutrition_rules_v1.json';
import { nutritionRegex } from './nutritionRegex';
import type { OcrLine } from './ocr.types';
import type { NutritionBasis, NutritionLabelResult, NutritionValue } from './nutrition.types';

// Shared port of NutritionScanKit. OCR adapters return only text and TOP-left bounds.
type Entry = typeof rules.nutrients[number];
type Value = NutritionValue & { printedUnitQualifier?: string; match?: string; candidates?: string[] };
type Basis = NutritionBasis & { resolution?: string; quantityFromPackage?: boolean };
type Package = NonNullable<NutritionLabelResult['package']> & { unitQuantity?: string; unitQuantityUnit?: string; unitWord?: string; unitCount?: string };
const core = Array.from({ length: 9 }, (_, i) => `A00${i + 1}`);
const normalize = (s: string) => s.normalize('NFKC').replace(/[\s·ㆍᆞ‧∙•\-‐‑–—_]/g, '').toLowerCase();
const canon = (s = '') => (({ ml: 'mL', l: 'L', kj: 'kJ', 'µg': 'μg', iu: 'IU' } as Record<string, string>)[s.normalize('NFKC').toLowerCase()] ?? s.normalize('NFKC').toLowerCase());
const dec = (s: string) => s.replace(/,/g, '');
const num = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?';
const rx = nutritionRegex;
const title = /영\s*양\s*정\s*보|영\s*양\s*성\s*분\s*표?|영양\s*[·ㆍ]?\s*기능\s*정보/;
const entries = new Map(rules.nutrients.map(e => [e.code, e]));
const aliases = new Map(rules.nutrients.flatMap(e => e.aliases.map(a => [a.key, e] as const)));
const jamo = (s: string) => Array.from(s).flatMap(c => {
  const i = c.charCodeAt(0) - 0xac00;
  if (i < 0 || i > 11171) return [c];
  return ['ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'[Math.floor(i / 588)], 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'[Math.floor(i % 588 / 28)], (' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'[i % 28] ?? '').trim()].filter(Boolean);
});
function distance(a: string[], b: string[]) {
  let previous = b.map((_, i) => i + 1); previous.unshift(0);
  a.forEach((x, i) => { const next = [i + 1]; b.forEach((y, j) => next.push(Math.min(previous[j + 1] + 1, next[j] + 1, previous[j] + (x === y ? 0 : 1)))); previous = next; });
  return previous[b.length];
}
function matchName(name: string): { entry?: Entry; match: string; candidates: string[] } {
  const key = normalize(name), exact = aliases.get(key);
  const ambiguous = rules.ambiguous_terms.find(t => t.key === key);
  if (ambiguous) return { match: 'ambiguous', candidates: [...ambiguous.codes_in_dictionary, ...ambiguous.codes_outside_dictionary] };
  if (exact) return { entry: exact, match: 'exact', candidates: [] };
  const p = rules.fuzzy_policy, chars = jamo(key), signature = (s: string) => s.replace(/[^a-z0-9]/g, '');
  if (chars.length < p.min_jamo_length) return { match: 'unmatched', candidates: [] };
  const ranked = rules.nutrients.map(entry => ({ entry, distance: Math.min(...entry.aliases.filter(a => !p.require_identical_digits_and_latin || signature(a.key) === signature(key)).map(a => distance(chars, jamo(a.key)))) }));
  for (const t of rules.ambiguous_terms) ranked.push({ entry: { ...rules.nutrients[0], code: [...t.codes_in_dictionary, ...t.codes_outside_dictionary].join('|'), fuzzy_allowed: false }, distance: signature(t.key) === signature(key) ? distance(chars, jamo(t.key)) : Infinity });
  ranked.sort((a, b) => a.distance - b.distance || a.entry.code.localeCompare(b.entry.code));
  const top = ranked[0];
  if (!top || !top.entry.fuzzy_allowed || top.distance > Math.min(p.max_distance, Math.max(1, Math.floor(chars.length * p.max_distance_ratio)))) return { match: 'unmatched', candidates: [] };
  const close = ranked.filter(r => r.distance - top.distance < p.min_margin_to_second_best);
  return close.length > 1 ? { match: 'ambiguous', candidates: close.flatMap(r => r.entry.code.split('|')) } : { entry: top.entry, match: 'suggested', candidates: [] };
}
function blank(e: Entry): Value {
  return { code: e.code, name: e.name_ko, unit: canon(e.unit), unitQualifier: e.unit_qualifier ?? undefined, state: 'not_detected', needsReview: true, reviewReasons: ['사진에서 찾지 못함(미표시인지 인식 실패인지 확인)'], notices: [], alternatives: [] };
}
function rowsFromLines(input: OcrLine[]): string[] {
  let lines = input.filter(l => l.text.trim() && Object.values(l.bounds).every(Number.isFinite) && l.bounds.width > 0 && l.bounds.height > 0);
  const heading = lines.find(l => title.test(l.text));
  if (heading) {
    const b = heading.bounds, header = lines.filter(l => l.bounds.y >= b.y - b.height && l.bounds.y <= b.y + b.height * 2);
    const right = Math.max(...header.map(l => l.bounds.x + l.bounds.width)) + b.height;
    lines = lines.filter(l => l.bounds.x + l.bounds.width >= b.x - b.height && l.bounds.x <= right);
  }
  const heights = lines.map(l => l.bounds.height).sort((a, b) => a - b), median = heights[Math.floor(heights.length / 2)] ?? 0;
  const rows: { lines: OcrLine[]; top: number; bottom: number }[] = [];
  for (const l of [...lines].sort((a, b) => a.bounds.y + a.bounds.height / 2 - b.bounds.y - b.bounds.height / 2)) {
    const b = l.bounds, cy = b.y + b.height / 2;
    const row = rows.find(r => Math.max(0, Math.min(r.bottom, b.y + b.height) - Math.max(r.top, b.y)) / Math.min(r.bottom - r.top, b.height) >= 0.5 || Math.abs(cy - (r.top + r.bottom) / 2) <= 0.6 * median);
    if (row) { row.lines.push(l); row.top = Math.min(row.top, b.y); row.bottom = Math.max(row.bottom, b.y + b.height); }
    else rows.push({ lines: [l], top: b.y, bottom: b.y + b.height });
  }
  return rows.sort((a, b) => a.top + a.bottom - b.top - b.bottom).map(r => r.lines.sort((a, b) => a.bounds.x - b.bounds.x).map(l => l.text.trim()).join(' '));
}
const end = '(?:당(?!류)|기준(?![가-힣]))', paren = `(?:\\(\\s*(?<num>${num})\\s*(?<unit>g|ml)\\s*\\))?`;
const basisPatterns: [NutritionBasis['type'], string][] = [
  ['total_package', `총\\s*내\\s*용\\s*량\\s*${end}`], ['total_package', `(?:한|1)\\s*포장\\s*${end}`],
  ['per_unit', `단위\\s*내\\s*용\\s*량\\s*${paren}\\s*${end}`],
  ['per_serving', `1\\s*회\\s*(?:제공량|섭취\\s*참고량)\\s*(?:${num}\\s*[가-힣]{1,3}\\s*)?${paren}\\s*${end}`],
  ['per_serving', `1\\s*회\\s*제공량\\s*(?:${num}\\s*[가-힣]{1,3}\\s*)?\\(\\s*(?<num>${num})\\s*(?<unit>g|ml)\\s*\\)`],
  ['per_daily_intake', `1\\s*일\\s*섭취량\\s*${end}`], ['per_quantity', `(?<num>${num})\\s*(?<unit>g|kg|ml|㎖|l)\\s*${end}`],
  ['per_unit', `(?<cnt>${num}|한|두|세|네)\\s*(?<cu>[가-힣]{1,3})\\s*${paren}\\s*${end}`],
  ['per_unit', `(?<![가-힣0-9])(?<cu>봉지|봉|개|팩|병|캔|포|정|캡슐|조각|스틱|컵)\\s*${paren}\\s*${end}`],
  ['per_quantity', `\\bper\\s+(?<num>${num})\\s*(?<unit>g|ml)\\b`], ['per_serving', '\\bper\\s+serving\\b'],
  ['per_unit', '\\bper\\s+(?:1\\s+|one\\s+)?(?<cu>pack(?:age)?|bag|bar|piece|bottle|can|stick|pouch|cup)\\b'],
];
function convert(value: string, from: string, to: string): string | undefined {
  const exponents: Record<string, number> = { g: 0, mg: -3, 'μg': -6 };
  if (from === to) return value;
  if (from in exponents && to in exponents) return String(Number((Number(value) * 10 ** (exponents[from] - exponents[to])).toPrecision(14)));
  if (from === 'kJ' && to === 'kcal') return String(Math.round(Number(value) / 4.184 * 10) / 10);
}
export function parseNutrition(lines: OcrLine[], text = ''): NutritionLabelResult {
  const rows = lines.length ? rowsFromLines(lines) : text.split(/\r?\n/);
  const review: NutritionLabelResult['review'] = { unmatched: [], ambiguous: [], conflicts: [], leftoverText: [], notes: [] };
  let start = rows.findIndex(r => title.test(r)); if (start < 0) { start = 0; review.notes.push('영양정보 제목을 찾지 못해 사진 전체를 대상으로 읽음'); }
  let pack: Package | undefined, totalRow: number | undefined, pending = '', unitContent: { quantity: string; unit: string } | undefined;
  const bases: Basis[] = [], items: Value[] = [], energies: { row: number; value: Value }[] = [];
  const amount = `(?<![A-Za-z0-9.:,(\\-])(?<pre>[<>≤≥])?\\s*(?<num>${num})\\s*(?<unit>kcal|kj|mg|ml|μg|µg|㎍|㎎|㎉|㎖|iu|g|l)(?![a-z])(?:\\s*(?<qual>RAE|RE|DFE|NE|α-?TE))?(?:\\s*(?<post>미만|이하|초과|이상))?`;
  for (let rowIndex = start; rowIndex < rows.length; rowIndex++) {
    let row = rows[rowIndex].normalize('NFKC');
    if (/기준치.*(?:2,?000\s*kcal|기준이므로|다를\s*수)|개인의\s*필요\s*열량/i.test(row)) break;
    row = row.replace(rx(`총\\s*${num}\\s*회\\s*제공량\\s*\\(\\s*(${num})\\s*(g|ml)\\s*\\)`), '총 내용량 $1 $2');
    row = row.replace(rx(`총\\s*내\\s*용\\s*량\\s*(?<num>${num})\\s*(?<unit>g|kg|ml|l)(?<paren>\\s*\\([^)]*\\))?(?<dang>\\s*당)?`), (...args: any[]) => {
      const g = args[args.length - 1] as Record<string, string>; pack = { quantity: dec(g.num), unit: canon(g.unit) }; totalRow = rowIndex;
      if (g.paren) {
        const wc = rx(`(?<w>${num})\\s*(?<wu>g|ml)\\s*[×x*]\\s*(?<c>${num})\\s*(?<cu>[가-힣]{1,3})?`).exec(g.paren)?.groups ?? rx(`(?<c>${num})\\s*(?<cu>[가-힣]{1,3})\\s*[×x*]\\s*(?<w>${num})\\s*(?<wu>g|ml)`).exec(g.paren)?.groups;
        const count = wc ?? rx(`(?<c>${num})\\s*(?<cu>[가-힣]{1,3})`).exec(g.paren)?.groups;
        if (count && Number(dec(count.c)) > 0) { pack.unitCount = dec(count.c); pack.unitWord = count.cu; pack.unitQuantity = wc ? dec(wc.w) : String(Math.round(Number(pack.quantity) / Number(pack.unitCount) * 100) / 100); pack.unitQuantityUnit = wc ? canon(wc.wu) : pack.unit; }
      }
      if (g.dang) bases.push({ type: 'total_package', quantity: pack.quantity, unit: pack.unit, printedText: args[0], needsReview: false, needsUnitWeight: false });
      return ' ';
    });
    row = row.replace(rx(`단위\\s*내\\s*용\\s*량\\s*(?<num>${num})\\s*(?<unit>g|ml)(?!\\s*당)`), (...args: any[]) => { const g = args[args.length - 1]; unitContent = { quantity: dec(g.num), unit: canon(g.unit) }; return ' '; });
    for (const [type, pattern] of basisPatterns) row = row.replace(rx(pattern), (...args: any[]) => {
      const g = typeof args[args.length - 1] === 'object' ? args[args.length - 1] : {};
      if (g.cu === '회' || g.cu === '일' || (g.cu?.startsWith('회') && g.cu !== '회분')) return args[0];
      bases.push({ type: g.cu === '회분' ? 'per_serving' : type, quantity: g.num ? dec(g.num) : undefined, unit: g.unit ? canon(g.unit) : undefined, count: ({ 한: '1', 두: '2', 세: '3', 네: '4' } as Record<string, string>)[g.cnt] ?? (g.cnt ? dec(g.cnt) : type === 'per_unit' || type === 'per_serving' || type === 'per_daily_intake' ? '1' : undefined), countUnit: g.cu ?? (type === 'per_serving' ? '회분' : type === 'per_daily_intake' ? '일' : type === 'per_unit' ? '단위 내용량' : undefined), printedText: args[0], needsReview: /포장/.test(args[0]), needsUnitWeight: false }); return ' ';
    });
    row = row.replace(/1\s*일\s*영양성분|기준치에\s*대한\s*비율\s*(?:\(\s*%\s*\))?/g, ' ').replace(title, ' ').replace(/\s+/g, ' ').trim();
    if (!row) continue;
    const tokens = [ ...Array.from(row.matchAll(rx(amount)), m => ({ m, kind: 'amount' })), ...Array.from(row.matchAll(rx(`(?<![A-Za-z0-9.:,(\\-])(?<num>${num})\\s*%`)), m => ({ m, kind: 'percent' })), ...Array.from(row.matchAll(rx('(?:(?<=\\s)|^)(?<word>미량|없음|[-–—])(?=\\s|$)', 'g')), m => ({ m, kind: 'nonnum' })) ];
    for (const m of row.matchAll(rx(`(?:(?<=\\s)|^)(?<num>${num})(?=\\s|$)`))) if (!tokens.some(t => t.m.index! <= m.index! && m.index! < t.m.index! + t.m[0].length)) tokens.push({ m, kind: 'bare' });
    tokens.sort((a, b) => a.m.index! - b.m.index!);
    if (!tokens.length && matchName(row).match !== 'unmatched') { if (pending) review.leftoverText.push(pending); pending = row; continue; }
    let cursor = 0, previous: Value | undefined;
    for (const { m, kind } of tokens) {
      if (m.index! < cursor) continue;
      let name = row.slice(cursor, m.index).replace(/^[\s:|·ㆍ-]+|[\s:|·ㆍ-]+$/g, ''); cursor = m.index! + m[0].length;
      if (kind === 'percent') { if (previous && !name) previous.referencePercent = dec(m.groups!.num); else if (name) review.leftoverText.push(name); continue; }
      if (pending) { if (!name) name = pending; else review.leftoverText.push(pending); pending = ''; }
      const g = m.groups!, hit = matchName(name), e = hit.entry;
      const op = ({ '<': 'lt', '≤': 'lte', '>': 'gt', '≥': 'gte', 미만: 'lt', 이하: 'lte', 초과: 'gt', 이상: 'gte' } as Record<string, Value['operator']>)[g.pre ?? g.post];
      const value: Value = { ...(e ? blank(e) : { name, needsReview: true, reviewReasons: [], notices: [], alternatives: [] }), printedName: name, value: g.num ? dec(g.num) : undefined, unit: e ? canon(e.unit) : g.unit ? canon(g.unit) : undefined, printedUnit: g.unit ? canon(g.unit) : undefined, printedUnitQualifier: g.qual, printedValue: m[0].trim(), operator: op, state: kind === 'bare' ? 'ambiguous' : kind === 'nonnum' ? g.word === '미량' ? 'trace' : g.word === '없음' ? 'none_declared' : 'dash' : op ? 'bounded' : Number(dec(g.num)) === 0 ? 'explicit_zero' : 'exact', match: hit.match, candidates: hit.candidates, needsReview: hit.match !== 'exact' || kind === 'bare', reviewReasons: [] };
      if (!name) { if (value.printedUnit === 'kcal' || value.printedUnit === 'kJ') { value.code = 'A001'; value.name = '열량'; value.unit = 'kcal'; value.match = 'nameless_energy_unit'; value.needsReview = false; energies.push({ row: rowIndex, value }); } else review.leftoverText.push(m[0]); }
      else { if (hit.match === 'suggested') value.reviewReasons.push(`'${name}' → '${value.name}' 표기 확인`); if (!e) value.reviewReasons.push(hit.match === 'ambiguous' ? '후보 중 성분 선택 필요' : '사전에 없는 성분: 목록에서 선택 필요'); if (kind === 'bare') value.reviewReasons.push('단위를 읽지 못함'); items.push(value); }
      previous = value;
    }
    const tail = row.slice(cursor).trim(); if (tail) review.leftoverText.push(tail);
  }
  if (pending) review.leftoverText.push(pending);
  if (!items.some(i => i.code === 'A001') && energies.length) { items.unshift(energies[0].value); if (energies.length > 1) { energies[0].value.needsReview = true; energies[0].value.reviewReasons.push('kcal 값이 여러 개'); } }
  if (pack && unitContent) { pack.unitQuantity = unitContent.quantity; pack.unitQuantityUnit = unitContent.unit; }
  const unique = bases.filter((b, i) => bases.findIndex(a => JSON.stringify([a.type, a.quantity, a.unit, a.count, a.countUnit]) === JSON.stringify([b.type, b.quantity, b.unit, b.count, b.countUnit])) === i);
  let basis: Basis = { type: 'unknown', needsReview: true, needsUnitWeight: false };
  if (unique.length === 1) basis = { ...unique[0], resolution: 'explicit' };
  else if (unique.length > 1) review.notes.push('기준량이 여러 개: ' + unique.map(b => b.printedText).join(', ') + ' (여러 기준 열 분리는 아직 미구현)');
  else if (pack && energies[0] && totalRow !== undefined && Math.abs(energies[0].row - totalRow) <= 1) { basis = { type: 'total_package', quantity: pack.quantity, unit: pack.unit, needsReview: true, needsUnitWeight: false, resolution: 'inferred_total_package' }; review.notes.push('기준량 문구가 없어 머리글의 총 내용량·열량으로 총 내용량 기준을 추정함'); }
  if (basis.type === 'total_package' && !basis.quantity && pack) { basis.quantity = pack.quantity; basis.unit = pack.unit; }
  if (basis.type === 'per_unit' && !basis.quantity) {
    const q = pack?.unitQuantity ?? unitContent?.quantity, word = pack?.unitWord, cu = basis.countUnit ?? '';
    if (q && (!word || cu === '단위 내용량' || word.startsWith(cu) || cu.startsWith(word))) { basis.quantity = String(Number(q) * Number(basis.count ?? '1')); basis.unit = pack?.unitQuantityUnit ?? unitContent?.unit; basis.quantityFromPackage = true; } else basis.needsUnitWeight = true;
  }
  if (basis.type === 'per_serving' && !basis.quantity) basis.needsUnitWeight = true;
  if ([basis.quantity, basis.count].some(q => q !== undefined && Number(q) <= 0)) { basis.needsReview = true; review.notes.push('기준량이 0으로 읽힘: 사진 확인'); }
  const byCode = new Map<string, Value[]>();
  for (const item of items) { if (!item.code) { (item.match === 'ambiguous' ? review.ambiguous : review.unmatched).push(item); continue; } byCode.set(item.code, [...(byCode.get(item.code) ?? []), item]); }
  const selected = new Map<string, Value>();
  for (const [code, list] of byCode) {
    const chosen = list[0];
    if (new Set(list.map(v => [v.value && convert(v.value, v.printedUnit ?? v.unit ?? '', v.unit ?? ''), v.unit, v.state, v.operator].join('|'))).size > 1) { chosen.state = 'conflict'; chosen.needsReview = true; chosen.reviewReasons.push('같은 성분에 서로 다른 값'); review.conflicts.push(list); }
    selected.set(code, chosen);
  }
  const required = core.map(c => selected.get(c) ?? blank(entries.get(c)!)), additional = [...selected.values()].filter(v => !core.includes(v.code!));
  checkValues([...required, ...additional], basis);
  return { package: pack, basis, required, additional, review };
}
function checkValues(values: Value[], basis: Basis) {
  const p = rules.plausibility, density = p.max_density_g_per_ml ?? 1.5;
  const volume = basis.unit === 'mL' || basis.unit === 'L';
  const amount = basis.quantity && ['g', 'kg', 'mL', 'L'].includes(basis.unit ?? '') ? Number(basis.quantity) * (basis.unit === 'kg' || basis.unit === 'L' ? 1000 : 1) : 0;
  const ceiling = amount * (volume ? density : 1), unitChecked = new Set<Value>();
  const flag = (v: Value, reason: string) => { v.needsReview = true; if (!v.reviewReasons.includes(reason)) v.reviewReasons.push(reason); };
  function impossible(v: Value, n: number) {
    if (!(ceiling > 0)) return '';
    const factors: Record<string, number> = { g: 1, mg: 0.001, 'μg': 0.000001 };
    const limits = p.physical_limits_per_100 as Record<string, number>;
    if ((v.unit && factors[v.unit] && n * factors[v.unit] > ceiling) || (limits[v.code!] && n * 100 / ceiling > limits[v.code!])) return `${volume ? `밀도 상한 ${density} g/mL로 가정해도 ` : ''}값이 기준량(${basis.quantity} ${basis.unit})보다 큼`;
    return '';
  }
  for (const v of values) {
    if (v.value === undefined || !v.unit || !v.printedUnit) continue;
    if (v.printedUnit !== v.unit || v.printedUnitQualifier !== v.unitQualifier) {
      const converted = v.printedUnitQualifier === v.unitQualifier ? convert(v.value, v.printedUnit, v.unit) : undefined;
      const label = `라벨 ${v.value} ${v.printedUnit} → ${converted ?? ''} ${v.unit}`;
      if (converted === undefined) { v.value = undefined; v.state = 'ambiguous'; flag(v, label + ' 환산 불가: 사진 보고 직접 입력'); }
      else if (impossible(v, Number(converted))) { flag(v, label + ': ' + impossible(v, Number(converted))); v.alternatives = [{ value: v.value, unit: v.unit, label: '단위를 잘못 읽은 경우' }, { value: converted, unit: v.unit, label: `라벨 단위(${v.printedUnit})가 맞는 경우` }]; unitChecked.add(v); }
      else { v.value = converted; v.notices.push(label); }
    }
    if (!unitChecked.has(v) && ['exact', 'explicit_zero', 'bounded'].includes(v.state) && v.operator !== 'lt' && v.operator !== 'lte') { const why = impossible(v, Number(v.value)); if (why) flag(v, why + ': 사진 확인'); }
  }
  const get = (code: string) => values.find(v => v.code === code);
  const exact = (v?: Value) => v?.value !== undefined && ['exact', 'explicit_zero'].includes(v.state) ? Number(v.value) : undefined;
  const low = (v?: Value) => v?.operator === 'lt' || v?.operator === 'lte' ? 0 : v?.value !== undefined && (['exact', 'explicit_zero'].includes(v.state) || v.operator === 'gt' || v.operator === 'gte') ? Number(v.value) : undefined;
  const flagCodes = (codes: string[], reason: string) => codes.forEach(c => { const v = get(c); if (v) flag(v, reason); });
  const cpf = ['A003', 'A009', 'A005'].map(c => low(get(c)));
  if (ceiling > 0 && cpf.every(v => v !== undefined) && (cpf as number[]).reduce((a, b) => a + b, 0) > ceiling) flagCodes(['A003', 'A009', 'A005'], '탄수화물·단백질·지방 합이 기준량보다 큼');
  function over(parts: string[], total: string, reason: string) {
    const t = exact(get(total)), nums = parts.map(c => low(get(c)));
    if (t !== undefined && nums.every(n => n !== undefined) && (nums as number[]).reduce((a, b) => a + b, 0) > t) flagCodes([...parts, total], reason);
  }
  over(['A004'], 'A003', '당류가 탄수화물보다 큼'); over(['A007', 'A006'], 'A005', '포화지방·트랜스지방 합이 지방보다 큼'); over(['D005'], 'A003', '식이섬유가 탄수화물보다 큼');
  const e = exact(get('A001')), c = exact(get('A003')), pr = exact(get('A009')), f = exact(get('A005'));
  if (e !== undefined && c !== undefined && pr !== undefined && f !== undefined) {
    const kc = p.energy_kcal_per_g.A003;
    let calc = c * kc + pr * p.energy_kcal_per_g.A009 + f * p.energy_kcal_per_g.A005;
    for (const [code, kcal] of Object.entries(p.carbohydrate_components_kcal_per_g)) { const v = exact(get(code)); if (v !== undefined) calc -= v * (kc - kcal); }
    if (Math.abs(e - calc) > Math.max(p.energy_tolerance_kcal, Math.max(e, calc) * p.energy_tolerance_ratio)) flagCodes(['A001', 'A003', 'A009', 'A005'], `표시 열량 ${e} kcal와 계산 열량 ${Math.round(calc)} kcal 차이가 큼`);
  }
  if (amount > 0) for (const v of values) {
    const max = entries.get(v.code!)?.typical_max_per_100, n = low(v);
    if (!unitChecked.has(v) && !v.needsReview && max !== null && max !== undefined && n !== undefined && n * 100 / amount > max) v.notices.push(`100 g당 값이 드묾(가공식품 DB 상위 0.1%인 ${max} ${v.unit} 초과)`);
  }
}
