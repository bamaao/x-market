/**
 * Generate X-Market on Sui presentation decks (ZH + EN)
 * Focus: business value, market opportunity, solution, performance/security/reliability/usability
 * Usage: node scripts/generate-presentation.js
 */
const pptxgen = require("pptxgenjs");
const path = require("path");
const fs = require("fs");

const OUT_DIR = path.join(__dirname, "..", "docs", "presentations");
fs.mkdirSync(OUT_DIR, { recursive: true });

const C = {
  navy: "21295C",
  deep: "065A82",
  teal: "1C7293",
  mint: "02C39A",
  ice: "CADCFC",
  white: "FFFFFF",
  light: "F0F7FA",
  slate: "64748B",
  darkText: "1E293B",
  coral: "F96167",
  gold: "F9E795",
};

function makeShadow() {
  return { type: "outer", color: "000000", blur: 4, offset: 2, angle: 135, opacity: 0.12 };
}

function addHeaderBar(slide, pres, title, subtitle) {
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.05, fill: { color: C.deep } });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 1.05, w: 10, h: 0.06, fill: { color: C.mint } });
  slide.addText(title, {
    x: 0.5, y: 0.18, w: 9, h: 0.55,
    fontSize: 28, fontFace: "Arial", bold: true, color: C.white, margin: 0,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5, y: 0.68, w: 9, h: 0.3,
      fontSize: 12, fontFace: "Arial", color: C.ice, margin: 0,
    });
  }
}

function addCard(slide, pres, x, y, w, h, title, lines, accentColor) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h, fill: { color: C.white }, line: { color: "E2E8F0", width: 1 }, shadow: makeShadow(),
  });
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.08, h, fill: { color: accentColor || C.teal } });
  slide.addText(title, {
    x: x + 0.2, y: y + 0.12, w: w - 0.3, h: 0.35,
    fontSize: 14, fontFace: "Arial", bold: true, color: C.deep, margin: 0,
  });
  const bulletItems = lines.map((t, i) => ({
    text: t,
    options: { bullet: true, breakLine: i < lines.length - 1, fontSize: 11, color: C.darkText },
  }));
  slide.addText(bulletItems, {
    x: x + 0.2, y: y + 0.48, w: w - 0.35, h: h - 0.55, fontFace: "Arial", valign: "top",
  });
}

function addStatBox(slide, pres, x, y, w, value, label, color) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 1.15, fill: { color: color || C.deep } });
  slide.addText(value, {
    x, y: y + 0.1, w, h: 0.55,
    fontSize: 28, fontFace: "Arial", bold: true, color: C.white, align: "center", margin: 0,
  });
  slide.addText(label, {
    x, y: y + 0.62, w, h: 0.45,
    fontSize: 10, fontFace: "Arial", color: C.ice, align: "center", margin: 0,
  });
}

function addPillarSlide(slide, pres, header, sub, pillars, isZh = true) {
  slide.background = { color: C.light };
  addHeaderBar(slide, pres, header, sub);
  const slideH = 5.625;
  const contentTop = 1.18;
  const bottomMargin = 0.12;
  const colGap = 4.8;
  const cardW = 4.4;
  const rowGap = 0.08;
  const rows = Math.ceil(pillars.length / 2);
  const cardH = (slideH - contentTop - bottomMargin - rowGap * (rows - 1)) / rows;
  const titleFontSize = isZh ? 14 : 11;
  const titleH = isZh ? 0.36 : 0.46;
  const itemFontSize = isZh ? 10 : 7.5;
  const itemsTop = isZh ? 0.56 : 0.64;
  const itemsH = cardH - itemsTop - 0.08;
  pillars.forEach((p, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.4 + col * colGap;
    const y = contentTop + row * (cardH + rowGap);
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cardW, h: cardH,
      fill: { color: C.white }, line: { color: "E2E8F0", width: 1 }, shadow: makeShadow(),
    });
    slide.addShape(pres.shapes.OVAL, {
      x: x + 0.18, y: y + 0.16, w: 0.5, h: 0.5, fill: { color: p.color },
    });
    slide.addText(p.icon, {
      x: x + 0.18, y: y + 0.16, w: 0.5, h: 0.5,
      fontSize: 14, align: "center", valign: "middle", margin: 0,
    });
    slide.addText(p.title, {
      x: x + 0.78, y: y + 0.12, w: cardW - 0.88, h: titleH,
      fontSize: titleFontSize, fontFace: "Arial", bold: true, color: C.deep, margin: 0, valign: "top",
    });
    const items = p.items.map((item, j) => ({
      text: item,
      options: { bullet: true, breakLine: j < p.items.length - 1, fontSize: itemFontSize, color: C.darkText },
    }));
    slide.addText(items, {
      x: x + 0.16, y: y + itemsTop, w: cardW - 0.28, h: itemsH,
      fontFace: "Arial", valign: "top", margin: 0,
    });
  });
}

