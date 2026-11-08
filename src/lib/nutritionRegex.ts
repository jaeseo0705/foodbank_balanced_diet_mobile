/** Numbered captures and explicit boundary checks keep rules independent of
 * native named-group/replace and lookbehind implementations on mobile engines. */
export function nutritionRegex(source: string, flags = 'gi'): RegExp {
  let boundary: ((before: string) => boolean) | undefined;
  const negative = /^\(\?<!(\[[^\]]+\])\)/.exec(source);
  if (negative) {
    const excluded = new RegExp(negative[1]);
    boundary = before => !before || !excluded.test(before);
    source = source.slice(negative[0].length);
  } else if (source.startsWith('(?:(?<=\\s)|^)')) {
    source = source.slice('(?:(?<=\\s)|^)'.length);
    boundary = before => !before || /\s/.test(before);
  }
  const names: Record<string, number> = {};
  let pattern = '', capture = 0, inClass = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '\\') { pattern += c + (source[++i] ?? ''); continue; }
    if (c === '[') inClass = true;
    if (c === ']') inClass = false;
    if (c === '(' && !inClass) {
      if (source.slice(i, i + 3) === '(?<') {
        const end = source.indexOf('>', i + 3);
        if (end < 0) throw new Error('Invalid nutrition rule capture');
        names[source.slice(i + 3, end)] = ++capture;
        pattern += '('; i = end; continue;
      }
      if (source[i + 1] !== '?') capture++;
    }
    pattern += c;
  }
  const re = new RegExp(pattern, flags), nativeExec = re.exec.bind(re);
  re.exec = (text: string): RegExpExecArray | null => {
    let match: RegExpExecArray | null;
    while ((match = nativeExec(text))) {
      if (boundary && !boundary(text[match.index - 1] ?? '')) {
        if (!re.global) return null;
        continue;
      }
      match.groups = {};
      for (const name of Object.keys(names)) match.groups[name] = match[names[name]];
      return match;
    }
    return null;
  };
  Object.defineProperty(re, Symbol.matchAll, { value: function* (text: string) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
      yield match;
      if (!re.global) break;
      if (!match[0].length) re.lastIndex++;
    }
  } });
  Object.defineProperty(re, Symbol.replace, { value: (text: string, replacement: string | ((...args: any[]) => string)) => {
    re.lastIndex = 0;
    const matches: RegExpExecArray[] = [];
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
      matches.push(match);
      if (!re.global) break;
      if (!match[0].length) re.lastIndex++;
    }
    let out = '', cursor = 0;
    for (const m of matches) {
      out += text.slice(cursor, m.index);
      out += typeof replacement === 'function' ? replacement(...m, m.index, text, m.groups)
        : replacement.replace(/\$([1-9])/g, (_, index: string) => m[Number(index)] ?? '');
      cursor = m.index + m[0].length;
    }
    return out + text.slice(cursor);
  } });
  return re;
}
