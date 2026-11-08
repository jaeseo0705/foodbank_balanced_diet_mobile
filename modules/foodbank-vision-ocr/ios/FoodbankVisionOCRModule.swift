import ExpoModulesCore
import Foundation

private let recognitionQueue = DispatchQueue(label: "foodbank.vision.ocr", qos: .userInitiated)

public final class FoodbankVisionOCRModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FoodbankVisionOCR")

    AsyncFunction("recognizeText") { (uri: String) -> [String: Any] in
      return try autoreleasepool {
        var result = try VisionTextRecognizer.recognize(uri: uri)
        do {
          result["nutrition"] = try NutritionLabelService.parse(lines: result["lines"] as? [[String: Any]] ?? [])
        } catch {
          // Preserve usable OCR text when a bundled rule file cannot be loaded.
          result["nutritionError"] = "영양정보를 정리하지 못했습니다. 최신 코드로 앱을 다시 빌드해 주세요."
        }
        return result
      }
    }.runOnQueue(recognitionQueue)
  }
}
