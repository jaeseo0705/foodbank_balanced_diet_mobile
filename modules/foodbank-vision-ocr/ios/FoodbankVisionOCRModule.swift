import ExpoModulesCore
import Foundation

private let recognitionQueue = DispatchQueue(label: "foodbank.vision.ocr", qos: .userInitiated)

public final class FoodbankVisionOCRModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FoodbankVisionOCR")

    AsyncFunction("recognizeText") { (uri: String) -> [String: Any] in
      return try autoreleasepool {
        let result = try VisionTextRecognizer.recognize(uri: uri)
        return result
      }
    }.runOnQueue(recognitionQueue)
  }
}

