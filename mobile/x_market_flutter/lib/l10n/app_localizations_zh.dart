// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Chinese (`zh`).
class AppLocalizationsZh extends AppLocalizations {
  AppLocalizationsZh([String locale = 'zh']) : super(locale);

  @override
  String get appTitle => 'X-Market';

  @override
  String get navMarkets => '市场';

  @override
  String get navPositions => '持仓';

  @override
  String get navLp => 'LP';

  @override
  String get navProphet => 'Prophet';

  @override
  String get navMargin => '保证金';

  @override
  String get navWallet => '钱包';

  @override
  String get indexerOfflineUsingSeeds => 'Indexer 离线 · 使用种子池配置';

  @override
  String get indexerApiLive => 'Indexer API 实时同步';

  @override
  String get seedsNoIndexerMetadata => '种子池配置（Indexer 无匹配元数据）';

  @override
  String collateralUsdcFee(String amount, int feeBps) {
    return '抵押 $amount USDC · fee $feeBps bps';
  }

  @override
  String get connectPhantomToTrade => '连接 Phantom 钱包以交易';

  @override
  String get connect => '连接';

  @override
  String get noPositions => '暂无持仓';

  @override
  String get claimed => '已领取';

  @override
  String get missingPoolId => '无法关联 Pool ID（链上 market_id 缺失）';

  @override
  String get claimPayout => '领取赔付';

  @override
  String get noLpShares => '暂无 LP 份额';

  @override
  String lpShares(String amount) {
    return '份额 $amount';
  }

  @override
  String get redeemLp => '赎回 LP';

  @override
  String get phantomWallet => 'Phantom 钱包';

  @override
  String get notConnectedTestnet => '未连接 · Testnet';

  @override
  String get disconnect => '断开连接';

  @override
  String get connectPhantom => '连接 Phantom';

  @override
  String get testnetUsdcHint => '测试网 USDC 请从 Circle 水龙头领取或转入钱包';

  @override
  String get refreshBalanceAndAssets => '刷新余额与资产';

  @override
  String recentTx(String message) {
    return '最近: $message';
  }

  @override
  String testnetYear(int year) {
    return 'Testnet · $year';
  }

  @override
  String get crossMarginVarTitle => 'Cross-Margin VaR（估算）';

  @override
  String crossMarginVarWithPositions(int count) {
    return '基于 $count 个持仓，15 个 outcome slot 最坏情景聚合';
  }

  @override
  String get crossMarginVarDefault => '基于 15 个 outcome slot 最坏情景聚合';

  @override
  String get marginVarSubtitle => '钱包持仓组合估算；登记到保证金账户后以链上 liability 为准';

  @override
  String get marketForOpenAccount => '市场（开户）';

  @override
  String get openMarginAccount => '开设保证金账户';

  @override
  String get marginAccountIdHint => '点击下方账户卡片自动填入';

  @override
  String get positionSamePool => '持仓（同池）';

  @override
  String get registerPosition => '登记持仓';

  @override
  String get unregisterPosition => '取消登记';

  @override
  String marginAccountSummary(
    int count,
    String gross,
    String worst,
    String id,
  ) {
    return '持仓 $count · Gross $gross USDC · Worst $worst USDC\n$id';
  }

  @override
  String get tabTrade => '交易';

  @override
  String get tabAuction => '拍卖';

  @override
  String get gasStationEnabled => 'Gas Station 已启用：交易 Gas 由赞助方代付（USDC 仍自付）';

  @override
  String get gasStationOffline => 'Gas Station 离线：Gas 将从钱包 SUI 扣除';

  @override
  String get outcome012 => '结果 0/1/2';

  @override
  String get contractType => '合约类型';

  @override
  String get stakeUsdc => 'Stake (USDC)';

  @override
  String get lowerBoundPermille => '下界 ‰';

  @override
  String get upperBoundPermille => '上界 ‰';

  @override
  String get lowerBound => '下界';

  @override
  String get upperBound => '上界';

  @override
  String get threshold => '阈值';

  @override
  String get strikeK => '执行价 K';

  @override
  String get barrierB => '障碍 B';

  @override
  String get subscribeUsdc => '申购 USDC';

  @override
  String get lpSubscribe => 'LP 申购';

  @override
  String get auctionNotSupported => '该市场不支持 Opening Auction';

  @override
  String get bucketIndex => '桶索引 bucket';

  @override
  String get bidUsdc => '出价 USDC';

  @override
  String get auctionBid => '拍卖出价';

  @override
  String get finalizeAuction => '定标 finalize_auction';

  @override
  String get quoteBetaUnsupported => '定价预览：Beta / exotic 合约暂不支持 Pricing Engine';

  @override
  String get quoteUnavailable => '定价预览不可用（Pricing Engine 离线或未配置）';

