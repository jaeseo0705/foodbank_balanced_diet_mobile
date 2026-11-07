import Foundation
import AppKit

func check(_ condition: @autoclosure () -> Bool, _ message: String) {
  if !condition() { fputs("FAIL: " + message + "\n", stderr); exit(1) }
}

let output = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
  .appendingPathComponent("qa-output")
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
let width = 1200
let height = 700
let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height,
  bitsPerSample: 8, samplesPerPixel: 3, hasAlpha: false, isPlanar: false,
  colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
NSColor.white.setFill()
NSRect(x: 0, y: 0, width: width, height: height).fill()
let paragraph = NSMutableParagraphStyle()
paragraph.lineSpacing = 18
let label = "영양정보\n나트륨 350mg\n탄수화물 20g\n단백질 5g"
(label as NSString).draw(in: NSRect(x: 70, y: 80, width: 1060, height: 540), withAttributes: [
  .font: NSFont.systemFont(ofSize: 64),
  .foregroundColor: NSColor.black,
  .paragraphStyle: paragraph
])
NSGraphicsContext.restoreGraphicsState()
let url = output.appendingPathComponent("vision-test-label.png")
try bitmap.representation(using: .png, properties: [:])!.write(to: url)
// A CI Mac is virtualized: use CPU recognition off the main thread, while keeping
// the main dispatch queue available to Apple's framework services.
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
      fatalError("A missing image must fail")
    } catch { print("Missing image rejection passed.") }
    print("Apple Vision Korean OCR smoke check passed.\n" + text)
    
    exit(0)
  } catch {
    fputs("Vision smoke check failed: \(error)\n", stderr)
    exit(1)
  }
}
dispatchMain()
