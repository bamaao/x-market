// Copyright (c) 2026 zouyc zouyccq@gmail.com.
// All rights reserved.
//
// Licensed under the Business Source License 1.1 (BSL 1.1).
// You may not use this file except in compliance with the License.
//
// Change Date: 2031-01-01
// On the Change Date, or the fourth anniversary of the first publicly available
// distribution of the code under the BSL, whichever comes first, the code
// automatically becomes available under the Apache License 2.0.

package com.example.x_market_flutter

import android.content.Intent
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val deeplinkChannelName = "x_market/deeplink"
    private val sessionChannelName = "x_market/session"
    private val prefName = "x_market_wallet_session"
    private var pendingLink: String? = null
    private var deeplinkChannel: MethodChannel? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        deeplinkChannel = MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            deeplinkChannelName
        )
        deeplinkChannel?.setMethodCallHandler { call, result ->
            if (call.method == "getInitialLink") {
                result.success(pendingLink)
                pendingLink = null
            } else {
                result.notImplemented()
            }
        }

        val sessionChannel = MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            sessionChannelName
        )
        sessionChannel.setMethodCallHandler { call, result ->
            val prefs = getSharedPreferences(prefName, MODE_PRIVATE)
            when (call.method) {
                "saveSession" -> {
                    val args = call.arguments as? Map<*, *>
                    if (args == null) {
                        result.error("bad_args", "saveSession args missing", null)
                        return@setMethodCallHandler
                    }
                    val walletId = args["walletId"]?.toString()
                    val address = args["address"]?.toString()
                    val connectedAt = args["connectedAtEpochMs"]?.toString()
                    val phantomSessionToken = args["phantomSessionToken"]?.toString()
                    val phantomWalletPubkeyB58 = args["phantomWalletPubkeyB58"]?.toString()
                    val phantomDappSecretKeyB58 = args["phantomDappSecretKeyB58"]?.toString()
                    val phantomDappPublicKeyB58 = args["phantomDappPublicKeyB58"]?.toString()
                    if (walletId.isNullOrEmpty() || address.isNullOrEmpty() || connectedAt.isNullOrEmpty()) {
                        result.error("bad_args", "saveSession args invalid", null)
                        return@setMethodCallHandler
                    }
                    val editor = prefs.edit()
                        .putString("walletId", walletId)
                        .putString("address", address)
                        .putString("connectedAtEpochMs", connectedAt)
                    if (!phantomSessionToken.isNullOrEmpty()) {
                        editor.putString("phantomSessionToken", phantomSessionToken)
                    } else {
                        editor.remove("phantomSessionToken")
                    }
                    if (!phantomWalletPubkeyB58.isNullOrEmpty()) {
                        editor.putString("phantomWalletPubkeyB58", phantomWalletPubkeyB58)
                    } else {
                        editor.remove("phantomWalletPubkeyB58")
                    }
                    if (!phantomDappSecretKeyB58.isNullOrEmpty()) {
                        editor.putString("phantomDappSecretKeyB58", phantomDappSecretKeyB58)
                    } else {
                        editor.remove("phantomDappSecretKeyB58")
                    }
                    if (!phantomDappPublicKeyB58.isNullOrEmpty()) {
                        editor.putString("phantomDappPublicKeyB58", phantomDappPublicKeyB58)
                    } else {
                        editor.remove("phantomDappPublicKeyB58")
                    }
                    editor.apply()
                    result.success(null)
                }

                "loadSession" -> {
                    val walletId = prefs.getString("walletId", null)
                    val address = prefs.getString("address", null)
                    val connectedAt = prefs.getString("connectedAtEpochMs", null)
                    if (walletId == null || address == null || connectedAt == null) {
                        result.success(null)
                    } else {
                        result.success(
                            mapOf(
                                "walletId" to walletId,
                                "address" to address,
                                "connectedAtEpochMs" to connectedAt,
                                "phantomSessionToken" to prefs.getString("phantomSessionToken", null),
                                "phantomWalletPubkeyB58" to prefs.getString("phantomWalletPubkeyB58", null),
                                "phantomDappSecretKeyB58" to prefs.getString("phantomDappSecretKeyB58", null),
                                "phantomDappPublicKeyB58" to prefs.getString("phantomDappPublicKeyB58", null)
                            )
                        )
                    }
                }

                "clearSession" -> {
                    prefs.edit().clear().apply()
                    result.success(null)
                }

                else -> result.notImplemented()
            }
        }
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        val data = intent?.dataString ?: return
        if (!data.startsWith("xmarket://wallet-callback")) {
            return
        }
        pendingLink = data
        deeplinkChannel?.invokeMethod("onDeepLink", data)
    }
}
