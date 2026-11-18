import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.provider.MediaStore
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

class NativeBridgeInterface(private val context: Context, private val webView: WebView) {

    @JavascriptInterface
    fun postMessage(rawMessage: String) {
        val json = JSONObject(rawMessage)
        val action = json.getString("action")
        val callbackId = json.getString("callbackId")
        val payload = json.optJSONObject("payload") ?: JSONObject()

        when (action) {
            "getUserInfo" -> {
                val data = JSONObject().apply {
                    put("userId", "u_1024")
                    put("nickname", "Alex")
                    put("token", "jwt_token_here")
                }
                sendResponse(callbackId, 0, data)
            }
            "saveImageToAlbum" -> {
                val bitmap = decodeBase64(payload.optString("image"))
                if (bitmap == null) {
                    sendResponse(callbackId, -1, message = "Invalid image")
                    return
                }
                saveBitmapToGallery(bitmap)
                sendResponse(callbackId, 0, JSONObject().put("saved", true))
            }
            "shareImage" -> {
                val bitmap = decodeBase64(payload.optString("image"))
                val title = payload.optString("title", "Campaign Poster")
                if (bitmap == null) {
                    sendResponse(callbackId, -1, message = "Invalid image")
                    return
                }
                shareBitmap(bitmap, title)
                sendResponse(callbackId, 0, JSONObject().put("shared", true))
            }
            else -> sendResponse(callbackId, -1, message = "Unknown action")
        }
    }

    private fun decodeBase64(base64Str: String): Bitmap? {
        val cleanBase64 = base64Str.substringAfter(",")
        val bytes = Base64.decode(cleanBase64, Base64.DEFAULT)
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
    }

    private fun saveBitmapToGallery(bitmap: Bitmap) {
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, "poster_${System.currentTimeMillis()}.jpg")
            put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
            put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Campaign")
        }
        val uri = context.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
        uri?.let {
            context.contentResolver.openOutputStream(it)?.use { out ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, 90, out)
            }
        }
    }

    private fun shareBitmap(bitmap: Bitmap, title: String) {
        val cacheFile = File(context.cacheDir, "share_poster.jpg")
        FileOutputStream(cacheFile).use { bitmap.compress(Bitmap.CompressFormat.JPEG, 90, it) }
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", cacheFile)

        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "image/jpeg"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_TEXT, title)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, title).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    private fun sendResponse(callbackId: String, code: Int, data: JSONObject? = null, message: String = "") {
        val response = JSONObject().apply {
            put("code", code)
            put("message", message)
            if (data != null) put("data", data)
        }
        webView.post {
            webView.evaluateJavascript("window['$callbackId'] && window['$callbackId']($response);", null)
        }
    }
}
