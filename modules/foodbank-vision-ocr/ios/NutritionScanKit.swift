import Foundation
import CoreGraphics

// MARK: - Dictionary

public struct NutrientDictionary: Decodable {
    public struct Alias: Decodable {
        public let text: String
        public let key: String
        public let source: String
    }

    public struct Entry: Decodable {
        public let code: String
        public let nameKo: String
        public let unit: String
        public let unitQualifier: String?
        public let isCore: Bool
        public let fuzzyAllowed: Bool
        public let typicalMaxPer100: Double?
        public let aliases: [Alias]
    }

    public struct Plausibility: Decodable {
        public let physicalLimitsPer100: [String: Double]
        public let maxDensityGPerMl: Double?
        public let energyKcalPerG: [String: Double]
        public let carbohydrateComponentsKcalPerG: [String: Double]
        public let energyToleranceKcal: Double
        public let energyToleranceRatio: Double
    }

    public struct FuzzyPolicy: Decodable {
        public let minJamoLength: Int
        public let maxDistanceRatio: Double
        public let maxDistance: Int
        public let minMarginToSecondBest: Int
        public let requireIdenticalDigitsAndLatin: Bool
    }

    public struct AmbiguousTerm: Decodable {
        public let key: String
        public let codesInDictionary: [String]
        public let codesOutsideDictionary: [String]
    }

    public let version: String
    public let fuzzyPolicy: FuzzyPolicy
    public let plausibility: Plausibility?
    public let ambiguousTerms: [AmbiguousTerm]
    public let nutrients: [Entry]

    public static func load(from url: URL) throws -> NutrientDictionary {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(NutrientDictionary.self, from: Data(contentsOf: url))
    }

    public static func bundled() throws -> NutrientDictionary {
        #if SWIFT_PACKAGE
        let bundle = Bundle.module
        #else
        let host = Bundle(for: NutrientNameMatcher.self)
        let candidates = [host, Bundle.main]
        let bundle = candidates.compactMap { $0.url(forResource: "FoodbankNutritionRules", withExtension: "bundle") }
            .compactMap { Bundle(url: $0) }.first ?? host
        #endif
        guard let url = bundle.url(forResource: "korean_nutrition_rules_v1", withExtension: "json") else {
            throw CocoaError(.fileNoSuchFile)
        }
        return try load(from: url)
    }
}

// MARK: - Match result

public enum NutrientNameMatch: Equatable {
    case exact(code: String, matchedText: String, source: String)
    case suggested(code: String, matchedText: String, distance: Int)
    case ambiguous(candidates: [String])
    case unmatched

    public var code: String? {
        switch self {
        case .exact(let c, _, _), .suggested(let c, _, _): return c
        default: return nil
        }
    }

    public var needsReview: Bool {
        if case .exact = self { return false }
        return true
    }
}

// MARK: - Name matcher

public final class NutrientNameMatcher {

    private struct FuzzyKey {
        let jamo: [UInt32]
        let digitsLatin: String
        let codeKey: String
        let allowed: Bool
        let text: String
    }

    public let dictionary: NutrientDictionary
    private let policy: NutrientDictionary.FuzzyPolicy
    private let aliasIndex: [String: (code: String, text: String, source: String)]
    private let ambiguousIndex: [String: [String]]
    private let fuzzyKeys: [FuzzyKey]
    private let entryByCode: [String: NutrientDictionary.Entry]

    public init(dictionary: NutrientDictionary) {
        var byCode: [String: NutrientDictionary.Entry] = [:]
        var aliases: [String: (code: String, text: String, source: String)] = [:]
        var ambiguous: [String: [String]] = [:]
        var keys: [FuzzyKey] = []
        for e in dictionary.nutrients {
            byCode[e.code] = e
            for a in e.aliases {
                aliases[a.key] = (e.code, a.text, a.source)
                keys.append(FuzzyKey(jamo: Self.jamo(a.key),
                                     digitsLatin: Self.digitsLatin(a.key),
                                     codeKey: e.code, allowed: e.fuzzyAllowed, text: a.text))
            }
        }
        for t in dictionary.ambiguousTerms {
            let codes = t.codesInDictionary + t.codesOutsideDictionary
            ambiguous[t.key] = codes
            keys.append(FuzzyKey(jamo: Self.jamo(t.key),
                                 digitsLatin: Self.digitsLatin(t.key),
                                 codeKey: codes.joined(separator: "|"),
                                 allowed: false, text: t.key))
        }
        self.dictionary = dictionary
        self.policy = dictionary.fuzzyPolicy
        self.aliasIndex = aliases
        self.ambiguousIndex = ambiguous
        self.fuzzyKeys = keys
        self.entryByCode = byCode
    }

    public func entry(for code: String) -> NutrientDictionary.Entry? { entryByCode[code] }

    public func match(_ printedName: String) -> NutrientNameMatch {
        let key = Self.normalize(printedName)
        guard !key.isEmpty else { return .unmatched }
        if let codes = ambiguousIndex[key] { return .ambiguous(candidates: codes) }
        if let hit = aliasIndex[key] { return .exact(code: hit.code, matchedText: hit.text, source: hit.source) }
        return fuzzyMatch(key)
    }

    private func fuzzyMatch(_ key: String) -> NutrientNameMatch {
        let kj = Self.jamo(key)
        guard kj.count >= policy.minJamoLength else { return .unmatched }
        let dl = Self.digitsLatin(key)

        var best: [String: (dist: Int, allowed: Bool, text: String)] = [:]
        for fk in fuzzyKeys {
            if policy.requireIdenticalDigitsAndLatin && fk.digitsLatin != dl { continue }
            if fk.jamo.count < policy.minJamoLength { continue }
            if abs(fk.jamo.count - kj.count) > policy.maxDistance { continue }
            let d = Self.levenshtein(kj, fk.jamo)
            if let cur = best[fk.codeKey], cur.dist <= d { continue }
            best[fk.codeKey] = (d, fk.allowed, fk.text)
        }
        guard !best.isEmpty else { return .unmatched }

        let ranked = best.sorted { ($0.value.dist, $0.key) < ($1.value.dist, $1.key) }
        let top = ranked[0]
        let limit = min(policy.maxDistance, max(1, Int(Double(kj.count) * policy.maxDistanceRatio)))
        if top.value.dist > limit || !top.value.allowed { return .unmatched }

        if ranked.count > 1, ranked[1].value.dist - top.value.dist < policy.minMarginToSecondBest {
            let close = ranked
                .filter { $0.value.dist - top.value.dist < policy.minMarginToSecondBest }
                .flatMap { $0.key.split(separator: "|").map(String.init) }
            return .ambiguous(candidates: close)
        }
        return .suggested(code: top.key, matchedText: top.value.text, distance: top.value.dist)
    }

