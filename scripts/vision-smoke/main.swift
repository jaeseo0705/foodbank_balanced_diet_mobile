import Foundation
import CoreGraphics
import CoreText
import ImageIO

func check(_ condition: @autoclosure () -> Bool, _ message: String) {
  if !condition() { fputs("FAIL: " + message + "\n", stderr); exit(1) }
}

let output = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
  .appendingPathComponent("qa-output")
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
let width = 1200
let height = 700
let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
  bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
context.setFillColor(CGColor(gray: 1, alpha: 1))
context.fill(CGRect(x: 0, y: 0, width: width, height: height))
let font = CTFontCreateWithName("AppleSDGothicNeo-Regular" as CFString, 64, nil)
let attributes: [NSAttributedString.Key: Any] = [
  NSAttributedString.Key(kCTFontAttributeName as String): font,
  NSAttributedString.Key(kCTForegroundColorAttributeName as String): CGColor(gray: 0, alpha: 1)
]
for (index, value) in ["영양정보", "나트륨 350mg", "탄수화물 20g", "단백질 5g"].enumerated() {
  context.textPosition = CGPoint(x: 70, y: 560 - index * 130)
  CTLineDraw(CTLineCreateWithAttributedString(NSAttributedString(string: value, attributes: attributes)), context)
}
let url = output.appendingPathComponent("vision-test-label.png")
let destination = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil)!
CGImageDestinationAddImage(destination, context.makeImage()!, nil)
check(CGImageDestinationFinalize(destination), "The test image must be written")
print("Generated the Korean OCR test image.")
fflush(stdout)

DispatchQueue.global(qos: .userInitiated).async {
  do {
    let result = try VisionTextRecognizer.recognize(uri: url.absoluteString, cpuOnly: true)
    let text = result["text"] as? String ?? ""
    check(text.contains("350"), "Vision must recognize the printed numeric value")
    check(text.contains("나트륨"), "Vision must recognize the printed Korean nutrient name")
    let lines = result["lines"] as? [[String: Any]] ?? []
    check(!lines.isEmpty, "Line observations must be returned")
    for line in lines {
      let bounds = line["bounds"] as! [String: Double]
      for key in ["x", "y", "width", "height"] {
        check((0...1).contains(bounds[key]!), "Coordinates must be normalized")
      }
    }
    let data = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
    try data.write(to: output.appendingPathComponent("vision-result.json"))
    do {
      _ = try VisionTextRecognizer.recognize(uri: output.appendingPathComponent("missing.png").absoluteString, cpuOnly: true)
      check(false, "A missing image must fail")
    } catch { print("Missing image rejection passed.") }
    print("Apple Vision Korean OCR smoke check passed.\n" + text)
    exit(0)
  } catch {
    fputs("Vision smoke check failed: \(error)\n", stderr)
    exit(1)
  }
}
dispatchMain()
