package expo.modules.foodbankocr

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FoodbankVisionOCRModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FoodbankVisionOCR")
    AsyncFunction("recognizeText") { uri: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("E_CONTEXT", "Application context is unavailable", null)
        return@AsyncFunction
      }
      val recognizer = TextRecognition.getClient(KoreanTextRecognizerOptions.Builder().build())
      try {
        require(uri.startsWith("file://") || uri.startsWith("content://")) { "A local photo is required" }
        // InputImage applies the selected photo's EXIF orientation.
        val image = InputImage.fromFilePath(context, Uri.parse(uri))
        val rotated = image.rotationDegrees % 180 != 0
        val width = (if (rotated) image.height else image.width).toDouble().coerceAtLeast(1.0)
        val height = (if (rotated) image.width else image.height).toDouble().coerceAtLeast(1.0)
        recognizer.process(image)
          .addOnSuccessListener { result ->
            val lines = result.textBlocks.flatMap { it.lines }.mapNotNull { line ->
              val box = line.boundingBox ?: return@mapNotNull null
              if (box.width() <= 0 || box.height() <= 0) return@mapNotNull null
              mapOf("text" to line.text, "confidence" to line.confidence.toDouble(),
                "bounds" to mapOf("x" to box.left / width, "y" to box.top / height,
                  "width" to box.width() / width, "height" to box.height() / height))
            }
            promise.resolve(mapOf("text" to result.text, "lines" to lines, "languages" to listOf("ko", "en")))
          }
          .addOnFailureListener { promise.reject("E_OCR", "Could not recognize the photo", it) }
          .addOnCompleteListener { recognizer.close() }
      } catch (error: Exception) {
        recognizer.close()
        promise.reject("E_IMAGE", "Could not open the selected photo", error)
      }
    }
  }
}
