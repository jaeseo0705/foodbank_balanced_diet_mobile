import Foundation

enum NutritionLabelService {
  static func parse(lines: [[String: Any]], dictionary: NutrientDictionary? = nil) throws -> [String: Any] {
    let rules = try dictionary ?? NutrientDictionary.bundled()
    let parser = NutritionLabelParser(matcher: NutrientNameMatcher(dictionary: rules))
    let observations = lines.compactMap { line -> OCRObservation? in
      guard let text = line["text"] as? String,
            let box = line["bounds"] as? [String: Double],
            let x = box["x"], let y = box["y"],
            let width = box["width"], let height = box["height"],
            [x, y, width, height].allSatisfy({ $0.isFinite }), width > 0, height > 0 else { return nil }
      // VisionTextRecognizer already returns a TOP-left origin; do not invert Y again.
      return OCRObservation(text: text, x: x, y: y, w: width, h: height)
    }
    let result = parser.parse(observations)
    let data = try JSONEncoder().encode(result)
    return try JSONSerialization.jsonObject(with: data) as! [String: Any]
  }
}