    // MARK: Name split

    private static let amountRegex = try! NSRegularExpression(
        pattern: #"(?<![A-Za-z0-9.:,(])(?:[<>≤≥]\s*)?\d[\d,]*(?:\.\d+)?\s*(?:kcal|kj|mg|μg|µg|㎎|㎍|㎉|g|ml|㎖|l|%)"#,
        options: [.caseInsensitive])
    private static let nonNumericValueRegex = try! NSRegularExpression(
        pattern: #"\s(미량|없음|[-–—])\s*$"#)

    public static func splitName(_ line: String) -> String {
        let ns = line as NSString
        let full = NSRange(location: 0, length: ns.length)
        if let m = amountRegex.firstMatch(in: line, range: full) {
            return ns.substring(to: m.range.location).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        if let m = nonNumericValueRegex.firstMatch(in: line, range: full) {
            return ns.substring(to: m.range.location).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return line.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    // MARK: Normalization

    private static let removable: Set<Unicode.Scalar> = Set("·ㆍ\u{119E}‧∙•-‐‑–—_".unicodeScalars)

    public static func normalize(_ s: String) -> String {
        let nfkc = s.precomposedStringWithCompatibilityMapping
        var out = String.UnicodeScalarView()
        for u in nfkc.unicodeScalars {
            if u.properties.isWhitespace || removable.contains(u) { continue }
            out.append(u)
        }
        return String(out).lowercased()
    }

    // MARK: Jamo distance

    private static let choseong: [UInt32] = Array("ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ".unicodeScalars.map { $0.value })
    private static let jungseong: [UInt32] = Array("ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ".unicodeScalars.map { $0.value })
    private static let jongseong: [UInt32] = [0] + Array("ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ".unicodeScalars.map { $0.value })

    static func jamo(_ s: String) -> [UInt32] {
        var out: [UInt32] = []
        out.reserveCapacity(s.unicodeScalars.count * 3)
        for u in s.unicodeScalars {
            let v = u.value
            if v >= 0xAC00 && v <= 0xD7A3 {
                let i = Int(v - 0xAC00)
                out.append(choseong[i / 588])
                out.append(jungseong[(i % 588) / 28])
                let t = jongseong[i % 28]
                if t != 0 { out.append(t) }
            } else {
                out.append(v)
            }
        }
        return out
    }

    static func digitsLatin(_ key: String) -> String {
        var out = String.UnicodeScalarView()
        for u in key.unicodeScalars
        where (u.value >= 0x30 && u.value <= 0x39) || (u.value >= 0x61 && u.value <= 0x7A) {
            out.append(u)
        }
        return String(out)
    }

    static func levenshtein(_ a: [UInt32], _ b: [UInt32]) -> Int {
        let (long, short) = a.count >= b.count ? (a, b) : (b, a)
        var prev = Array(0...short.count)
        var cur = [Int](repeating: 0, count: short.count + 1)
        for (i, x) in long.enumerated() {
            cur[0] = i + 1
            for (j, y) in short.enumerated() {
                cur[j + 1] = min(prev[j + 1] + 1, cur[j] + 1, prev[j] + (x == y ? 0 : 1))
            }
            swap(&prev, &cur)
        }
        return prev[short.count]
    }
}

// MARK: - Input

public struct OCRObservation {
    public let text: String
    public let x: Double, y: Double, w: Double, h: Double

    public init(text: String, x: Double, y: Double, w: Double, h: Double) {
        self.text = text; self.x = x; self.y = y; self.w = w; self.h = h
    }

    public init(text: String, visionBoundingBox b: CGRect) {
        self.init(text: text, x: Double(b.minX), y: Double(1 - b.minY - b.height),
                  w: Double(b.width), h: Double(b.height))
    }
}

// MARK: - Output

public enum ValueState: String, Codable {
    case exact, explicitZero = "explicit_zero", bounded, trace, noneDeclared = "none_declared"
    case dash, ambiguous, notDetected = "not_detected", conflict
}

public struct PackageAmount: Codable, Equatable {
    public var quantity: String
    public var unit: String
    public var unitQuantity: String? = nil
    public var unitQuantityUnit: String? = nil
    public var unitCount: String? = nil
    public var unitWord: String? = nil
}

public struct NutritionBasis: Codable, Equatable {
    public enum Kind: String, Codable {
        case totalPackage = "total_package", perQuantity = "per_quantity", perServing = "per_serving"
        case perUnit = "per_unit", perDailyIntake = "per_daily_intake", unknown
    }
    public enum Resolution: String, Codable {
        case explicit, inferredTotalPackage = "inferred_total_package", unknown
    }
    public var type: Kind
    public var quantity: String?
    public var unit: String?
    public var count: String?
    public var countUnit: String?
    public var printedText: String?
    public var resolution: Resolution
    public var needsReview: Bool
    public var needsUnitWeight: Bool = false
    public var quantityFromPackage: Bool = false

    static let unknownBasis = NutritionBasis(type: .unknown, quantity: nil, unit: nil, count: nil,
                                             countUnit: nil, printedText: nil, resolution: .unknown,
                                             needsReview: true)
}

public struct NutrientEntryResult: Codable {
    public var code: String?
    public var name: String
    public var printedName: String?
    public var value: String?
    public var unit: String?
    public var unitQualifier: String?
    public var printedUnit: String? = nil
    public var printedUnitQualifier: String? = nil
    public var state: ValueState
    public var `operator`: String?
    public var printedValue: String?
    public var referencePercent: String?
    public var match: String
    public var candidates: [String]
    public var needsReview: Bool
    public var reviewReasons: [String]
    public var notices: [String] = []
    public var alternatives: [ValueChoice] = []
}

public struct ValueChoice: Codable, Equatable {
    public let value: String
    public let unit: String
    public let label: String
}

public struct NutritionLabelResult: Codable {
    public struct Review: Codable {
        public var unmatched: [NutrientEntryResult] = []
        public var ambiguous: [NutrientEntryResult] = []
        public var conflicts: [[NutrientEntryResult]] = []
        public var leftoverText: [String] = []
        public var notes: [String] = []
    }
    public var package: PackageAmount?
    public var basis: NutritionBasis
    public var required: [NutrientEntryResult]
    public var additional: [NutrientEntryResult]
    public var review: Review
}

// MARK: - Parser

public final class NutritionLabelParser {

    public static let coreOrder = ["A001", "A002", "A003", "A004", "A005", "A006", "A007", "A008", "A009"]

    private let matcher: NutrientNameMatcher

    public init(matcher: NutrientNameMatcher) { self.matcher = matcher }

    public func parse(_ observations: [OCRObservation]) -> NutritionLabelResult {
        parse(rows: Self.groupRows(Self.clipToPanel(observations)))
    }

    static func clipToPanel(_ obs: [OCRObservation]) -> [OCRObservation] {
        guard let title = obs.first(where: { has(reTitle, $0.text) }) else { return obs }
        let margin = title.h
        let left = title.x - margin
        let bandBottom = title.y + title.h * 2
        let header = obs.filter { $0.y >= title.y - title.h && $0.y <= bandBottom }
        let right = (header.map { $0.x + $0.w }.max() ?? 1) + margin
        return obs.filter { $0.x + $0.w >= left && $0.x <= right }
    }

    // MARK: Patterns

    private static let num = #"(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?"#
    private static let unitAlt = "kcal|kj|mg|ml|μg|µg|㎍|㎎|㎉|㎖|iu|g|l"
    private static func rx(_ p: String, _ ci: Bool = false) -> NSRegularExpression {
        try! NSRegularExpression(pattern: p, options: ci ? [.caseInsensitive] : [])
    }

    private static let reAmount = rx(#"(?<![A-Za-z0-9.:,(\-])(?<pre>[<>≤≥])?\s*(?<num>"# + num + #")\s*(?<unit>"# + unitAlt
        + #")(?![a-z])(?:\s*(?<qual>RAE|RE|DFE|NE|α-?TE))?(?:\s*(?<post>미만|이하|초과|이상))?"#, true)
    private static let rePercent = rx(#"(?<![A-Za-z0-9.:,(\-])(?<num>"# + num + #")\s*%"#)
    private static let reNonNum = rx(#"(?:(?<=\s)|^)(?<word>미량|없음|[-–—])(?=\s|$)"#)
    private static let reBare = rx(#"(?:(?<=\s)|^)(?<num>"# + num + #")(?=\s|$)"#)

    private static let reTitle = rx(#"영\s*양\s*정\s*보|영\s*양\s*성\s*분\s*표?|영양\s*[·ㆍ]?\s*기능\s*정보"#)
    private static let reTotal = rx(#"총\s*내\s*용\s*량\s*(?<num>"# + num + #")\s*(?<unit>g|kg|ml|㎖|l)(?<paren>\s*\([^)]*\))?(?<dang>\s*당)?"#, true)
    private static let reTotalServings = rx(#"총\s*"# + num + #"\s*회\s*제공량\s*\(\s*(?<num>"# + num + #")\s*(?<unit>g|ml)\s*\)"#, true)
    private static let reUnitContent = rx(#"단위\s*내\s*용\s*량\s*(?<num>"# + num + #")\s*(?<unit>g|ml)(?!\s*당)"#, true)
    private static let reParenWeightCount = rx(#"(?<w>"# + num + #")\s*(?<wu>g|ml)\s*[×xX*]\s*(?<c>"# + num + #")\s*(?<cu>[가-힣]{1,3})?"#, true)
    private static let reParenCountWeight = rx(#"(?<c>"# + num + #")\s*(?<cu>[가-힣]{1,3})\s*[×xX*]\s*(?<w>"# + num + #")\s*(?<wu>g|ml)"#, true)
    private static let reParenCount = rx(#"(?<c>"# + num + #")\s*(?<cu>[가-힣]{1,3})"#)
    private static let reRefHeader = rx(#"1\s*일\s*영양성분|기준치에\s*대한\s*비율\s*(?:\(\s*%\s*\))?"#)
    private static let reFootnote = rx(#"기준치.*(?:2,?000\s*kcal|기준이므로|다를\s*수)|개인의\s*필요\s*열량"#)

    private static let basisEnd = #"(?:당(?!류)|기준(?![가-힣]))"#
    private static let parenAmount = #"(?:\(\s*(?<num>"# + num + #")\s*(?<unit>g|ml)\s*\))?"#
    private static let countWords = "봉지|봉|개|팩|병|캔|포|정|캡슐|조각|스틱|컵"
    private static let numberWords = ["한": "1", "두": "2", "세": "3", "네": "4"]

    private enum BasisPattern: CaseIterable {
        case totalPackage, totalPackageScopeCheck, unitContent, perServing, perServingHeader, perDailyIntake
        case perQuantity, perUnit, perUnitBare, enPerQuantity, enPerServing, enPerUnit

        var regex: NSRegularExpression {
            let P = NutritionLabelParser.self
            let end = P.basisEnd, paren = P.parenAmount, num = P.num
            switch self {
            case .totalPackage: return P.rx(#"총\s*내\s*용\s*량\s*"# + end)
            case .totalPackageScopeCheck: return P.rx(#"(?:한|1)\s*포장\s*"# + end)
            case .unitContent: return P.rx(#"단위\s*내\s*용\s*량\s*"# + paren + #"\s*"# + end, true)
            case .perServing:
                return P.rx(#"1\s*회\s*(?:제공량|섭취\s*참고량)\s*(?:"# + num + #"\s*[가-힣]{1,3}\s*)?"# + paren + #"\s*"# + end, true)
            case .perServingHeader:
                return P.rx(#"1\s*회\s*제공량\s*(?:"# + num + #"\s*[가-힣]{1,3}\s*)?\(\s*(?<num>"# + num + #")\s*(?<unit>g|ml)\s*\)"#, true)
            case .perDailyIntake: return P.rx(#"1\s*일\s*섭취량\s*"# + end)
            case .perQuantity: return P.rx(#"(?<num>"# + num + #")\s*(?<unit>g|kg|ml|㎖|l)\s*"# + end, true)
            case .perUnit:
                return P.rx(#"(?<cnt>"# + num + #"|한|두|세|네)\s*(?<cu>[가-힣]{1,3})\s*"# + paren + #"\s*"# + end, true)
            case .perUnitBare:
                return P.rx(#"(?<![가-힣0-9])(?<cu>"# + P.countWords + #")\s*"# + paren + #"\s*"# + end, true)
            case .enPerQuantity: return P.rx(#"\bper\s+(?<num>"# + num + #")\s*(?<unit>g|ml)\b"#, true)
            case .enPerServing: return P.rx(#"\bper\s+serving\b"#, true)
            case .enPerUnit:
                return P.rx(#"\bper\s+(?:1\s+|one\s+)?(?<cu>pack(?:age)?|bag|bar|piece|bottle|can|stick|pouch|cup)\b"#, true)
            }
        }
    }
    private static let basisRegexes: [(BasisPattern, NSRegularExpression)] = BasisPattern.allCases.map { ($0, $0.regex) }

    private static let unitCanon: [String: String] = [
        "㎎": "mg", "㎍": "μg", "µg": "μg", "㎉": "kcal", "㎖": "mL", "ml": "mL", "l": "L",
        "kcal": "kcal", "kj": "kJ", "mg": "mg", "μg": "μg", "g": "g", "iu": "IU", "kg": "kg"]

    static func canonUnit(_ u: String?) -> String? {
        guard let u = u else { return nil }
        return unitCanon[u] ?? unitCanon[u.lowercased()] ?? u
    }

    static func dec(_ s: String) -> String { s.replacingOccurrences(of: ",", with: "") }

    // MARK: Rows

    static func groupRows(_ obs: [OCRObservation]) -> [String] {
        guard !obs.isEmpty else { return [] }
        let heights = obs.map(\.h).sorted()
        let medH = heights[heights.count / 2]
        struct Row { var items: [OCRObservation]; var top: Double; var bot: Double; var cy: Double }
        var rows: [Row] = []
        for o in obs.sorted(by: { $0.y + $0.h / 2 < $1.y + $1.h / 2 }) {
            let cy = o.y + o.h / 2
            var placed = false
            for i in rows.indices {
                let overlap = max(0, min(rows[i].bot, o.y + o.h) - max(rows[i].top, o.y))
                let small = min(rows[i].bot - rows[i].top, o.h)
                if (small > 0 && overlap / small >= 0.5) || abs(cy - rows[i].cy) <= 0.6 * medH {
                    rows[i].items.append(o)
                    rows[i].top = min(rows[i].top, o.y); rows[i].bot = max(rows[i].bot, o.y + o.h)
                    rows[i].cy = (rows[i].top + rows[i].bot) / 2
                    placed = true
                    break
                }
            }
            if !placed { rows.append(Row(items: [o], top: o.y, bot: o.y + o.h, cy: cy)) }
        }
        return rows.sorted { $0.cy < $1.cy }.map { r in
            r.items.sorted { $0.x < $1.x }
                .map { $0.text.trimmingCharacters(in: .whitespacesAndNewlines) }
                .joined(separator: " ")
        }
    }

    // MARK: Row items

    struct RawValue {
        var printed: String; var decimal: String?; var unit: String?; var qual: String?
        var state: ValueState; var op: String?
    }
    struct RawItem { var name: String; var value: RawValue; var percent: String? }

    private static func g(_ m: NSTextCheckingResult, _ name: String, _ ns: NSString) -> String? {
        guard m.regularExpression?.pattern.contains("(?<\(name)>") ?? false else { return nil }
        let r = m.range(withName: name)
        return r.location == NSNotFound ? nil : ns.substring(with: r)
    }

    private static func value(from m: NSTextCheckingResult, kind: String, ns: NSString) -> RawValue {
        let printed = ns.substring(with: m.range).trimmingCharacters(in: .whitespaces)
        switch kind {
        case "amount":
            let n = dec(g(m, "num", ns)!)
            let opText = g(m, "pre", ns) ?? g(m, "post", ns)
            let op = opText.flatMap { ["<": "lt", "≤": "lte", ">": "gt", "≥": "gte",
                                       "미만": "lt", "이하": "lte", "초과": "gt", "이상": "gte"][$0] }
            let state: ValueState = op != nil ? .bounded : (Decimal(string: n) == 0 ? .explicitZero : .exact)
            return RawValue(printed: printed, decimal: n, unit: canonUnit(g(m, "unit", ns)),
                            qual: g(m, "qual", ns), state: state, op: op)
        case "nonnum":
            let w = g(m, "word", ns)!
            let st: ValueState = w == "미량" ? .trace : (w == "없음" ? .noneDeclared : .dash)
            return RawValue(printed: w, decimal: nil, unit: nil, qual: nil, state: st, op: nil)
        default:
            return RawValue(printed: printed, decimal: dec(g(m, "num", ns)!), unit: nil, qual: nil,
                            state: .ambiguous, op: nil)
        }
    }

    private static let nameTrim = CharacterSet(charactersIn: " :|·ㆍ-")

    static func splitRow(_ text: String) -> (items: [RawItem], leftovers: [String]) {
        let ns = text as NSString
        let full = NSRange(location: 0, length: ns.length)
        var toks: [(start: Int, end: Int, kind: String, m: NSTextCheckingResult)] = []
        for (kind, re) in [("amount", reAmount), ("percent", rePercent), ("nonnum", reNonNum)] {
            for m in re.matches(in: text, range: full) {
                toks.append((m.range.location, NSMaxRange(m.range), kind, m))
            }
        }
        let taken = toks.map { ($0.start, $0.end) }
        for m in reBare.matches(in: text, range: full)
        where !taken.contains(where: { $0.0 <= m.range.location && m.range.location < $0.1 }) {
            toks.append((m.range.location, NSMaxRange(m.range), "bare", m))
        }
        toks.sort { $0.start < $1.start }
        var clean: [(start: Int, end: Int, kind: String, m: NSTextCheckingResult)] = []
        var lastEnd = -1
        for t in toks where t.start >= lastEnd { clean.append(t); lastEnd = t.end }

        var items: [RawItem] = []
        var leftovers: [String] = []
        var cursor = 0
        for t in clean {
            let gap = ns.substring(with: NSRange(location: cursor, length: t.start - cursor))
                .trimmingCharacters(in: nameTrim)
            if t.kind == "percent" {
                if !items.isEmpty && gap.isEmpty {
                    items[items.count - 1].percent = dec(g(t.m, "num", ns)!)
                } else if !gap.isEmpty {
                    leftovers.append(gap)
                }
                cursor = t.end
                continue
            }
            items.append(RawItem(name: gap, value: value(from: t.m, kind: t.kind, ns: ns), percent: nil))
            cursor = t.end
        }
        let tail = ns.substring(from: cursor).trimmingCharacters(in: nameTrim)
        if !tail.isEmpty { leftovers.append(tail) }
        return (items, leftovers)
    }

    // MARK: Basis

    static func findBasis(_ text: String) -> [NutritionBasis] {
        let ns = text as NSString
        var found: [(NutritionBasis, NSRange)] = []
        for (kind, re) in basisRegexes {
            for m in re.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
                if found.contains(where: { f in
                    (f.1.location <= m.range.location && m.range.location < NSMaxRange(f.1)) ||
                    (m.range.location <= f.1.location && f.1.location < NSMaxRange(m.range))
                }) { continue }
                var b = NutritionBasis(type: .unknown, quantity: nil, unit: nil, count: nil, countUnit: nil,
                                       printedText: ns.substring(with: m.range).trimmingCharacters(in: .whitespaces),
                                       resolution: .explicit, needsReview: false)
                if let n = g(m, "num", ns) { b.quantity = dec(n); b.unit = canonUnit(g(m, "unit", ns)) }
                switch kind {
                case .totalPackage: b.type = .totalPackage
                case .totalPackageScopeCheck: b.type = .totalPackage; b.needsReview = true
                case .unitContent: b.type = .perUnit; b.count = "1"; b.countUnit = "단위 내용량"
                case .perServing, .perServingHeader, .enPerServing: b.type = .perServing; b.count = "1"; b.countUnit = "회분"
                case .perDailyIntake: b.type = .perDailyIntake; b.count = "1"; b.countUnit = "일"
                case .perQuantity, .enPerQuantity: b.type = .perQuantity
                case .perUnit:
                    guard let cnt = g(m, "cnt", ns), let cu = g(m, "cu", ns) else { continue }
                    if cu == "회" || cu == "일" || (cu.hasPrefix("회") && cu != "회분") { continue }
                    let count = numberWords[cnt] ?? dec(cnt)
                    if cu == "회분" {
                        b.type = .perServing; b.count = count; b.countUnit = "회분"
                    } else {
                        b.type = .perUnit; b.count = count; b.countUnit = cu
                    }
                case .perUnitBare: b.type = .perUnit; b.count = "1"; b.countUnit = g(m, "cu", ns)
                case .enPerUnit: b.type = .perUnit; b.count = "1"; b.countUnit = g(m, "cu", ns)?.lowercased()
                }
                found.append((b, m.range))
            }
        }
        return found.map { $0.0 }
    }

    static func packageDetail(_ paren: String?, totalQuantity: String) -> (quantity: String, unit: String?, count: String, word: String?)? {
        guard let paren = paren else { return nil }
        let ns = paren as NSString
        let full = NSRange(location: 0, length: ns.length)
        for re in [reParenWeightCount, reParenCountWeight] {
            if let m = re.firstMatch(in: paren, range: full) {
                return (dec(g(m, "w", ns)!), canonUnit(g(m, "wu", ns)), dec(g(m, "c", ns)!), g(m, "cu", ns))
            }
        }
        if let m = reParenCount.firstMatch(in: paren, range: full),
           let c = Decimal(string: dec(g(m, "c", ns)!)), c > 0, let total = Decimal(string: totalQuantity) {
            let handler = NSDecimalNumberHandler(roundingMode: .bankers, scale: 2, raiseOnExactness: false,
                                                 raiseOnOverflow: false, raiseOnUnderflow: false,
                                                 raiseOnDivideByZero: false)
            let per = NSDecimalNumber(decimal: total / c).rounding(accordingToBehavior: handler).stringValue
            return (per, nil, dec(g(m, "c", ns)!), g(m, "cu", ns))
        }
        return nil
    }

    static func fillUnitWeight(_ basis: inout NutritionBasis, package: PackageAmount?,
                               unitContent: (quantity: String, unit: String?)?) {
        basis.needsUnitWeight = false
        if basis.type == .perServing && basis.quantity == nil { basis.needsUnitWeight = true; return }
        guard basis.type == .perUnit, basis.quantity == nil else { return }
        var unitQuantity = package?.unitQuantity
        var unitQuantityUnit = package?.unitQuantityUnit
        var word = package?.unitWord
        if unitQuantity == nil, let uc = unitContent {
            unitQuantity = uc.quantity; unitQuantityUnit = uc.unit; word = nil
        }
        let cu = basis.countUnit ?? ""
        let sameWord = word == nil || cu == "단위 내용량" || (!cu.isEmpty && (word!.hasPrefix(cu) || cu.hasPrefix(word!)))
        if let q = unitQuantity.flatMap({ Decimal(string: $0) }), sameWord {
            let count = Decimal(string: basis.count ?? "1") ?? 1
            basis.quantity = NSDecimalNumber(decimal: q * count).stringValue
            basis.unit = unitQuantityUnit
            basis.quantityFromPackage = true
            return
        }
        basis.needsUnitWeight = true
    }

    private static func removing(_ re: NSRegularExpression, from s: String) -> String {
        re.stringByReplacingMatches(in: s, range: NSRange(location: 0, length: (s as NSString).length), withTemplate: " ")
    }

    // MARK: Parse

    public func parse(rows: [String]) -> NutritionLabelResult {
        var review = NutritionLabelResult.Review()
        let startIndex = rows.firstIndex { Self.has(Self.reTitle, $0) }
        if startIndex == nil { review.notes.append("영양정보 제목을 찾지 못해 사진 전체를 대상으로 읽음") }
        var panel: [String] = []
        for r in rows[(startIndex ?? 0)...] {
            if Self.has(Self.reFootnote, r) { break }
            panel.append(r)
        }

        var package: PackageAmount?
        var bases: [NutritionBasis] = []
        var items: [NutrientEntryResult] = []
        var headerEnergy: [(idx: Int, item: RawItem, row: String)] = []
        var totalRow: Int?
        var unitContent: (quantity: String, unit: String?)?
        var pendingName: String?

        for (idx, row) in panel.enumerated() {
            var text = row
            let ns = text as NSString
            let full = NSRange(location: 0, length: ns.length)
            if let m = Self.reTotal.firstMatch(in: text, range: full) ?? Self.reTotalServings.firstMatch(in: text, range: full) {
                var p = PackageAmount(quantity: Self.dec(Self.g(m, "num", ns)!), unit: Self.canonUnit(Self.g(m, "unit", ns))!)
                if let d = Self.packageDetail(Self.g(m, "paren", ns), totalQuantity: p.quantity) {
                    p.unitQuantity = d.quantity
                    p.unitQuantityUnit = d.unit ?? p.unit
                    p.unitCount = d.count
                    p.unitWord = d.word
                }
                package = p
                totalRow = idx
                if Self.g(m, "dang", ns) != nil {
                    bases.append(NutritionBasis(type: .totalPackage, quantity: p.quantity, unit: p.unit, count: nil,
                                                countUnit: nil, printedText: ns.substring(with: m.range),
                                                resolution: .explicit, needsReview: false))
                }
                text = ns.substring(to: m.range.location) + " " + ns.substring(from: NSMaxRange(m.range))
            }
            let ns2 = text as NSString
            if let mu = Self.reUnitContent.firstMatch(in: text, range: NSRange(location: 0, length: ns2.length)) {
                unitContent = (Self.dec(Self.g(mu, "num", ns2)!), Self.canonUnit(Self.g(mu, "unit", ns2)))
                text = ns2.substring(to: mu.range.location) + " " + ns2.substring(from: NSMaxRange(mu.range))
            }
            bases += Self.findBasis(text)
            for (_, re) in Self.basisRegexes { text = Self.removing(re, from: text) }
            text = Self.removing(Self.reRefHeader, from: text)
            text = Self.removing(Self.reTitle, from: text)
            text = text.split(whereSeparator: \.isWhitespace).joined(separator: " ")
            if text.isEmpty { continue }

            let split = Self.splitRow(text)
            var rowItems = split.items
            let rest = split.leftovers
            if rowItems.isEmpty && rest.isEmpty { continue }
            if rowItems.isEmpty, rest.count == 1, matcher.match(rest[0]) != .unmatched {
                if let p = pendingName { review.leftoverText.append(p) }
                pendingName = rest[0]
                continue
            }
            if let p = pendingName {
                if let first = rowItems.first, first.name.isEmpty {
                    rowItems[0].name = p
                } else {
                    review.leftoverText.append(p)
                }
                pendingName = nil
            }
            review.leftoverText += rest
            for it in rowItems {
                if it.name.isEmpty {
                    if it.value.unit == "kcal" || it.value.unit == "kJ" {
                        headerEnergy.append((idx, it, row))
                    } else {
                        review.leftoverText.append(it.value.printed)
                    }
                    continue
                }
                items.append(classify(it))
            }
        }
        if let p = pendingName { review.leftoverText.append(p) }

        if !items.contains(where: { $0.code == "A001" }), let first = headerEnergy.first {
            var e = output(name: "열량", printedName: "(이름 없음)", raw: first.item, code: "A001",
                                match: "nameless_energy_unit")
            if headerEnergy.count > 1 { e.needsReview = true; e.reviewReasons.append("kcal 값이 여러 개") }
            items.insert(e, at: 0)
        }

        if let uc = unitContent, package != nil {
            package?.unitQuantity = uc.quantity
            package?.unitQuantityUnit = uc.unit
        }
        var basis = resolveBasis(bases, package: package, headerEnergyRow: headerEnergy.first?.idx,
                                 totalRow: totalRow, notes: &review.notes)
        Self.fillUnitWeight(&basis, package: package, unitContent: unitContent)
        if [basis.quantity, basis.count].contains(where: { $0.flatMap { Decimal(string: $0) }.map { $0 <= 0 } ?? false }) {
            basis.needsReview = true
            review.notes.append("기준량이 0으로 읽힘: 사진 확인")
        }

        var byCode: [String: [NutrientEntryResult]] = [:]
        var order: [String] = []
        for it in items {
            switch it.match {
            case "unmatched": review.unmatched.append(it)
            case "ambiguous": review.ambiguous.append(it)
            default:
                guard let c = it.code else { continue }
                if byCode[c] == nil { order.append(c) }
                byCode[c, default: []].append(it)
            }
        }
        var required: [String: NutrientEntryResult] = [:]
        var additional: [NutrientEntryResult] = []
        for code in order {
            let list = byCode[code]!
            var chosen = list[0]
            let distinct = Set(list.map { comparable($0) })
            if distinct.count > 1 {
                chosen.state = .conflict; chosen.needsReview = true
                chosen.reviewReasons.append("같은 성분에 서로 다른 값")
                review.conflicts.append(list)
            }
            if Self.coreOrder.contains(code) { required[code] = chosen } else { additional.append(chosen) }
        }
        let requiredList = Self.coreOrder.map { code -> NutrientEntryResult in
            required[code] ?? NutrientEntryResult(
                code: code, name: matcher.entry(for: code)?.nameKo ?? code, printedName: nil, value: nil,
                unit: Self.canonUnit(matcher.entry(for: code)?.unit), unitQualifier: matcher.entry(for: code)?.unitQualifier,
                state: .notDetected, operator: nil, printedValue: nil,
                referencePercent: nil, match: "unmatched", candidates: [], needsReview: true,
                reviewReasons: ["사진에서 찾지 못함(미표시인지 인식 실패인지 확인)"])
        }
        let (checkedRequired, checkedAdditional) = checkValues(required: requiredList, additional: additional,
                                                               basis: basis)
        return NutritionLabelResult(package: package, basis: basis, required: checkedRequired,
                                    additional: checkedAdditional, review: review)
    }

    // MARK: Units

    private static let massExponent: [String: Int] = ["g": 0, "mg": -3, "μg": -6]
    private static let kJPerKcal = Decimal(string: "4.184")!

    private static func text(_ d: Decimal) -> String { NSDecimalNumber(decimal: d).stringValue }

    private static func dec(_ x: Double) -> Decimal { Decimal(string: String(x)) ?? Decimal(x) }

    private static func scaled(_ d: Decimal, by exponent: Int) -> Decimal {
        var factor = Decimal(1)
        for _ in 0..<abs(exponent) { factor *= 10 }
        return exponent >= 0 ? d * factor : d / factor
    }

    static func convertAmount(_ value: String, from unit: String, to target: String) -> String? {
        guard let d = Decimal(string: value) else { return nil }
        if let a = massExponent[unit], let b = massExponent[target] {
            return text(scaled(d, by: a - b))
        }
        if unit == "kJ" && target == "kcal" {
            let handler = NSDecimalNumberHandler(roundingMode: .plain, scale: 1, raiseOnExactness: false,
                                                 raiseOnOverflow: false, raiseOnUnderflow: false,
                                                 raiseOnDivideByZero: false)
            return NSDecimalNumber(decimal: d / kJPerKcal).rounding(accordingToBehavior: handler).stringValue
        }
        return nil
    }

    private static func unitText(_ unit: String?, _ qual: String?) -> String {
        (unit ?? "") + (qual.map { " \($0)" } ?? "")
    }

    private static func basisAmount(_ basis: NutritionBasis, density: Double? = nil) -> Decimal? {
        guard let q = basis.quantity.flatMap({ Decimal(string: $0) }), q > 0, let u = basis.unit,
              ["g", "kg", "mL", "L"].contains(u) else { return nil }
        var amount = u == "kg" || u == "L" ? q * 1000 : q
        if (u == "mL" || u == "L"), let d = density { amount *= dec(d) }
        return amount
    }

    private var maxDensity: Double { plausibility?.maxDensityGPerMl ?? 1.5 }

    private func comparable(_ x: NutrientEntryResult) -> String {
        var value = x.value
        if let v = x.value, let pu = x.printedUnit, let u = x.unit, pu != u,
           x.printedUnitQualifier == x.unitQualifier, let c = Self.convertAmount(v, from: pu, to: u) {
            value = c
        }
        let normalized = value.flatMap { Decimal(string: $0) }.map { Self.text($0) } ?? ""
        return "\(normalized)|\(x.unit ?? "")|\(x.state.rawValue)|\(x.operator ?? "")"
    }

    private func impossible(code: String, value: String?, unit: String?, basis: NutritionBasis) -> String? {
        guard let amount = Self.basisAmount(basis, density: maxDensity),
              let v = value.flatMap({ Decimal(string: $0) }) else { return nil }
        let volume = basis.unit == "mL" || basis.unit == "L"
        let assumed = volume ? "밀도 상한 \(String(format: "%g", maxDensity)) g/mL로 가정해도 " : ""
        if let u = unit, let exp = Self.massExponent[u], Self.scaled(v, by: exp) > amount {
            return "\(assumed)값이 기준량(\(basis.quantity ?? "") \(basis.unit ?? ""))보다 큼"
        }
        if let limit = plausibility?.physicalLimitsPer100[code], v * 100 / amount > Self.dec(limit) {
            return "\(assumed)100 g당 \(String(format: "%g", limit)) \(unit ?? "") 초과" + (volume ? "" : "(물리적 한계)")
        }
        return nil
    }

    private var plausibility: NutrientDictionary.Plausibility? { matcher.dictionary.plausibility }

    private func applyUnitPolicy(_ x: inout NutrientEntryResult, basis: NutritionBasis) -> Bool {
        guard let code = x.code, let raw = x.value, let unit = x.unit, let pu = x.printedUnit else { return false }
        let fixed = Self.unitText(unit, x.unitQualifier)
        let printed = Self.unitText(pu, x.printedUnitQualifier)
        if printed == fixed { return false }
        let converted = x.printedUnitQualifier == x.unitQualifier ? Self.convertAmount(raw, from: pu, to: unit) : nil
        guard let c = converted else {
            x.value = nil
            x.state = .ambiguous
            x.needsReview = true
            x.reviewReasons.append("라벨 \(raw) \(printed) → \(fixed) 환산 불가: 사진 보고 직접 입력")
            return false
        }
        if let why = impossible(code: code, value: c, unit: unit, basis: basis) {
            x.needsReview = true
            x.reviewReasons.append("라벨 \(raw) \(printed) → \(c) \(fixed): \(why)")
            x.alternatives = [
                ValueChoice(value: raw, unit: unit, label: "단위를 잘못 읽은 경우"),
                ValueChoice(value: c, unit: unit, label: "라벨 단위(\(printed))가 맞는 경우"),
            ]
            return true
        }
        x.value = c
        x.notices.append("라벨 \(raw) \(printed) → \(c) \(fixed)")
        return false
    }

    private static func flag(_ x: inout NutrientEntryResult, _ reason: String) {
        x.needsReview = true
        if !x.reviewReasons.contains(reason) { x.reviewReasons.append(reason) }
    }

    private static func lowValue(_ x: NutrientEntryResult?) -> Decimal? {
        guard let x = x, let v = x.value.flatMap({ Decimal(string: $0) }) else { return nil }
        if x.state == .exact || x.state == .explicitZero || x.operator == "gt" || x.operator == "gte" { return v }
        if x.operator == "lt" || x.operator == "lte" { return 0 }
        return nil
    }

    private static func exactValue(_ x: NutrientEntryResult?) -> Decimal? {
        guard let x = x, x.state == .exact || x.state == .explicitZero else { return nil }
        return x.value.flatMap { Decimal(string: $0) }
    }

    private func checkValues(required: [NutrientEntryResult], additional: [NutrientEntryResult],
                             basis: NutritionBasis) -> ([NutrientEntryResult], [NutrientEntryResult]) {
        var all = required + additional
        var unitChecked = Set<Int>()
        for i in all.indices where all[i].code != nil {
            if applyUnitPolicy(&all[i], basis: basis) { unitChecked.insert(i) }
        }
        var index: [String: Int] = [:]
        for (i, x) in all.enumerated() { if let c = x.code { index[c] = i } }
        func get(_ c: String) -> NutrientEntryResult? { index[c].map { all[$0] } }
        func flagAll(_ codes: [String], _ reason: String) {
            for c in codes { if let i = index[c] { Self.flag(&all[i], reason) } }
        }

        // 1단계: 불가능한 값
        for (code, i) in index where !unitChecked.contains(i) {
            let x = all[i]
            guard [ValueState.exact, .explicitZero, .bounded].contains(x.state),
                  x.operator != "lt", x.operator != "lte" else { continue }
            if let why = impossible(code: code, value: x.value, unit: x.unit, basis: basis) {
                Self.flag(&all[i], "\(why): 사진 확인")
            }
        }
        let cpf = ["A003", "A009", "A005"].map { Self.lowValue(get($0)) }
        if let amount = Self.basisAmount(basis, density: maxDensity), cpf.allSatisfy({ $0 != nil }), cpf.compactMap({ $0 }).reduce(0, +) > amount {
            let volume = basis.unit == "mL" || basis.unit == "L"
            let assumed = volume ? "밀도 상한 \(String(format: "%g", maxDensity)) g/mL로 가정해도 " : ""
            flagAll(["A003", "A009", "A005"],
                    "\(assumed)탄수화물·단백질·지방 합이 기준량(\(basis.quantity ?? "") \(basis.unit ?? ""))보다 큼")
        }

        // 2단계: 표 안에서 서로 맞지 않는 값
        func over(_ parts: [String], _ total: String, _ message: String) {
            guard let t = Self.exactValue(get(total)) else { return }
            let values = parts.map { Self.lowValue(get($0)) }
            guard values.allSatisfy({ $0 != nil }) else { return }
            if values.compactMap({ $0 }).reduce(0, +) > t { flagAll(parts + [total], message) }
        }
        over(["A004"], "A003", "당류가 탄수화물보다 큼")
        over(["A007", "A006"], "A005", "포화지방·트랜스지방 합이 지방보다 큼")
        over(["D005"], "A003", "식이섬유가 탄수화물보다 큼")
        if let p = plausibility, let e = Self.exactValue(get("A001")), let c = Self.exactValue(get("A003")),
           let pr = Self.exactValue(get("A009")), let f = Self.exactValue(get("A005")) {
            let kc = Self.dec(p.energyKcalPerG["A003"] ?? 4)
            var carbKcal = c * kc
            for (code, kcal) in p.carbohydrateComponentsKcalPerG {
                if let v = Self.exactValue(get(code)) { carbKcal -= v * (kc - Self.dec(kcal)) }
            }
            let calc = carbKcal + pr * Self.dec(p.energyKcalPerG["A009"] ?? 4) + f * Self.dec(p.energyKcalPerG["A005"] ?? 9)
            let diff = e > calc ? e - calc : calc - e
            let tolerance = max(Self.dec(p.energyToleranceKcal), max(e, calc) * Self.dec(p.energyToleranceRatio))
            if diff > tolerance {
                let rounded = NSDecimalNumber(decimal: calc).rounding(accordingToBehavior: NSDecimalNumberHandler(
                    roundingMode: .bankers, scale: 0, raiseOnExactness: false, raiseOnOverflow: false,
                    raiseOnUnderflow: false, raiseOnDivideByZero: false))
                flagAll(["A001", "A003", "A009", "A005"],
                        "표시 열량 \(Self.text(e)) kcal와 계산 열량 \(rounded.stringValue) kcal 차이가 큼")
            }
        }

        // 3단계: 드문 값(알림)
        if let amount = Self.basisAmount(basis) {
            for (code, i) in index where !unitChecked.contains(i) && !all[i].needsReview {
                guard let tmax = matcher.entry(for: code)?.typicalMaxPer100,
                      let v = Self.lowValue(all[i]), v * 100 / amount > Self.dec(tmax) else { continue }
                all[i].notices.append("100 g당 값이 드묾(가공식품 DB 상위 0.1%인 \(String(format: "%g", tmax)) \(all[i].unit ?? "") 초과)")
            }
        }
        return (Array(all[..<required.count]), Array(all[required.count...]))
    }

    // MARK: Helpers

    private static func has(_ re: NSRegularExpression, _ s: String) -> Bool {
        re.firstMatch(in: s, range: NSRange(location: 0, length: (s as NSString).length)) != nil
    }

    private func output(name: String, printedName: String, raw: RawItem, code: String?,
                        match: String) -> NutrientEntryResult {
        let unit: String?
        let qual: String?
        if let code = code, let entry = matcher.entry(for: code) {
            unit = Self.canonUnit(entry.unit)
            qual = entry.unitQualifier
        } else if raw.value.decimal != nil {
            unit = raw.value.unit
            qual = raw.value.qual
        } else {
            unit = nil
            qual = nil
        }
        return NutrientEntryResult(code: code, name: name, printedName: printedName, value: raw.value.decimal,
                                   unit: unit, unitQualifier: qual,
                                   printedUnit: raw.value.unit, printedUnitQualifier: raw.value.qual,
                                   state: raw.value.state, operator: raw.value.op, printedValue: raw.value.printed,
                                   referencePercent: raw.percent, match: match, candidates: [],
                                   needsReview: false, reviewReasons: [])
    }

    private func classify(_ it: RawItem) -> NutrientEntryResult {
        let r = matcher.match(it.name)
        var out: NutrientEntryResult
        switch r {
        case .exact(let code, _, _):
            out = output(name: matcher.entry(for: code)?.nameKo ?? it.name, printedName: it.name,
                              raw: it, code: code, match: "exact")
        case .suggested(let code, _, _):
            let n = matcher.entry(for: code)?.nameKo ?? it.name
            out = output(name: n, printedName: it.name, raw: it, code: code, match: "suggested")
            out.needsReview = true
            out.reviewReasons.append("'\(it.name)' → '\(n)' 표기 확인")
        case .ambiguous(let cands):
            out = output(name: it.name, printedName: it.name, raw: it, code: nil, match: "ambiguous")
            out.candidates = cands
            out.needsReview = true
            out.reviewReasons.append("후보 중 성분 선택 필요")
        case .unmatched:
            out = output(name: it.name, printedName: it.name, raw: it, code: nil, match: "unmatched")
            out.needsReview = true
            out.reviewReasons.append("사전에 없는 성분: 목록에서 선택 필요")
        }
        if it.value.state == .ambiguous {
            out.needsReview = true; out.reviewReasons.append("단위를 읽지 못함")
        }
        return out
    }

    private func resolveBasis(_ bases: [NutritionBasis], package: PackageAmount?, headerEnergyRow: Int?,
                              totalRow: Int?, notes: inout [String]) -> NutritionBasis {
        var uniq: [NutritionBasis] = []
        for b in bases where !uniq.contains(where: {
            $0.type == b.type && $0.quantity == b.quantity && $0.unit == b.unit &&
            $0.count == b.count && $0.countUnit == b.countUnit }) {
            uniq.append(b)
        }
        if uniq.count == 1 {
            var b = uniq[0]
            b.resolution = .explicit
            if b.type == .totalPackage, b.quantity == nil, let p = package { b.quantity = p.quantity; b.unit = p.unit }
            return b
        }
        if uniq.count > 1 {
            notes.append("기준량이 여러 개: " + uniq.compactMap(\.printedText).joined(separator: ", ")
                         + " (여러 기준 열 분리는 아직 미구현)")
            return .unknownBasis
        }
        if let p = package, let e = headerEnergyRow, let t = totalRow, abs(e - t) <= 1 {
            notes.append("기준량 문구가 없어 머리글의 총 내용량·열량으로 총 내용량 기준을 추정함")
            return NutritionBasis(type: .totalPackage, quantity: p.quantity, unit: p.unit, count: nil, countUnit: nil,
                                  printedText: nil, resolution: .inferredTotalPackage, needsReview: true)
        }
        return .unknownBasis
    }
}