  @override
  String get quoteTitle => '定价预览（链下估算）';

  @override
  String quoteWinProb(String percent) {
    return '胜率约 $percent%';
  }

  @override
  String quotePayout(String amount) {
    return '命中兑付约 $amount USDC';
  }

  @override
  String quoteImpliedRoi(String roi) {
    return '隐含 ROI $roi%';
  }

  @override
  String get buyWithGasSponsor => 'Phantom 签名并买入（Gas 赞助）';

  @override
  String get buyWithPhantom => 'Phantom 签名并买入';

  @override
  String get contractInterval => '区间合约';

  @override
  String get contractDigital => '数字期权';

  @override
  String get contractLinearCall => '线性 Call';

  @override
  String get contractLinearPut => '线性 Put';

  @override
  String get tabPublish => '发布';

  @override
  String get tabLeaderboard => '排行榜';

  @override
  String get selectMarket => '请选择市场';

  @override
  String get cannotSubmit => '不可提交';

  @override
  String get fillAnalysis => '请填写分析内容';

  @override
  String get predictedValueMustBeInt => '预测值须为整数';

  @override
  String get committingProphecy => 'Indexer 上传明文 → 链上 Commit…';

  @override
  String myStats(int wins, int losses, String score, int audited) {
    return '我的战绩：$wins胜 $losses负 · Score $score · 已审计 $audited';
  }

  @override
  String get targetMarket => '目标市场';

  @override
  String get predictedValue => '预测值';

  @override
  String predictedValueHelper(String kind) {
    return '与 $kind 分布结算单位一致';
  }

  @override
  String get exclusiveAnalysis => '独家分析（明文）';

  @override
  String get mobileP3Hint =>
      'Mobile P3：仅支持公开练手（unlock_price=0）。付费 Seal 加密预测请使用 Web /prophet。';

  @override
  String get processing => '处理中…';

  @override
  String get commitPublicProphecy => 'Indexer 明文 → Commit 公开预测';

  @override
  String get poolProphecies => '本市场预测';

  @override
  String get noProphecies => '暂无预测';

  @override
  String get selectProphecy => '选择预测';

  @override
  String prophecyStatus(String status) {
    return '状态：$status';
  }

  @override
  String prophecyValue(String value) {
    return '预测值：$value';
  }

  @override
  String get prophecyPublicReadable => '公开可读';

  @override
  String get prophecyPrivateWeb => '私密（需 Web 解锁/Seal）';

  @override
  String get analysisContent => '分析内容';

  @override
  String get leaderboardEmpty => 'Indexer 离线或无排行数据';

  @override
  String leaderboardMe(String address) {
    return '我 ($address…)';
  }

  @override
  String leaderboardRow(int wins, int losses, String score, String paid) {
    return '$wins胜 $losses负 · Score $score$paid';
  }

  @override
  String get paidUnlockEnabled => ' · 付费已开通';

  @override
  String get prophecyStatusOpen => '开放';

  @override
  String get prophecyStatusWin => '审计·胜';

  @override
  String get prophecyStatusLoss => '审计·负';

  @override
  String get prophecyStatusCheat => '作弊';

  @override
  String prophecyStatusUnknown(int status) {
    return '未知($status)';
  }

  @override
  String paidUnlockHintNew(int minAudited, String minScore) {
    return '新预言家须先发布免费预测（unlock_price=0），完成 ≥$minAudited 场审计且 Score ≥ $minScore 后方可开通付费';
  }

  @override
  String get paidUnlockHintCheat => '存在作弊记录，暂不可开通付费解锁';

  @override
  String paidUnlockHintProgress(int audited, int required) {
    return '已审计 $audited/$required 场，继续免费练手预测以积累战绩';
  }

  @override
  String paidUnlockHintScore(String score, String minScore) {
    return 'Prophet Score $score，需 ≥ $minScore 方可开通付费';
  }

  @override
  String get paidUnlockHintEligible =>
      '已满足付费开通条件，可设置 unlock_price > 0（Mobile 暂请用 Web App 发 Seal 加密预测）';

  @override
  String get eligibilityNoPoolId => '未配置 Pool ID';

  @override
  String get eligibilityMarketResolved => '市场已结算，不可再提交预测';

  @override
  String get eligibilityMarketPaused => '市场已暂停';

  @override
  String get eligibilityExpired => '已过到期时间，不可提交预测';

  @override
  String eligibilityTooClose(int minutes) {
    return '距到期不足 $minutes 分钟，不可提交预测';
  }

  @override
  String get eligibilityCanCommit => '可提交公开预测（unlock_price=0）';

  @override
  String get connectWalletFirst => '请先连接钱包';

  @override
  String gasSponsorFallback(String error) {
    return 'Gas 赞助不可用，改用自付 Gas：$error';
  }

  @override
  String get unknownMarket => '未知市场';

