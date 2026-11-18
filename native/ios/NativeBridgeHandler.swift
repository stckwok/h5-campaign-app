import UIKit
import WebKit
import Photos

class NativeBridgeHandler: NSObject, WKScriptMessageHandler {
    weak var viewController: UIViewController?
    weak var webView: WKWebView?

    init(viewController: UIViewController, webView: WKWebView) {
        self.viewController = viewController
        self.webView = webView
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "NativeAppBridge",
              let bodyString = message.body as? String,
              let data = bodyString.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let action = json["action"] as? String,
              let callbackId = json["callbackId"] as? String else { return }

        let payload = json["payload"] as? [String: Any] ?? [:]

        switch action {
        case "getUserInfo":
            let userData = ["userId": "u_1024", "nickname": "Alex", "token": "jwt_token_here"]
            sendResponse(callbackId: callbackId, code: 0, data: userData)

        case "saveImageToAlbum":
            guard let base64 = payload["image"] as? String, let image = decodeBase64Image(base64) else {
                sendResponse(callbackId: callbackId, code: -1, message: "Invalid image data")
                return
            }
            PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
                guard status == .authorized || status == .limited else {
                    self.sendResponse(callbackId: callbackId, code: -1, message: "Photo permission denied")
                    return
                }
                UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
                self.sendResponse(callbackId: callbackId, code: 0, data: ["saved": true])
            }

        case "shareImage":
            guard let base64 = payload["image"] as? String, let image = decodeBase64Image(base64) else {
                sendResponse(callbackId: callbackId, code: -1, message: "Invalid image data")
                return
            }
            let title = payload["title"] as? String ?? ""
            DispatchQueue.main.async {
                let activityVC = UIActivityViewController(activityItems: [title, image], applicationActivities: nil)
                self.viewController?.present(activityVC, animated: true)
                self.sendResponse(callbackId: callbackId, code: 0, data: ["shared": true])
            }

        default:
            sendResponse(callbackId: callbackId, code: -1, message: "Unknown action")
        }
    }

    private func decodeBase64Image(_ base64: String) -> UIImage? {
        let cleaned = base64.replacingOccurrences(of: "^data:image/\\w+;base64,", with: "", options: .regularExpression)
        guard let data = Data(base64Encoded: cleaned) else { return nil }
        return UIImage(data: data)
    }

    private func sendResponse(callbackId: String, code: Int, data: Any? = nil, message: String = "") {
        var response: [String: Any] = ["code": code, "message": message]
        if let data = data { response["data"] = data }
        guard let jsonData = try? JSONSerialization.data(withJSONObject: response),
              let jsonString = String(data: jsonData, encoding: .utf8) else { return }

        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript("window['\(callbackId)'] && window['\(callbackId)'](\(jsonString));")
        }
    }
}
