import Foundation

func check(_ value: @autoclosure () -> Bool, _ message: String) {
  if !value() { fputs("FAIL: \(message)\n", stderr); exit(1) }
}

let rulesURL = URL(fileURLWithPath: "modules/foodbank-vision-ocr/ios/Resources/korean_nutrition_rules_v1.json")
let dictionary = try NutrientDictionary.load(from: rulesURL)
let parser = NutritionLabelParser(matcher: NutrientNameMatcher(dictionary: dictionary))
check(dictionary.nutrients.count == 129, "Load the supplied dictionary")
let rows = [
  "영양정보", "총 내용량 80 g", "375 kcal", "총 내용량당", "1일 영양성분 기준치에 대한 비율",
  "나트륨 550 mg 28%", "탄수화물 58 g 18%", "당류 5 g 5%", "식이섬유 4.9 g 20%",
  "지방 16 g 30%", "트랜스지방 0 g", "포화지방 6 g 40%", "콜레스테롤 0 mg 0%", "단백질 2.8 g 5%",
  "1일 영양성분 기준치에 대한 비율(%)은 2,000 kcal 기준이므로 개인의 필요 열량에 따라 다를 수 있습니다."
]
let label = parser.parse(rows: rows)
func field(_ result: NutritionLabelResult, _ code: String) -> NutrientEntryResult {
  (result.required + result.additional).first { $0.code == code }!
}
let expected = ["A001": "375", "A002": "550", "A003": "58", "A004": "5", "A005": "16", "A006": "0", "A007": "6", "A008": "0", "A009": "2.8", "D005": "4.9"]
for (code, value) in expected { check(field(label, code).value == value, "Sample field \(code) = \(value)") }
check(label.package?.quantity == "80" && label.basis.quantity == "80", "Total package basis")
check(field(label, "A002").referencePercent == "28", "Percent must not become nutrient mass")
check(field(label, "A006").state == .explicitZero, "Preserve explicit zero")
let missing = parser.parse(rows: ["영양정보", "단백질 5 g"])
check(field(missing, "A002").state == .notDetected && field(missing, "A002").value == nil, "Missing is not zero")
let split = parser.parse(rows: ["영양정보", "나트륨", "550 mg 28%"])
check(field(split, "A002").value == "550", "Reconnect a split name and value")
let equivalent = parser.parse(rows: ["영양정보", "총 내용량 80 g", "총 내용량당", "나트륨 0.55 g", "나트륨 550 mg"])
check(equivalent.review.conflicts.isEmpty, "Equivalent units do not conflict")
check(field(equivalent, "A002").value == "550" && field(equivalent, "A002").unit == "mg", "Normalize sodium to mg")
let conflict = parser.parse(rows: ["영양정보", "나트륨 550 mg", "나트륨 650 mg"])
check(field(conflict, "A002").state == .conflict, "Different values require review")
let bound = parser.parse(rows: ["영양정보", "나트륨 5 mg 미만"])
check(field(bound, "A002").operator == "lt" && field(bound, "A002").state == .bounded, "Keep bound meaning")
let zero = parser.parse(rows: ["영양정보", "0 g당", "열량 300 kcal", "나트륨 550 mg"])
check(zero.basis.needsReview, "Zero basis is flagged without division by zero")
let multi = parser.parse(rows: ["영양정보", "100 g당 1회 제공량(30 g)당", "나트륨 500 mg 150 mg"])
check(multi.basis.type == .unknown && multi.basis.needsReview, "Multiple columns must not silently select a basis")
let unnamed = parser.parse(rows: ["영양정보", "새성분 3 mg"])
check(unnamed.review.unmatched.first?.needsReview == true, "Unmatched nutrients need review")
let empty = parser.parse(rows: [])
check(empty.required.allSatisfy { $0.value == nil }, "Empty input does not create values")

// The bridge consumes the same TOP-left bounding boxes as the existing OCR engine.
let lines: [[String: Any]] = rows.enumerated().map { i, text in
  ["text": text, "bounds": ["x": 0.1, "y": Double(i) * 0.045, "width": 0.8, "height": 0.02]]
}
let bridged = try NutritionLabelService.parse(lines: lines, dictionary: dictionary)
let bridgedRequired = bridged["required"] as! [[String: Any]]
check(bridgedRequired.first { $0["code"] as? String == "A002" }?["value"] as? String == "550", "OCR bridge preserves top-left coordinates")
let output = URL(fileURLWithPath: "qa-output")
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
try JSONSerialization.data(withJSONObject: bridged, options: [.prettyPrinted, .sortedKeys]).write(to: output.appendingPathComponent("nutrition-result.json"))
print("Korean nutrition parser and OCR bridge checks passed.")
