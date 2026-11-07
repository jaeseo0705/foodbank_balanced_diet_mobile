import Foundation
import CoreGraphics
import ImageIO
import Vision

enum VisionTextRecognizer {
  // Limit working image memory without changing the original selected photograph.
  static let maximumImageDimension = 3200

  static func recognize(uri: String) throws -> [String: Any] {
    guard let url = URL(string: uri), url.isFileURL,
          FileManager.default.fileExists(atPath: url.path) else {
      throw failure(1, "A readable local photo is required.")
    }
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maximumImageDimension,
            kCGImageSourceShouldCacheImmediately: true
          ] as CFDictionary) else {
      throw failure(2, "The selected file could not be decoded as an image.")
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    // Keep the recognized numbers/units as raw OCR instead of linguistic corrections.
    request.usesLanguageCorrection = false
    let supported = try request.supportedRecognitionLanguages()
    guard let korean = supported.first(where: { $0.hasPrefix("ko") }) else {
      throw failure(3, "Korean text recognition is not supported by this OS.")
    }
    let english = supported.first(where: { $0 == "en-US" }) ?? supported.first(where: { $0.hasPrefix("en") })
    let languages = [korean] + (english.map { [$0] } ?? [])
    request.recognitionLanguages = languages

    // Thumbnail creation applies all EXIF rotations/mirroring, so the image is upright.
    let handler = VNImageRequestHandler(cgImage: image, orientation: .up, options: [:])
    try handler.perform([request])

    let observations = (request.results ?? []).sorted { left, right in
      if left.boundingBox.midY == right.boundingBox.midY {
        return left.boundingBox.minX < right.boundingBox.minX
      }
      return left.boundingBox.midY > right.boundingBox.midY
    }
    let lines: [[String: Any]] = observations.compactMap { observation in
      guard let candidate = observation.topCandidates(1).first,
            !candidate.string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        return nil
      }
      let box = observation.boundingBox
      return [
        "text": candidate.string,
        "confidence": Double(candidate.confidence),
        // Normalized 0...1 coordinates, with the origin at the TOP left.
        "bounds": [
          "x": Double(box.minX),
          "y": Double(1 - box.maxY),
          "width": Double(box.width),
          "height": Double(box.height)
        ]
      ]
    }
    return [
      "text": lines.compactMap { $0["text"] as? String }.joined(separator: "\n"),
      "lines": lines,
      "languages": languages
    ]
  }

  private static func failure(_ code: Int, _ message: String) -> NSError {
    NSError(domain: "FoodbankVisionOCR", code: code, userInfo: [NSLocalizedDescriptionKey: message])
  }
}