function buildDeck(lang) {
  const isZh = lang === "zh";
  const content = isZh ? getZhContent() : getEnContent();
  const t = content.meta;

  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = "X-Market Team";
  pres.title = t.title;
  pres.subject = t.subtitle;

  // ── 1 Title ──
  let slide = pres.addSlide();
  slide.background = { color: C.navy };
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 4.75, w: 10, h: 0.85, fill: { color: C.deep, transparency: 30 } });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.5, w: 0.12, h: 2.4, fill: { color: C.mint } });
  slide.addText(t.title, {
    x: 0.85, y: 1.4, w: 8.5, h: 0.9,
    fontSize: 42, fontFace: "Arial", bold: true, color: C.white, margin: 0,
  });
  slide.addText(t.subtitle, {
    x: 0.85, y: 2.3, w: 8.5, h: 0.55,
    fontSize: 18, fontFace: "Arial", color: C.ice, margin: 0,
  });
  slide.addText(t.tagline, {
    x: 0.85, y: 3.0, w: 8.5, h: 0.65,
    fontSize: 13, fontFace: "Arial", italic: true, color: C.mint, margin: 0,
  });
  slide.addText(t.date, {
    x: 0.85, y: 4.95, w: 8, h: 0.4, fontSize: 11, fontFace: "Arial", color: C.ice, margin: 0,
  });

  // ── 2 Market Pain ──
  slide = pres.addSlide();
  slide.background = { color: C.light };
  addHeaderBar(slide, pres, t.pain.title, t.pain.sub);
  content.pain.problems.forEach((p, i) => {
    const y = 1.35 + i * 1.25;
    slide.addShape(pres.shapes.RECTANGLE, { x: 0.4, y, w: 0.08, h: 1.0, fill: { color: C.coral } });
    slide.addText(p.title, {
      x: 0.65, y: y + 0.05, w: 8.8, h: 0.35,
      fontSize: 14, fontFace: "Arial", bold: true, color: C.deep, margin: 0,
    });
    slide.addText(p.desc, {
      x: 0.65, y: y + 0.42, w: 8.8, h: 0.55,
      fontSize: 11, fontFace: "Arial", color: C.darkText, margin: 0,
    });
  });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 4.85, w: 9.2, h: 0.55, fill: { color: C.navy } });
  slide.addText(content.pain.insight, {
    x: 0.55, y: 4.95, w: 8.9, h: 0.4,
    fontSize: 11, fontFace: "Arial", bold: true, color: C.mint, margin: 0,
  });

  // ── 3 Market Opportunity ──
  slide = pres.addSlide();
  slide.background = { color: C.light };
  addHeaderBar(slide, pres, t.opportunity.title, t.opportunity.sub);
  content.opportunity.segments.forEach((seg, i) => {
    const x = 0.35 + i * 3.15;
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.35, w: 2.95, h: 3.55,
      fill: { color: C.white }, line: { color: "E2E8F0", width: 1 }, shadow: makeShadow(),
    });
    slide.addShape(pres.shapes.RECTANGLE, { x, y: 1.35, w: 2.95, h: 0.7, fill: { color: [C.deep, C.teal, C.mint][i] } });
    slide.addText(seg.name, {
      x, y: 1.48, w: 2.95, h: 0.45,
      fontSize: 13, fontFace: "Arial", bold: true, color: C.white, align: "center", margin: 0,
    });
    slide.addText(seg.size, {
      x: x + 0.15, y: 2.2, w: 2.65, h: 0.55,
      fontSize: 22, fontFace: "Arial", bold: true, color: C.deep, align: "center", margin: 0,
    });
    slide.addText(seg.sizeLabel, {
      x: x + 0.15, y: 2.75, w: 2.65, h: 0.3,
      fontSize: 9, fontFace: "Arial", color: C.slate, align: "center", margin: 0,
    });
    const items = seg.items.map((item, j) => ({
      text: item,
      options: { bullet: true, breakLine: j < seg.items.length - 1, fontSize: 9, color: C.darkText },
    }));
    slide.addText(items, { x: x + 0.12, y: 3.15, w: 2.7, h: 1.6, fontFace: "Arial", valign: "top" });
  });
  slide.addText(content.opportunity.note, {
    x: 0.4, y: 5.05, w: 9.2, h: 0.35,
    fontSize: 9, fontFace: "Arial", italic: true, color: C.slate, margin: 0,
  });

  // ── 4 Business Value ──
  slide = pres.addSlide();
  slide.background = { color: C.light };
  addHeaderBar(slide, pres, t.value.title, t.value.sub);
  const stakeholders = content.value.stakeholders;
  const valueSlideH = 5.625;
  const valueTop = 1.18;
  const valueBottom = 0.12;
  const valueGap = 0.06;
  const roleW = 1.65;
  const roleX = 0.35;
  const panelX = roleX + roleW + 0.1;
  const panelW = 10 - roleX - panelX;
  const valueRowH = (valueSlideH - valueTop - valueBottom - valueGap * (stakeholders.length - 1)) / stakeholders.length;
  const benefitSize = isZh ? 9 : 9.5;
  const detailSize = isZh ? 7.5 : 8;
  stakeholders.forEach((s, i) => {
    const y = valueTop + i * (valueRowH + valueGap);
    slide.addShape(pres.shapes.RECTANGLE, { x: roleX, y, w: roleW, h: valueRowH, fill: { color: [C.deep, C.teal, C.mint, C.navy][i] } });
    slide.addText(s.role, {
      x: roleX, y, w: roleW, h: valueRowH,
      fontSize: isZh ? 10 : 10, fontFace: "Arial", bold: true, color: C.white, align: "center", valign: "middle", margin: 0,
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: panelX, y, w: panelW, h: valueRowH,
      fill: { color: C.white }, line: { color: "E2E8F0", width: 1 },
    });
    slide.addText(s.benefit, {
      x: panelX + 0.1, y: y + 0.06, w: panelW - 0.2, h: valueRowH * 0.38,
      fontSize: benefitSize, fontFace: "Arial", bold: true, color: C.deep, margin: 0, valign: "top",
    });
    slide.addText(s.detail, {
      x: panelX + 0.1, y: y + 0.06 + valueRowH * 0.38, w: panelW - 0.2, h: valueRowH * 0.56,
      fontSize: detailSize, fontFace: "Arial", color: C.slate, margin: 0, valign: "top",
    });
  });

  // ── 5 Solution Overview ──
  slide = pres.addSlide();
  slide.background = { color: C.light };
  addHeaderBar(slide, pres, t.solution.title, t.solution.sub);
  addCard(slide, pres, 0.4, 1.3, 4.4, 2.2, content.solution.leftTitle, content.solution.left, C.teal);
  addCard(slide, pres, 5.2, 1.3, 4.4, 2.2, content.solution.rightTitle, content.solution.right, C.mint);
  content.solution.flow.forEach((step, i) => {
    const x = 0.5 + i * 3.1;
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: 3.75, w: 2.7, h: 1.55,
      fill: { color: C.white }, line: { color: C.mint, width: 1.5 }, shadow: makeShadow(),
    });
    slide.addText(step, {
      x: x + 0.1, y: 3.9, w: 2.5, h: 1.25,
      fontSize: 10, fontFace: "Arial", color: C.darkText, align: "center", valign: "middle", margin: 0,
    });
    if (i < 2) {
      slide.addText("→", { x: x + 2.75, y: 4.3, w: 0.35, h: 0.4, fontSize: 20, color: C.mint, align: "center", margin: 0 });
    }
  });

  // ── 6 Tech Differentiation ──
  slide = pres.addSlide();
  slide.background = { color: C.light };
  addHeaderBar(slide, pres, t.techDiff.title, t.techDiff.sub);
  const compareRows = [
    [
      { text: content.techDiff.headers[0], options: { bold: true, fill: { color: C.slate }, color: C.white } },
      { text: content.techDiff.headers[1], options: { bold: true, fill: { color: C.coral }, color: C.white } },
      { text: content.techDiff.headers[2], options: { bold: true, fill: { color: C.mint }, color: C.white } },
    ],
    ...content.techDiff.rows.map((r, i) => r.map(cell => ({
      text: cell,
      options: { fill: { color: i % 2 === 0 ? C.white : "F8FAFC" }, fontSize: 10 },
    }))),
  ];
  slide.addTable(compareRows, {
    x: 0.4, y: 1.35, w: 9.2, colW: [2.0, 3.5, 3.7],
    border: { pt: 0.5, color: "E2E8F0" }, fontFace: "Arial",
  });
  addCard(slide, pres, 0.4, 4.15, 9.2, 1.0, content.techDiff.highlightTitle, content.techDiff.highlight, C.deep);

  // ── 7 Performance ──
  addPillarSlide(
    pres.addSlide(), pres,
    t.performance.title, t.performance.sub,
    content.performance.pillars, isZh
  );

  // ── 8 Security ──
  addPillarSlide(
    pres.addSlide(), pres,
    t.security.title, t.security.sub,
    content.security.pillars, isZh
  );

  // ── 9 Reliability ──
  addPillarSlide(
    pres.addSlide(), pres,
    t.reliability.title, t.reliability.sub,
    content.reliability.pillars, isZh
  );

  // ── 10 Usability ──
  addPillarSlide(
    pres.addSlide(), pres,
    t.usability.title, t.usability.sub,
    content.usability.pillars, isZh
  );

  // ── 11 Business Model ──
  slide = pres.addSlide();
  slide.background = { color: C.light };
  addHeaderBar(slide, pres, t.business.title, t.business.sub);
  content.business.streams.forEach((s, i) => {
    const x = 0.4 + i * 3.15;
    addStatBox(slide, pres, x, 1.35, 2.95, s.metric, s.label, [C.deep, C.teal, C.mint][i]);
  });
  addCard(slide, pres, 0.4, 2.7, 4.4, 2.5, content.business.leftTitle, content.business.left, C.teal);
  addCard(slide, pres, 5.2, 2.7, 4.4, 2.5, content.business.rightTitle, content.business.right, C.deep);

  // ── 12 Traction ──
  slide = pres.addSlide();
  slide.background = { color: C.light };
  addHeaderBar(slide, pres, t.traction.title, t.traction.sub);
  content.traction.stats.forEach((s, i) => {
    addStatBox(slide, pres, 0.4 + i * 2.35, 1.35, 2.15, s.value, s.label, [C.deep, C.teal, C.mint, C.navy][i]);
  });
  const statusRows = [
    [
      { text: content.traction.headers[0], options: { bold: true, fill: { color: C.deep }, color: C.white } },
      { text: content.traction.headers[1], options: { bold: true, fill: { color: C.deep }, color: C.white } },
    ],
    ...content.traction.rows.map((r, i) => [
      { text: r[0], options: { fill: { color: i % 2 === 0 ? C.white : "F8FAFC" }, fontSize: 10 } },
      { text: r[1], options: { fill: { color: i % 2 === 0 ? C.white : "F8FAFC" }, fontSize: 10, color: "16A34A", bold: true } },
    ]),
  ];
  slide.addTable(statusRows, {
    x: 0.4, y: 2.65, w: 9.2, colW: [7.5, 1.7],
    border: { pt: 0.5, color: "E2E8F0" }, fontFace: "Arial",
  });

  // ── 13 Future Direction ──
  addPillarSlide(
    pres.addSlide(), pres,
    t.future.title, t.future.sub,
    content.future.pillars, isZh
  );

  // ── 14 Roadmap ──
  slide = pres.addSlide();
  slide.background = { color: C.light };
  addHeaderBar(slide, pres, t.roadmap.title, t.roadmap.sub);
  const phases = content.roadmap.phases;
  const slideW = 10;
  const slideH = 5.625;
  const marginX = 0.25;
  const gap = 0.08;
  const cardW = (slideW - marginX * 2 - gap * (phases.length - 1)) / phases.length;
  const cardTop = 1.2;
  const noteH = 0.3;
  const noteGap = 0.06;
  const cardH = slideH - cardTop - noteH - noteGap - 0.12;
  const itemFontSize = isZh ? 7 : 7.5;
  phases.forEach((phase, i) => {
    const x = marginX + i * (cardW + gap);
    const statusColor = phase.done ? "16A34A" : phase.active ? C.teal : C.slate;
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: cardTop, w: cardW, h: cardH,
      fill: { color: phase.done || phase.active ? C.white : "F1F5F9" },
      line: { color: phase.done ? C.mint : phase.active ? C.teal : "CBD5E1", width: phase.done || phase.active ? 2 : 1 },
      shadow: phase.done || phase.active ? makeShadow() : undefined,
    });
    slide.addText(phase.name, {
      x, y: cardTop + 0.12, w: cardW, h: 0.32,
      fontSize: 9, fontFace: "Arial", bold: true, color: C.deep, align: "center", margin: 0,
    });
    slide.addText(phase.status, {
      x, y: cardTop + 0.42, w: cardW, h: 0.26,
      fontSize: 7.5, fontFace: "Arial", color: statusColor, align: "center", margin: 0,
    });
    const items = phase.items.map((item, j) => ({
      text: item,
      options: { bullet: true, breakLine: j < phase.items.length - 1, fontSize: itemFontSize, color: C.darkText },
    }));
    slide.addText(items, {
      x: x + 0.06, y: cardTop + 0.72, w: cardW - 0.12, h: cardH - 0.82,
      fontFace: "Arial", valign: "top", margin: 0,
    });
  });
  slide.addText(content.roadmap.note, {
    x: marginX, y: cardTop + cardH + noteGap, w: slideW - marginX * 2, h: noteH,
    fontSize: 7.5, fontFace: "Arial", italic: true, color: C.slate, margin: 0,
  });

  // ── 15 KPI ──
  slide = pres.addSlide();
  slide.background = { color: C.light };
  addHeaderBar(slide, pres, t.kpi.title, t.kpi.sub);
  const kpiRows = [
    [
      { text: content.kpi.headers[0], options: { bold: true, fill: { color: C.deep }, color: C.white } },
      { text: content.kpi.headers[1], options: { bold: true, fill: { color: C.deep }, color: C.white } },
      { text: content.kpi.headers[2], options: { bold: true, fill: { color: C.deep }, color: C.white } },
    ],
    ...content.kpi.rows.map((r, i) => r.map((cell, j) => ({
      text: cell,
      options: {
        fill: { color: i % 2 === 0 ? C.white : "F8FAFC" },
        fontSize: 10,
        bold: j === 2,
        color: j === 2 ? C.teal : C.darkText,
      },
    }))),
  ];
  slide.addTable(kpiRows, {
    x: 0.4, y: 1.35, w: 9.2, colW: [2.0, 3.8, 3.4],
    border: { pt: 0.5, color: "E2E8F0" }, fontFace: "Arial",
  });
  addCard(slide, pres, 0.4, 3.55, 9.2, 1.85, content.kpi.visionTitle, content.kpi.vision, C.mint);

  // ── 16 Thank You ──
  slide = pres.addSlide();
  slide.background = { color: C.navy };
  slide.addShape(pres.shapes.RECTANGLE, { x: 3.5, y: 1.7, w: 3, h: 0.08, fill: { color: C.mint } });
  slide.addText(t.thanks.title, {
    x: 0.5, y: 1.9, w: 9, h: 0.8,
    fontSize: 38, fontFace: "Arial", bold: true, color: C.white, align: "center", margin: 0,
  });
  slide.addText(t.thanks.sub, {
    x: 0.5, y: 2.75, w: 9, h: 0.5,
    fontSize: 15, fontFace: "Arial", color: C.ice, align: "center", margin: 0,
  });
  slide.addText(content.thanks.summary, {
    x: 0.8, y: 3.5, w: 8.4, h: 1.3,
    fontSize: 12, fontFace: "Arial", color: C.mint, align: "center", margin: 0,
  });
  slide.addText(content.thanks.contact, {
    x: 0.5, y: 4.95, w: 9, h: 0.4,
    fontSize: 10, fontFace: "Arial", color: C.slate, align: "center", margin: 0,
  });

  const outSuffix = process.env.PPT_OUT_SUFFIX || "";
  const fileName = isZh
    ? path.join(OUT_DIR, `X-Market-Sui-Overview.zh${outSuffix}.pptx`)
    : path.join(OUT_DIR, `X-Market-Sui-Overview.en${outSuffix}.pptx`);

  return pres.writeFile({ fileName }).then(() => fileName);
}

