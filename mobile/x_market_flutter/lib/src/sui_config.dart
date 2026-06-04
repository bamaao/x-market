class SuiConfig {
  static const String network = 'testnet';
  static const String rpcUrl = 'https://fullnode.testnet.sui.io:443';

  static const String packageId =
      '0xe6be1520c8f4753928b8daf5e45ca485b3c67cd0ab136874b5705bcf24eac8c1';

  static const String usdcCoinType = '$packageId::usdc::USDC';

  static const String faucetPackageId =
      '0x70bb4f8ed11991f79dbafef255ad1881d169bb1e337b69b129d997dd4216ebf0';

  static const String suiClockId = '0x6';

  static const List<SeedPool> seedPools = [
    SeedPool(
      id: '0x858f4b3c22aa5add2053895e6d5246ded7aa7361356313eca3a8a30c060d9c71',
      label: '足球总进球 · Poisson',
      kind: 'poisson',
    ),
    SeedPool(
      id: '0xf5d1283915bc14e54b016cd1df263cb6f0775b84b40f2aff3262005300446dae',
      label: '胜平负 · Dirichlet',
      kind: 'dirichlet',
    ),
    SeedPool(
      id: '0x694b31b28219505e1c92f628132eec7b63694f688da8ede7d3a2d136941931cf',
      label: 'CPI 区间 · Normal',
      kind: 'normal',
    ),
  ];
}

class SeedPool {
  const SeedPool({required this.id, required this.label, required this.kind});

  final String id;
  final String label;
  final String kind;
}