  @override
  String get walletSessionRestored => '已恢复 Phantom 会话';

  @override
  String get openingPhantom => '正在打开 Phantom…';

  @override
  String connectPhantomFailed(String error) {
    return '连接 Phantom 失败: $error';
  }

  @override
  String get connectPhantomWalletFirst => '请先连接 Phantom 钱包';

  @override
  String waitingPhantomConfirm(String description) {
    return '等待 Phantom 确认: $description';
  }

  @override
  String submitTxFailed(String error) {
    return '提交交易失败: $error';
  }

  @override
  String callbackFailed(String error) {
    return '处理回调失败: $error';
  }

  @override
  String get walletDisconnected => '已断开钱包';

  @override
  String phantomConnected(String address) {
    return 'Phantom 已连接: $address';
  }

  @override
  String txSuccess(String digest) {
    return '交易成功: $digest';
  }

  @override
  String get phantomBroadcastNoDigest => 'Phantom 已广播（未返回 digest）';

  @override
  String get missingPendingTx => '缺少 pending 交易';

  @override
  String get cannotOpenPhantom => '无法打开 Phantom，请确认已安装钱包';

  @override
  String get txClaimPosition => '领取 Position';

  @override
  String get txLpDeposit => 'LP 申购';

  @override
  String get txLpWithdraw => 'LP 赎回';

  @override
  String get txAuctionBid => '拍卖出价';

  @override
  String get txFinalizeAuction => '拍卖定标';

  @override
  String get txOpenMarginAccount => '开设保证金账户';

  @override
  String get txRegisterPosition => '登记持仓';

  @override
  String get txUnregisterPosition => '取消登记';

  @override
  String get txCommitProphecy => 'Commit 公开预测';

  @override
  String get errInvalidAmount => '无效金额';

  @override
  String errMaxDecimals(int decimals) {
    return '最多 $decimals 位小数';
  }

  @override
  String get errAmountMustBePositive => '金额须大于 0';

  @override
  String get errNoUsdcInWallet => '钱包中没有 USDC，请先转入或领取测试网 USDC';

  @override
  String errInsufficientUsdc(String need, String have) {
    return 'USDC 不足：需要 $need，持有 $have';
  }

  @override
  String get errStructuredNoteCap => 'Structured Note 需要 C > K';

  @override
  String get errRangeNoteBounds => 'Range Note 需要 U >= L';

  @override
  String errUnsupportedMarketKind(String kind) {
    return '不支持的市场类型: $kind';
  }

  @override
  String get errNoDigest => '执行成功但未返回 digest';

  @override
  String get errProphetRegistryNotConfigured => '未配置 ProphetRegistry';

  @override
  String get errIndexerNotConfigured => 'Indexer 未配置';

  @override
  String get errEmptyPoolId => 'pool_id 为空';

  @override
  String get errEmptyBlob => '空 blob';

  @override
  String get errBlobTooLarge => 'blob 超过 512KB';

  @override
  String errIndexerUploadFailed(int status, String body) {
    return 'Indexer 上传失败 ($status): $body';
  }

  @override
  String get errInvalidIndexerResponse => 'Indexer 响应无效';

  @override
  String get errMissingBlobId => 'Indexer 响应缺少 blob_id';

  @override
  String errIndexerBlobReadFailed(int status) {
    return 'Indexer blob 读取失败 ($status)';
  }

  @override
  String errIpfsReadFailed(int status) {
    return 'IPFS 读取失败 ($status)';
  }

  @override
  String get errUnsupportedBlobId => '不支持的 blob_id（需 idx: 或 ipfs:）';

  @override
  String get errGasStationNotConfigured => 'Gas Station 未配置';

  @override
  String errGasStationHttpError(String error) {
    return 'Gas Station 错误: $error';
  }

  @override
  String get errGasStationInvalidResponse => 'Gas Station 响应格式异常';

  @override
  String get errInvalidAddress => '地址格式错误（需要 0x 开头 16 进制）';

  @override
  String errRpcHttpFailed(int status) {
    return 'RPC 请求失败: HTTP $status';
  }

  @override
  String errRpcError(String error) {
    return 'RPC 返回错误: $error';
  }

  @override
  String get errRpcInvalidResponse => 'RPC 响应格式异常';

  @override
  String errRpcMissingField(String field) {
    return '缺少字段: $field';
  }

  @override
  String get errCallbackMissingSigOrTx => '回调缺少 signature 或 transaction';

  @override
  String get seedPoissonGoalsTitle => '足球总进球 · Poisson';

  @override
  String get seedDirichletWdlTitle => '胜平负 · Dirichlet';

  @override
  String get seedNormalCpiTitle => 'CPI 区间 · Normal';

  @override
  String get seedBetaVoteTitle => '得票率 · Beta';
}