function getZhContent() {
  return {
    meta: {
      title: "X-Market on Sui",
      subtitle: "概率分布衍生品 · 链上预测市场新范式",
      tagline: "从 Yes/No 博彩到 PDF 定价金融衍生品 — 博弈与知识付费共生",
      date: "2026年6月 · Testnet v2 已上线",
      pain: { title: "行业痛点", sub: "传统预测市场的结构性缺陷" },
      opportunity: { title: "市场机会", sub: "三大增量赛道与 X-Market 切入点" },
      value: { title: "业务价值", sub: "四方共赢的产品生态" },
      solution: { title: "解决方案", sub: "双模块共用 EventRoot · 统一 Oracle 结算" },
      techDiff: { title: "技术差异化", sub: "参数化 AMM vs 传统二元盘口" },
      performance: { title: "性能优势", sub: "Sui 并行架构 + 链上原子计算" },
      security: { title: "安全设计", sub: "多层风控 · 链上可验证" },
      reliability: { title: "可靠性保障", sub: "Oracle 终裁 · 状态机 · 运维体系" },
      usability: { title: "易用性体验", sub: "Web + Mobile · 稳定币原生 · 多端体验" },
      business: { title: "商业模式", sub: "协议收入与生态飞轮" },
      traction: { title: "进展与验证", sub: "Testnet v2 已落地能力" },
      future: { title: "未来发展方向", sub: "产品 · 生态 · 主网 · 规模化" },
      roadmap: { title: "分阶段规划", sub: "Phase 1–4 进展与 Mainnet 路径" },
      kpi: { title: "里程碑与 KPI", sub: "可量化增长目标" },
      thanks: { title: "谢谢", sub: "欢迎交流 · Questions & Discussion" },
    },
    pain: {
      problems: [
        { title: "二元碎片化 — 无法表达连续概率", desc: "Yes/No 代币把 CPI、进球数、选举份额等连续/离散变量拆成大量独立盘口，流动性分散、定价粗糙，机构无法对冲区间风险" },
        { title: "带单无审计 — KOL 战绩可伪造", desc: "Web2/Web3 带单生态缺乏链上不可篡改战绩；付费解锁后无法事后验证，虚假预言家泛滥，订阅者信任成本高" },
        { title: "中心化做市 — 大户被限仓", desc: "传统博彩平台是庄家 vs 散户模式，量化资金与机构套利空间被限仓/封号，链上缺乏真正的流动性池" },
        { title: "结算割裂 — 博弈与信息数据孤岛", desc: "下注结果与付费分析使用不同数据源和结算逻辑，同一事件的多维价值无法在同一根节点上聚合" },
      ],
      insight: "核心洞察：预测市场需要从「结果博彩」升级为「概率分布衍生品市场」— 交易方向、区间、波动率与结构化风险",
    },
    opportunity: {
      segments: [
        {
          name: "链上衍生品",
          size: "$50B+",
          sizeLabel: "DeFi 衍生品 TAM（2026）",
          items: ["参数化 AMM 承接机构对冲需求", "Normal/Poisson/Dirichlet 覆盖宏观·体育·选举", "Variance Swap 等 Phase 3 结构化产品"],
        },
        {
          name: "知识付费",
          size: "$300B+",
          sizeLabel: "全球付费内容市场",
          items: ["SuiProphet 链上战绩筛选真 KOL", "Seal 加密 + 事后强制公开审计", "USDC 即时解锁 · 知识资产代币化"],
        },
        {
          name: "预测市场",
          size: "高速增长",
          sizeLabel: "Polymarket 等验证 PMF",
          items: ["Circle USDC 原生结算降低摩擦", "Opening Auction 冷启动无需外部 LP", "Sui 并行执行支撑多市场并发"],
        },
      ],
      note: "X-Market 独占「概率衍生品 + 知识付费」双模块协同位 — 同一 EventRoot 绑定博弈与付费，数据不割裂",
    },
    value: {
      stakeholders: [
        { role: "交易者", benefit: "交易概率曲线而非碎片代币", detail: "区间/数字期权 · 结构化票据 · Max-Loss 风控 · 透明 PDF 定价" },
        { role: "LP 承销商", benefit: "赚滑点 + Theta + 错误定价本金", detail: "NAV 申购赎回 · Opening Auction 内生流动性 · LP Guard 动态费率保护" },
        { role: "预言家", benefit: "全链胜率背书 + 付费解锁收入", detail: "Seal 私密分析 · 链上战绩积累 · 链上门槛校验后开通付费" },
        { role: "协议 / 平台", benefit: "解锁费抽成 + 交易费率 + 生态网络效应", detail: "Crank 自动结算 · 排行榜驱动流量 · 多市场并行扩展" },
      ],
    },
    solution: {
      leftTitle: "X-Market 博弈模块",
      left: [
        "参数化 AMM：交易修改 μ/σ/λ/α，PDF 实时更新",
        "Poisson 足球 · Dirichlet 选举 · Normal 宏观",
        "Opening Auction → Trading → Oracle 结算",
        "Circle 原生 USDC Vault + Max-Loss 约束",
      ],
      rightTitle: "SuiProphet 知识付费",
      right: [
        "Seal 加密私密预测 · paid_buyers 付费立看",
        "lock_time 后强制公开 · 全链战绩审计",
        "Prophet Score 排行榜筛选真 KOL",
        "与博弈模块共用 Oracle resolved_value",
      ],
      flow: [
        "L0 Oracle\n乐观提议 → 争议 → 委员会终裁",
        "L1 EventRoot\n同一事件 · 同一 lock_time",
        "L2 双模块\nAMM 博弈 + 知识付费并行",
      ],
    },
    techDiff: {
      headers: ["维度", "传统 Yes/No", "X-Market 参数化 AMM"],
      rows: [
        ["定价对象", "离散结果代币", "概率分布函数 PDF"],
        ["流动性", "每 outcome 独立池", "统一 Vault + 参数调整"],
        ["合约类型", "二元赌局", "区间 · 数字 · Call/Put · Variance Swap"],
        ["冷启动", "依赖外部 LP", "Opening Auction 内生定标"],
        ["机构接入", "限仓/封号", "透明池 + 量化套利空间"],
        ["知识生态", "无链上审计", "SuiProphet 强制事后公开"],
      ],
      highlightTitle: "链上数学引擎",
      highlight: [
        "Q32.32 定点数 · exp/erf LUT 查表 · Tier 1 原子完成参数更新与概率计算",
        "链上为唯一真相源 · Pricing Engine 仅作 Preview",
      ],
    },
    performance: {
      pillars: [
        { icon: "⚡", color: C.mint, title: "Sui 并行执行", items: ["按 event_id 分片，多市场并行结算", "Position/Prophecy 为独立 Object，无全局锁", "适合多池 + 多预言家并存的高并发场景"] },
        { icon: "📊", color: C.teal, title: "链上原子计算", items: ["Tier 1：参数更新 + 概率计算同一 PTB 完成", "无 Oracle 签名更新定价参数，消除延迟套利", "LUT 查表降低 exp/erf 计算 Gas 开销"] },
        { icon: "🔄", color: C.deep, title: "Indexer 异步增强", items: ["Vol Crush / IV / Vol Smile 链下独立计算", "PostgreSQL 索引 + REST API 毫秒级查询", "不阻塞链上结算路径"] },
        { icon: "📱", color: C.navy, title: "多端定价桥接", items: ["Flutter + Rust pricing bridge 本地 Preview", "与 math-spec 对齐，所见即所得", "减少无效链上交易提交"] },
      ],
    },
    security: {
      pillars: [
        { icon: "🛡", color: C.coral, title: "Max-Loss 边界", items: ["每笔 buy_* 前链上最坏情景赔付 ≤ Vault", "Slippage Reject 强制拒绝资不抵债交易", "risk.move 全路径覆盖"] },
        { icon: "⚖", color: C.teal, title: "LP Guard 动态防守", items: ["Keeper 监测参数漂移 + 偏度 + 成交量 EMA", "风险满分有效费率可达 800 bps", "sigma_virtual / resolution_window 时间锁"] },
        { icon: "🔐", color: C.deep, title: "Oracle 委员会终裁", items: ["乐观提议 + 争议立案 + 多签委员会", "非 Admin 单方结算 · 质押博弈机制", "Oracle 禁止参与 AMM 定价参数"] },
        { icon: "🔒", color: C.mint, title: "Seal 隐私 + Slash", items: ["Seal OR 策略：付费立看 / 到期公开", "Slash 治理 timelock + 多签执行通道", "ZK 见证冷路径：3600s 挑战窗口 + 延迟 finalize（Attestation，不阻塞交易）"] },
      ],
    },
    reliability: {
      pillars: [
        { icon: "📡", color: C.deep, title: "统一结算真相源", items: ["macro_oracle + oracle_arbitrator 全产品唯一", "同一 DataFeed → 博弈 claim + Prophet 审计", "Feed 自动注册，前端无需硬编码 env"] },
        { icon: "🔁", color: C.teal, title: "市场状态机", items: ["Auction → Trading → Settled 严格流转", "到期 resolution_window 禁 buy_*", "paused 应急暂停 + 演练留痕"] },
        { icon: "🏗", color: C.mint, title: "链下服务矩阵", items: ["LP Guard · Oracle Relayer · Walrus Relay", "Prophet Audit Keeper · Chain Monitor", "Docker 编排 + 健康检查脚本"] },
        { icon: "✅", color: C.navy, title: "主网就绪体系", items: ["mainnet-readiness-checklist 可执行清单", "治理参数签字版 + 应急演练模板", "sui move test 全模块覆盖"] },
      ],
    },
    usability: {
      pillars: [
        { icon: "💵", color: C.mint, title: "USDC 原生体验", items: ["Circle 原生 USDC，非自铸测试币", "买入/解锁/赔付全程稳定币", "降低用户认知门槛，专注交易本身"] },
        { icon: "📊", color: C.teal, title: "定价预览与引导", items: ["Pricing Engine 链下报价 Preview", "TradePanel 实时胜率与 ROI 估算", "减少无效链上提交，所见即所得"] },
        { icon: "🌐", color: C.deep, title: "Web + Mobile 双端", items: ["Next.js 15 + @mysten/dapp-kit", "Flutter 移动端 + Rust 定价 Preview", "/markets · /lp · /positions · /prophet · /leaderboard"] },
        { icon: "📖", color: C.navy, title: "文档与 FAQ 完备", items: ["faq-public 路演短版问答", "demo-walkthrough 端到端演示", "phase playbook 分阶段运维指南"] },
      ],
    },
    business: {
      streams: [
        { metric: "交易费", label: "AMM 滑点 + fee_multiplier 协议分成" },
        { metric: "解锁费", label: "SuiProphet 私密预测抽成" },
        { metric: "LP 溢价", label: "Opening Auction + NAV 管理费" },
      ],
      leftTitle: "生态飞轮",
      left: [
        "高换手事件池 → LP 滑点收入 → 更多 LP 注入",
        "预言家战绩公开 → 排行榜信任 → 订阅解锁增长",
        "Oracle 结算可信 → 机构量化接入 → 池深增加",
        "双模块共用 EventRoot → 交叉导流",
      ],
      rightTitle: "竞争优势",
      right: [
        "PDF 定价：机构级衍生品 vs 散户博彩",
        "Sui 对象模型：Position NFT 可 transfer",
        "Seal + 强制审计：知识付费信任闭环",
        "Testnet v2 全栈已验证，非概念阶段",
      ],
    },
    traction: {
      stats: [
        { value: "30+", label: "Move 链上模块" },
        { value: "3", label: "分布模板已部署" },
        { value: "9+", label: "链下微服务" },
        { value: "✅", label: "Testnet v2 上线" },
      ],
      headers: ["已落地能力", "状态"],
      rows: [
        ["Poisson / Dirichlet / Normal + 区间/数字期权", "✅"],
        ["Opening Auction → Trading → Oracle 结算", "✅"],
        ["USDC Vault + Max-Loss 约束", "✅"],
        ["LP Guard 动态费率 + NAV 申购", "✅"],
        ["SuiProphet Seal Commit + 排行榜", "✅"],
        ["Indexer PostgreSQL + REST API", "✅"],
        ["Flutter Mobile + Rust Pricing Bridge", "✅"],
      ],
    },
    roadmap: {
      phases: [
        { name: "Phase 1", status: "✅ 已完成", done: true, items: ["三分布模板", "区间/数字期权", "Max-Loss", "USDC Vault"] },
        { name: "Phase 1.5", status: "✅ 已完成", done: true, items: ["Opening Auction", "LP Token + NAV", "市场状态机", "冷启动定标"] },
        { name: "Phase 2", status: "✅ 已完成", done: true, items: ["线性期权 · Straddle", "LP Guard 动态费率", "NAV 赎回", "IV 面板"] },
        { name: "Phase 3", status: "🔵 收尾中", done: false, active: true, items: ["Variance Swap + 结构化票据", "Slash 治理 · ZK 冷路径见证", "Beta 分布 · UMA DVM", "外部审计 → Mainnet"] },
        { name: "Phase 4", status: "🔵 规模化", done: false, active: true, items: ["EventRoot 全量迁移", "Prophet Audit Keeper 自动化", "订阅者 ROI · GMV 指标", "SDK / Quant API 开放"] },
      ],
      note: "Tier 2 联合 PDF 模型：主网后 6–12 个月内不上线，优先 Tier 1 + 结构化票据 + SuiProphet 生态",
    },
    future: {
      pillars: [
        {
          icon: "📈", color: C.mint, title: "产品纵深扩展",
          items: [
            "Normal 衍生：Variance Swap · Structured/Range/Barrier Note",
            "Beta 分布覆盖得票率 [0,100] · 独立双池联合概率",
            "Position 二级市场转让 · 更多垂直市场（宏观/体育/选举）",
            "Pricing Engine SDK 供量化机构接入",
          ],
        },
        {
          icon: "🌐", color: C.teal, title: "SuiProphet 生态增长",
          items: [
            "预言家 ≥100 · 付费解锁 GMV ≥$50K/月",
            "排行榜 + 订阅者 ROI 聚合（Indexer 增强）",
            "Seal 明文缓存 · lock_time 后强制公开审计",
            "USDC 纯稳定币体验 · Web + Mobile 双端覆盖",
          ],
        },
        {
          icon: "🚀", color: C.deep, title: "主网上线与合规",
          items: [
            "外部安全审计收敛 · 治理多签 + Slash timelock",
            "Circle USDC Mainnet · GeoBlock 合规框架",
            "mainnet-readiness 演练留痕（Slash/ZK/结算）",
            "UMA DVM 可选仲裁适配器（与内置委员会并存）",
          ],
        },
        {
          icon: "⚙", color: C.navy, title: "基础设施与机构化",
          items: [
            "EventRoot 包装迁移（非硬分叉）· Indexer EventRoot 索引",
            "Brevis 链下监督（可选）：映射 proof_hash，链上仍为见证 + 挑战窗口",
            "LP Guard Keeper 生产化 · Chain Monitor 告警",
            "机构 AUM 目标 ≥$5M · Flutter 主网双端",
          ],
        },
      ],
    },
    kpi: {
      headers: ["阶段", "核心指标", "目标值"],
      rows: [
        ["MVP", "种子市场 / 周活 / TVL", "≥3 池 · ≥500 交易者 · ≥$500K"],
        ["Phase 2", "SDK / 量化接入", "≥3 家机构或 SDK 集成"],
        ["Phase 3", "机构 AUM", "≥ $5M"],
        ["Phase 4", "注册预言家 / 解锁 GMV", "≥100 人 · ≥$50K/月"],
        ["Mainnet+", "市场覆盖 / 结算可靠性", "多垂直并行 · Oracle 零单点"],
      ],
      visionTitle: "长期愿景",
      vision: [
        "成为 Sui 链上「概率分布衍生品 + 链上知识付费」基础设施层",
        "服务零售交易者、LP 承销商、专业预言家与量化机构四类参与者",
        "以链上 PDF 定价取代碎片化 Yes/No，以强制审计取代虚假带单",
      ],
    },
    thanks: {
      summary: "X-Market = 概率分布衍生品协议 + 链上知识付费生态\nTestnet 全栈已验证 · 主网与规模化路径清晰",
      contact: "GitHub: x-market-sui · PRD.zh.md · testnet.suivision.xyz · BSL 1.1",
    },
  };
}

