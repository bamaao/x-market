import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private let deepLinkChannelName = "x_market/deeplink"
  private let sessionChannelName = "x_market/session"
  private let sessionKeyWalletId = "walletId"
  private let sessionKeyAddress = "address"
  private let sessionKeyConnectedAt = "connectedAtEpochMs"
  private let sessionKeyPhantomSessionToken = "phantomSessionToken"
  private let sessionKeyPhantomWalletPubkeyB58 = "phantomWalletPubkeyB58"
  private let sessionKeyPhantomDappSecretKeyB58 = "phantomDappSecretKeyB58"
  private let sessionKeyPhantomDappPublicKeyB58 = "phantomDappPublicKeyB58"
  private var pendingLink: String?
  private var deepLinkChannel: FlutterMethodChannel?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    let ok = super.application(application, didFinishLaunchingWithOptions: launchOptions)
    if let root = window?.rootViewController as? FlutterViewController {
      let channel = FlutterMethodChannel(name: deepLinkChannelName, binaryMessenger: root.binaryMessenger)
      channel.setMethodCallHandler { [weak self] call, result in
        guard let self else {
          result(nil)
          return
        }
        if call.method == "getInitialLink" {
          result(self.pendingLink)
          self.pendingLink = nil
        } else {
          result(FlutterMethodNotImplemented)
        }
      }
      deepLinkChannel = channel

      let sessionChannel = FlutterMethodChannel(name: sessionChannelName, binaryMessenger: root.binaryMessenger)
      sessionChannel.setMethodCallHandler { [weak self] call, result in
        guard let self else {
          result(nil)
          return
        }
        let defaults = UserDefaults.standard
        switch call.method {
        case "saveSession":
          guard let args = call.arguments as? [String: Any],
                let walletId = args["walletId"] as? String,
                let address = args["address"] as? String else {
            result(
              FlutterError(
                code: "bad_args",
                message: "saveSession args missing",
                details: nil
              )
            )
            return
          }
          let connectedAt = "\(args["connectedAtEpochMs"] ?? "")"
          let phantomSessionToken = args["phantomSessionToken"] as? String
          let phantomWalletPubkeyB58 = args["phantomWalletPubkeyB58"] as? String
          let phantomDappSecretKeyB58 = args["phantomDappSecretKeyB58"] as? String
          let phantomDappPublicKeyB58 = args["phantomDappPublicKeyB58"] as? String
          defaults.set(walletId, forKey: self.sessionKeyWalletId)
          defaults.set(address, forKey: self.sessionKeyAddress)
          defaults.set(connectedAt, forKey: self.sessionKeyConnectedAt)
          defaults.set(phantomSessionToken, forKey: self.sessionKeyPhantomSessionToken)
          defaults.set(phantomWalletPubkeyB58, forKey: self.sessionKeyPhantomWalletPubkeyB58)
          defaults.set(phantomDappSecretKeyB58, forKey: self.sessionKeyPhantomDappSecretKeyB58)
          defaults.set(phantomDappPublicKeyB58, forKey: self.sessionKeyPhantomDappPublicKeyB58)
          result(nil)
        case "loadSession":
          guard let walletId = defaults.string(forKey: self.sessionKeyWalletId),
                let address = defaults.string(forKey: self.sessionKeyAddress),
                let connectedAt = defaults.string(forKey: self.sessionKeyConnectedAt) else {
            result(nil)
            return
          }
          result([
            "walletId": walletId,
            "address": address,
            "connectedAtEpochMs": connectedAt,
            "phantomSessionToken": defaults.string(forKey: self.sessionKeyPhantomSessionToken),
            "phantomWalletPubkeyB58": defaults.string(forKey: self.sessionKeyPhantomWalletPubkeyB58),
            "phantomDappSecretKeyB58": defaults.string(forKey: self.sessionKeyPhantomDappSecretKeyB58),
            "phantomDappPublicKeyB58": defaults.string(forKey: self.sessionKeyPhantomDappPublicKeyB58),
          ])
        case "clearSession":
          defaults.removeObject(forKey: self.sessionKeyWalletId)
          defaults.removeObject(forKey: self.sessionKeyAddress)
          defaults.removeObject(forKey: self.sessionKeyConnectedAt)
          defaults.removeObject(forKey: self.sessionKeyPhantomSessionToken)
          defaults.removeObject(forKey: self.sessionKeyPhantomWalletPubkeyB58)
          defaults.removeObject(forKey: self.sessionKeyPhantomDappSecretKeyB58)
          defaults.removeObject(forKey: self.sessionKeyPhantomDappPublicKeyB58)
          result(nil)
        default:
          result(FlutterMethodNotImplemented)
        }
      }
    }
    return ok
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
  }

  override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey : Any] = [:]
  ) -> Bool {
    handle(url: url)
    return super.application(app, open: url, options: options)
  }

  private func handle(url: URL) {
    guard url.scheme == "xmarket", url.host == "wallet-callback" else {
      return
    }
    let raw = url.absoluteString
    pendingLink = raw
    deepLinkChannel?.invokeMethod("onDeepLink", arguments: raw)
  }
}
