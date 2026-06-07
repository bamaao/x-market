# X-Market Mobile（Flutter）

Sui Testnet 预测市场 **产品化 Mobile 客户端**，对齐 Web 端核心能力。

## 功能

| Tab | 能力 |
| --- | --- |
| **市场** | 种子池列表 → 详情（交易 / LP / 拍卖） |
| **持仓** | 列出 `Position`，结算后领取赔付 |
| **LP** | 列出 `LpShare`，按 Pool 赎回 |
| **保证金** | 开户、登记/取消持仓、账户列表 |
| **钱包** | Phantom 连接、USDC 余额、Testnet Faucet |

### 链上交易（Phantom signAndSend）

- 买入：全部 `buy_*`（Poisson / Dirichlet / Normal）
- LP：`deposit_liquidity` / `withdraw_liquidity`
- 拍卖：`auction_bid` / `finalize_*_auction`
- 结算：`claim_position`
- 保证金：`open_account` / `register_position` / `unregister_position`
- Faucet：`mint_to_sender`

### 技术栈

- Flutter + Material 3
- `flutter_rust_bridge`：Phantom X25519 加解密
- `sui` Dart SDK：PTB 构建与 RPC
- `url_launcher`：一键打开 Phantom Deeplink

## 架构

```
lib/
├── main.dart
└── src/
    ├── app/           # AppController、底部导航 Shell
    ├── screens/       # 市场、持仓、LP、保证金、钱包
    ├── services/      # RPC、Owned Objects、Chain TX
    ├── wallet/        # PhantomWalletController、Deep Link
    ├── trade/         # ChainTransactionService
    └── theme/
```

## 本地运行

```bash
cd mobile/x_market_flutter
flutter pub get
flutter run
```

Android Release：

```bash
flutter build apk --release
# 输出: build/app/outputs/flutter-apk/app-release.apk
```

## Phantom 联调

1. **钱包** Tab → 连接 Phantom（自动打开钱包 App）
2. 铸造测试 USDC（Testnet Faucet）
3. **市场** → 选择池 → 交易 / LP / 拍卖
4. 签名后自动回到 App（`xmarket://wallet-callback`）

## 重新生成 FRB

```bash
flutter_rust_bridge_codegen generate
```

## 已知限制

- 仅 Phantom 完整联调；OKX/Slush 为模板
- Release 包当前使用 debug 签名（上架需配置 keystore）
- 持仓领取需手动填写 Pool ID（与 Web 一致）
- 网络配置由 `scripts/bootstrap-mobile-env.ps1` 生成（支持 `-Network mainnet`）
