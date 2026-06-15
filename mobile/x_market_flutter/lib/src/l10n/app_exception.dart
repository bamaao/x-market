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

/// Stable error codes for service-layer exceptions; localize via [localizeError].
class AppException implements Exception {
  const AppException(this.code, {this.args = const {}});

  final String code;
  final Map<String, Object?> args;

  @override
  String toString() => code;
}

abstract final class AppErrorCodes {
  static const invalidAmount = 'invalidAmount';
  static const maxDecimals = 'maxDecimals';
  static const amountMustBePositive = 'amountMustBePositive';
  static const noUsdcInWallet = 'noUsdcInWallet';
  static const insufficientUsdc = 'insufficientUsdc';
  static const structuredNoteCap = 'structuredNoteCap';
  static const rangeNoteBounds = 'rangeNoteBounds';
  static const unsupportedMarketKind = 'unsupportedMarketKind';
  static const noDigest = 'noDigest';
  static const prophetRegistryNotConfigured = 'prophetRegistryNotConfigured';
  static const indexerNotConfigured = 'indexerNotConfigured';
  static const emptyPoolId = 'emptyPoolId';
  static const emptyBlob = 'emptyBlob';
  static const blobTooLarge = 'blobTooLarge';
  static const indexerUploadFailed = 'indexerUploadFailed';
  static const invalidIndexerResponse = 'invalidIndexerResponse';
  static const missingBlobId = 'missingBlobId';
  static const indexerBlobReadFailed = 'indexerBlobReadFailed';
  static const ipfsReadFailed = 'ipfsReadFailed';
  static const unsupportedBlobId = 'unsupportedBlobId';
  static const gasStationNotConfigured = 'gasStationNotConfigured';
  static const gasStationHttpError = 'gasStationHttpError';
  static const gasStationInvalidResponse = 'gasStationInvalidResponse';
  static const invalidAddress = 'invalidAddress';
  static const rpcHttpFailed = 'rpcHttpFailed';
  static const rpcError = 'rpcError';
  static const rpcInvalidResponse = 'rpcInvalidResponse';
  static const rpcMissingField = 'rpcMissingField';
  static const callbackMissingSigOrTx = 'callbackMissingSigOrTx';
}
