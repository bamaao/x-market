import 'package:flutter/material.dart';
import 'package:x_market_flutter/src/app/x_market_app.dart';
import 'package:x_market_flutter/src/rust/frb_generated.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await RustLib.init();
  runApp(const XMarketApp());
}