function getEnContent() {
  return {
    meta: {
      title: "X-Market on Sui",
      subtitle: "Probability Distribution Derivatives · A New Paradigm",
      tagline: "From Yes/No gambling to PDF-priced financial derivatives — trading & knowledge monetization unified",
      date: "June 2026 · Testnet v2 Live",
      pain: { title: "Industry Pain Points", sub: "Structural flaws in traditional prediction markets" },
      opportunity: { title: "Market Opportunity", sub: "Three growth vectors & X-Market positioning" },
      value: { title: "Business Value", sub: "Four-sided ecosystem win-win" },
      solution: { title: "Our Solution", sub: "Dual modules on shared EventRoot · unified Oracle settlement" },
      techDiff: { title: "Technical Differentiation", sub: "Parametric AMM vs traditional binary markets" },
      performance: { title: "Performance", sub: "Sui parallel architecture + on-chain atomic compute" },
      security: { title: "Security", sub: "Multi-layer risk control · on-chain verifiable" },
      reliability: { title: "Reliability", sub: "Oracle finality · state machine · ops infrastructure" },
      usability: { title: "Usability", sub: "Web + Mobile · native stablecoin · multi-platform UX" },
      business: { title: "Business Model", sub: "Protocol revenue & ecosystem flywheel" },
      traction: { title: "Traction & Validation", sub: "Testnet v2 delivered capabilities" },
      future: { title: "Future Direction", sub: "Product · Ecosystem · Mainnet · Scale" },
      roadmap: { title: "Phased Roadmap", sub: "Phase 1–4 progress & Mainnet path" },
      kpi: { title: "Milestones & KPIs", sub: "Quantifiable growth targets" },
      thanks: { title: "Thank You", sub: "Questions & Discussion" },
    },
    pain: {
      problems: [
        { title: "Binary fragmentation — can't express continuous probability", desc: "Yes/No tokens split CPI, goal counts, vote shares into fragmented pools with thin liquidity; institutions can't hedge interval risk" },
        { title: "Unaudited signal-selling — KOL track records are forgeable", desc: "Web2/Web3 copy-trading lacks tamper-proof on-chain records; paid unlocks can't be verified post-hoc, eroding subscriber trust" },
        { title: "Centralized market-making — whales get limited", desc: "Traditional sportsbooks are house vs. retail; quant funds and institutions face limits/bans — no true on-chain liquidity pool exists" },
        { title: "Split settlement — trading & insights data silos", desc: "Betting outcomes and paid analysis use different data sources; multi-dimensional event value can't aggregate on one root node" },
      ],
      insight: "Core insight: prediction markets must evolve from 'outcome gambling' to 'probability distribution derivatives' — trade direction, intervals, volatility & structured risk",
    },
    opportunity: {
      segments: [
        {
          name: "On-Chain Derivatives",
          size: "$50B+",
          sizeLabel: "DeFi derivatives TAM (2026)",
          items: ["Parametric AMM serves institutional hedging", "Normal/Poisson/Dirichlet for macro·sports·elections", "Variance Swap & structured products in Phase 3"],
        },
        {
          name: "Paid Knowledge",
          size: "$300B+",
          sizeLabel: "Global paid content market",
          items: ["SuiProphet on-chain score filters real KOLs", "Seal encryption + forced post-hoc public audit", "USDC instant unlock · knowledge asset tokenization"],
        },
        {
          name: "Prediction Markets",
          size: "Rapid Growth",
          sizeLabel: "Polymarket etc. validated PMF",
          items: ["Circle native USDC reduces friction", "Opening Auction cold-start without external LP", "Sui parallel execution for concurrent markets"],
        },
      ],
      note: "X-Market owns the 'probability derivatives + paid knowledge' dual-module synergy — same EventRoot binds trading & insights, no data fragmentation",
    },
    value: {
      stakeholders: [
        { role: "Traders", benefit: "Trade probability curves, not fragment tokens", detail: "Interval/digital options · structured notes · Max-Loss risk control · transparent PDF pricing" },
        { role: "LP Underwriters", benefit: "Earn spread + Theta + mispricing principal", detail: "NAV deposit/redeem · Opening Auction endogenous liquidity · LP Guard dynamic fee protection" },
        { role: "Prophets", benefit: "On-chain win-rate cred + unlock revenue", detail: "Seal private analysis · on-chain track record · paid unlock after on-chain eligibility check" },
        { role: "Protocol", benefit: "Unlock fees + trading fees + network effects", detail: "Crank auto-settlement · leaderboard-driven traffic · parallel multi-market scaling" },
      ],
    },
    solution: {
      leftTitle: "X-Market Trading Module",
      left: [
        "Parametric AMM: trades update μ/σ/λ/α, PDF refreshes in real time",
        "Poisson football · Dirichlet elections · Normal macro",
        "Opening Auction → Trading → Oracle settlement",
        "Circle native USDC Vault + Max-Loss constraint",
      ],
      rightTitle: "SuiProphet Paid Knowledge",
      right: [
        "Seal-encrypted private prophecies · paid_buyers instant access",
        "Forced public disclosure post lock_time · on-chain audit",
        "Prophet Score leaderboard filters real KOLs",
        "Shares Oracle resolved_value with trading module",
      ],
      flow: [
        "L0 Oracle\nOptimistic → Dispute → Committee",
        "L1 EventRoot\nSame event · same lock_time",
        "L2 Dual Modules\nAMM trading + paid insights",
      ],
    },
    techDiff: {
      headers: ["Dimension", "Traditional Yes/No", "X-Market Parametric AMM"],
      rows: [
        ["Pricing target", "Discrete outcome tokens", "Probability density function PDF"],
        ["Liquidity", "Separate pool per outcome", "Unified Vault + parameter adjustment"],
        ["Contract types", "Binary bets", "Interval · Digital · Call/Put · Variance Swap"],
        ["Cold start", "Depends on external LP", "Opening Auction endogenous pricing"],
        ["Institutional access", "Limits / bans", "Transparent pool + quant arbitrage"],
        ["Knowledge ecosystem", "No on-chain audit", "SuiProphet forced post-hoc disclosure"],
      ],
      highlightTitle: "On-Chain Math Engine",
      highlight: [
        "Q32.32 fixed-point · exp/erf LUT lookup · Tier 1 atomic param update + probability",
        "On-chain is source of truth · Pricing Engine preview only",
      ],
    },
    performance: {
      pillars: [
        { icon: "⚡", color: C.mint, title: "Sui Parallel Execution", items: ["Sharded by event_id, parallel settlement across markets", "Position/Prophecy as independent Objects, no global lock", "High concurrency for multi-pool + multi-prophet scenarios"] },
        { icon: "📊", color: C.teal, title: "On-Chain Atomic Compute", items: ["Tier 1: param update + probability in single PTB", "No Oracle-signed pricing updates, eliminates latency arb", "LUT lookup reduces exp/erf Gas cost"] },
        { icon: "🔄", color: C.deep, title: "Indexer Async Enhancement", items: ["Vol Crush / IV / Vol Smile computed off-chain", "PostgreSQL index + REST API millisecond queries", "Doesn't block on-chain settlement path"] },
        { icon: "📱", color: C.navy, title: "Multi-Platform Pricing Bridge", items: ["Flutter + Rust pricing bridge for local preview", "Aligned with math-spec, WYSIWYG quotes", "Reduces invalid on-chain transaction submissions"] },
      ],
    },
    security: {
      pillars: [
        { icon: "🛡", color: C.coral, title: "Max-Loss Boundary", items: ["Every buy_* checks worst-case payout ≤ Vault on-chain", "Slippage Reject forcibly rejects insolvency trades", "risk.move full path coverage"] },
        { icon: "⚖", color: C.teal, title: "LP Guard Dynamic Defense", items: ["Keeper monitors param drift + skewness + volume EMA", "Effective fee up to 800 bps at max risk score", "sigma_virtual / resolution_window time lock"] },
        { icon: "🔐", color: C.deep, title: "Oracle Committee Finality", items: ["Optimistic propose + dispute + multi-sig committee", "Not admin unilateral · stake-based game theory", "Oracle forbidden from AMM pricing params"] },
        { icon: "🔒", color: C.mint, title: "Seal Privacy + Slash", items: ["Seal OR policy: paid instant / post-expiry public", "Slash governance timelock + multi-sig execution", "ZK attestation cold path: 3600s challenge window + delayed finalize (non-blocking)"] },
      ],
    },
    reliability: {
      pillars: [
        { icon: "📡", color: C.deep, title: "Unified Settlement Truth", items: ["macro_oracle + oracle_arbitrator single source for all products", "Same DataFeed → trading claim + Prophet audit", "Feed auto-register, no hardcoded frontend env"] },
        { icon: "🔁", color: C.teal, title: "Market State Machine", items: ["Auction → Trading → Settled strict transitions", "resolution_window blocks buy_* near expiry", "paused emergency halt + drill documentation"] },
        { icon: "🏗", color: C.mint, title: "Off-Chain Service Matrix", items: ["LP Guard · Oracle Relayer · Walrus Relay", "Prophet Audit Keeper · Chain Monitor", "Docker orchestration + health check scripts"] },
        { icon: "✅", color: C.navy, title: "Mainnet Readiness System", items: ["mainnet-readiness-checklist executable steps", "Governance params sign-off + emergency drill templates", "sui move test full module coverage"] },
      ],
    },
    usability: {
      pillars: [
        { icon: "💵", color: C.mint, title: "Native USDC Experience", items: ["Circle native USDC, not custom test tokens", "Buy/unlock/payout all in stablecoin", "Lower cognitive barrier, focus on trading"] },
        { icon: "📊", color: C.teal, title: "Pricing Preview & Guidance", items: ["Pricing Engine off-chain quote preview", "TradePanel real-time win rate & ROI estimate", "Reduces invalid on-chain submissions"] },
        { icon: "🌐", color: C.deep, title: "Web + Mobile Dual Platform", items: ["Next.js 15 + @mysten/dapp-kit", "Flutter mobile + Rust pricing preview", "/markets · /lp · /positions · /prophet · /leaderboard"] },
        { icon: "📖", color: C.navy, title: "Complete Docs & FAQ", items: ["faq-public pitch-ready Q&A", "demo-walkthrough end-to-end demo", "Phase playbooks for staged operations"] },
      ],
    },
    business: {
      streams: [
        { metric: "Trading Fees", label: "AMM spread + fee_multiplier protocol share" },
        { metric: "Unlock Fees", label: "SuiProphet private prophecy commission" },
        { metric: "LP Premium", label: "Opening Auction + NAV management" },
      ],
      leftTitle: "Ecosystem Flywheel",
      left: [
        "High-turnover pools → LP spread income → more LP deposits",
        "Public prophet records → leaderboard trust → unlock growth",
        "Credible Oracle settlement → institutional quant access → deeper pools",
        "Dual modules on EventRoot → cross-module traffic",
      ],
      rightTitle: "Competitive Moat",
      right: [
        "PDF pricing: institutional derivatives vs retail gambling",
        "Sui object model: Position NFT transferable",
        "Seal + forced audit: paid knowledge trust loop",
        "Testnet v2 full-stack validated, not concept-only",
      ],
    },
    traction: {
      stats: [
        { value: "30+", label: "Move on-chain modules" },
        { value: "3", label: "Distribution templates live" },
        { value: "9+", label: "Off-chain microservices" },
        { value: "✅", label: "Testnet v2 deployed" },
      ],
      headers: ["Delivered Capability", "Status"],
      rows: [
        ["Poisson / Dirichlet / Normal + interval/digital options", "✅"],
        ["Opening Auction → Trading → Oracle settlement", "✅"],
        ["USDC Vault + Max-Loss constraint", "✅"],
        ["LP Guard dynamic fees + NAV deposit", "✅"],
        ["SuiProphet Seal commit + leaderboard", "✅"],
        ["Indexer PostgreSQL + REST API", "✅"],
        ["Flutter Mobile + Rust Pricing Bridge", "✅"],
      ],
    },
    roadmap: {
      phases: [
        { name: "Phase 1", status: "✅ Done", done: true, items: ["Three distributions", "Interval/digital options", "Max-Loss", "USDC Vault"] },
        { name: "Phase 1.5", status: "✅ Done", done: true, items: ["Opening Auction", "LP Token + NAV", "State machine", "Cold-start pricing"] },
        { name: "Phase 2", status: "✅ Done", done: true, items: ["Linear options · Straddle", "LP Guard dynamic fees", "NAV redeem", "IV panel"] },
        { name: "Phase 3", status: "🔵 Closing", done: false, active: true, items: ["Variance Swap + structured notes", "Slash governance · ZK cold-path attestation", "Beta dist · UMA DVM", "External audit → Mainnet"] },
        { name: "Phase 4", status: "🔵 Scaling", done: false, active: true, items: ["EventRoot full migration", "Prophet Audit Keeper auto", "Buyer ROI · GMV metrics", "SDK / Quant API open"] },
      ],
      note: "Tier 2 joint PDF model: deferred 6–12 months post-mainnet; prioritize Tier 1 + structured notes + SuiProphet ecosystem",
    },
    future: {
      pillars: [
        {
          icon: "📈", color: C.mint, title: "Product Depth",
          items: [
            "Normal derivatives: Variance Swap · Structured/Range/Barrier Note",
            "Beta distribution for vote share [0,100] · dual-pool joint probability",
            "Position secondary transfer · more verticals (macro/sports/elections)",
            "Pricing Engine SDK for quant institutional access",
          ],
        },
        {
          icon: "🌐", color: C.teal, title: "SuiProphet Ecosystem Growth",
          items: [
            "≥100 registered prophets · ≥$50K/mo unlock GMV",
            "Leaderboard + subscriber ROI aggregation (Indexer enhancement)",
            "Seal plaintext cache · forced public audit post lock_time",
            "Pure USDC stablecoin UX · Web + Mobile dual-platform",
          ],
        },
        {
          icon: "🚀", color: C.deep, title: "Mainnet & Compliance",
          items: [
            "External security audit · governance multisig + Slash timelock",
            "Circle USDC Mainnet · GeoBlock compliance framework",
            "mainnet-readiness drills (Slash / ZK / settlement)",
            "UMA DVM optional adapter (with built-in committee)",
          ],
        },
        {
          icon: "⚙", color: C.navy, title: "Infrastructure & Institutional",
          items: [
            "EventRoot wrap migration · Indexer EventRoot index",
            "Brevis off-chain supervision (opt.): proof_hash mapping",
            "LP Guard Keeper production · Chain Monitor alerting",
            "Institutional AUM target ≥$5M · Flutter mainnet dual-platform",
          ],
        },
      ],
    },
    kpi: {
      headers: ["Phase", "Key Metric", "Target"],
      rows: [
        ["MVP", "Seed markets / WAU / TVL", "≥3 pools · ≥500 traders · ≥$500K"],
        ["Phase 2", "SDK / quant integration", "≥3 institutions or SDK integrations"],
        ["Phase 3", "Institutional AUM", "≥ $5M"],
        ["Phase 4", "Prophets / unlock GMV", "≥100 · ≥$50K/month"],
        ["Mainnet+", "Market coverage / settlement", "Multi-vertical parallel · zero Oracle SPOF"],
      ],
      visionTitle: "Long-Term Vision",
      vision: [
        "Become Sui's infrastructure layer for probability distribution derivatives + on-chain paid knowledge",
        "Serve traders, LP underwriters, professional prophets, and quant institutions",
        "Replace fragmented Yes/No with on-chain PDF pricing; replace fake signal-selling with forced audit",
      ],
    },
    thanks: {
      summary: "X-Market = Probability distribution derivatives + on-chain paid knowledge\nFull-stack Testnet validated · Clear Mainnet & scaling path",
      contact: "GitHub: x-market-sui · PRD.md · testnet.suivision.xyz · BSL 1.1",
    },
  };
}

async function main() {
  console.log("Generating business-focused presentations...");
  const enFile = await buildDeck("en");
  console.log("Created:", enFile);
  const zhFile = await buildDeck("zh");
  console.log("Created:", zhFile);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
