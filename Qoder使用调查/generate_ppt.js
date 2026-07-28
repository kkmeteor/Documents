const pptxgen = require("pptxgenjs");

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches

const BLUE = "1F4E79";
const DARK = "333333";
const WHITE = "FFFFFF";
const LIGHT_BG = "F2F7FB";
const ACCENT = "2E75B6";
const GRAY = "666666";
const GREEN = "548235";
const RED = "C00000";
const ORANGE = "ED7D31";

// Helper: slide title at top
function addSlideTitle(slide, title, subtitle) {
  slide.background = { fill: WHITE };
  // Top bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 0.9, fill: { color: BLUE },
  });
  slide.addText(title, {
    x: 0.6, y: 0.1, w: 12, h: 0.7,
    fontSize: 24, bold: true, color: WHITE, fontFace: "Arial",
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.6, y: 0.7, w: 12, h: 0.4,
      fontSize: 11, color: GRAY, fontFace: "Arial",
    });
  }
}

// Helper: add bottom line
function addBottomLine(slide) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 7.2, w: 13.33, h: 0.05, fill: { color: BLUE },
  });
}

// ===================== SLIDE 1: Cover =====================
{
  const slide = pptx.addSlide();
  slide.background = { fill: BLUE };
  slide.addText("Qoder AI 编码工具\n使用调查总结报告", {
    x: 0.8, y: 1.5, w: 11.7, h: 2.5,
    fontSize: 36, bold: true, color: WHITE, fontFace: "Arial",
    align: "center",
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 5.2, y: 4.2, w: 3, h: 0.06, fill: { color: WHITE },
  });
  slide.addText("2026-05-22  |  呈报：开发总监", {
    x: 0.8, y: 4.5, w: 11.7, h: 0.6,
    fontSize: 16, color: WHITE, fontFace: "Arial",
    align: "center",
  });
}

// ===================== SLIDE 2: Core Conclusion =====================
{
  const slide = pptx.addSlide();
  addSlideTitle(slide, "核心结论");
  addBottomLine(slide);

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.6, y: 1.2, w: 12.1, h: 1.2,
    fill: { color: "E8F0FE" },
    rectRadius: 0.1,
  });
  slide.addText("推荐将 Qoder 作为团队辅助开发工具纳入技术栈", {
    x: 0.8, y: 1.3, w: 11.7, h: 0.5,
    fontSize: 18, bold: true, color: BLUE, fontFace: "Arial",
  });
  slide.addText("多 Agent 集群工作模式在复杂任务上显著提升效率，配合灵活的大模型选择策略，可有效平衡质量与成本", {
    x: 0.8, y: 1.8, w: 11.7, h: 0.5,
    fontSize: 13, color: DARK, fontFace: "Arial",
  });

  const items = [
    { label: "效率提升", text: "复杂任务多 Agent 并行，响应速度快", color: GREEN },
    { label: "成本可控", text: "灵活选择模型（DeepSeek-V4-Flash 等），优化 Token 消耗", color: GREEN },
    { label: "⚠ 风险提示", text: "核心代码不应接入公有模型，需区分使用场景", color: RED },
  ];

  items.forEach((item, i) => {
    const y = 2.7 + i * 0.9;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.6, y, w: 12.1, h: 0.7,
      fill: { color: LIGHT_BG },
      rectRadius: 0.05,
    });
    slide.addText(item.label, {
      x: 0.8, y: y + 0.05, w: 2.2, h: 0.6,
      fontSize: 13, bold: true, color: item.color, fontFace: "Arial",
    });
    slide.addText(item.text, {
      x: 3.2, y: y + 0.05, w: 9.3, h: 0.6,
      fontSize: 13, color: DARK, fontFace: "Arial",
    });
  });
}

// ===================== SLIDE 3: 使用便利性 =====================
{
  const slide = pptx.addSlide();
  addSlideTitle(slide, "详细评估 — 使用便利性");
  addBottomLine(slide);

  const rows = [
    [
      { text: "维度", options: { bold: true, color: WHITE, fill: { color: BLUE }, fontSize: 13, fontFace: "Arial" } },
      { text: "评价", options: { bold: true, color: WHITE, fill: { color: BLUE }, fontSize: 13, fontFace: "Arial" } },
    ],
    [
      { text: "上手难度", options: { bold: true, fontSize: 12, fontFace: "Arial" } },
      { text: "⭐ 简单，操作习惯与其他 AI 编程工具一致，学习成本低", options: { fontSize: 12, fontFace: "Arial" } },
    ],
    [
      { text: "交互体验", options: { bold: true, fontSize: 12, fontFace: "Arial" } },
      { text: "⭐ 响应速度快，支持多种交互方式", options: { fontSize: 12, fontFace: "Arial" } },
    ],
    [
      { text: "集成支持", options: { bold: true, fontSize: 12, fontFace: "Arial" } },
      { text: "⚠ 不支持 TFS、VS2022/2026，需同时打开 VS 和 Qoder", options: { fontSize: 12, color: RED, fontFace: "Arial" } },
    ],
  ];

  slide.addTable(rows, {
    x: 0.6, y: 1.3, w: 12.1,
    border: { type: "solid", pt: 0.5, color: "CCCCCC" },
    colW: [2.5, 9.6],
    rowH: [0.5, 0.6, 0.6, 0.6],
    margin: [4, 6, 4, 6],
  });
}

// ===================== SLIDE 4: 效率提升 & 成本控制 =====================
{
  const slide = pptx.addSlide();
  addSlideTitle(slide, "详细评估 — 效率提升 & 成本控制");
  addBottomLine(slide);

  // Efficiency section
  slide.addText("效率提升", {
    x: 0.6, y: 1.2, w: 5.5, h: 0.4,
    fontSize: 16, bold: true, color: BLUE, fontFace: "Arial",
  });

  const effRows = [
    [
      { text: "维度", options: { bold: true, color: WHITE, fill: { color: ACCENT }, fontSize: 11, fontFace: "Arial" } },
      { text: "评价", options: { bold: true, color: WHITE, fill: { color: ACCENT }, fontSize: 11, fontFace: "Arial" } },
    ],
    [
      { text: "代码生成", options: { bold: true, fontSize: 11, fontFace: "Arial" } },
      { text: "质量较高，基本无需大量修改", options: { fontSize: 11, fontFace: "Arial" } },
    ],
    [
      { text: "代码补全", options: { bold: true, fontSize: 11, fontFace: "Arial" } },
      { text: "实用性不错，因 VS 集成限制效果折扣", options: { fontSize: 11, fontFace: "Arial" } },
    ],
    [
      { text: "调试辅助", options: { bold: true, fontSize: 11, fontFace: "Arial" } },
      { text: "未作为主力调试工具使用", options: { fontSize: 11, fontFace: "Arial" } },
    ],
  ];

  slide.addTable(effRows, {
    x: 0.6, y: 1.7, w: 5.8,
    border: { type: "solid", pt: 0.5, color: "CCCCCC" },
    colW: [1.5, 4.3],
    rowH: [0.4, 0.5, 0.5, 0.5],
    margin: [3, 5, 3, 5],
  });

  // Cost section
  slide.addText("成本控制", {
    x: 6.9, y: 1.2, w: 5.5, h: 0.4,
    fontSize: 16, bold: true, color: BLUE, fontFace: "Arial",
  });

  const costRows = [
    [
      { text: "维度", options: { bold: true, color: WHITE, fill: { color: ACCENT }, fontSize: 11, fontFace: "Arial" } },
      { text: "评价", options: { bold: true, color: WHITE, fill: { color: ACCENT }, fontSize: 11, fontFace: "Arial" } },
    ],
    [
      { text: "时间成本", options: { bold: true, fontSize: 11, fontFace: "Arial" } },
      { text: "提升显著，多 Agent 并行", options: { fontSize: 11, fontFace: "Arial" } },
    ],
    [
      { text: "人力成本", options: { bold: true, fontSize: 11, fontFace: "Arial" } },
      { text: "减少重复劳动，仍需人工审查", options: { fontSize: 11, fontFace: "Arial" } },
    ],
    [
      { text: "经济成本", options: { bold: true, fontSize: 11, fontFace: "Arial" } },
      { text: "定价合理，多档方案可选", options: { fontSize: 11, fontFace: "Arial" } },
    ],
  ];

  slide.addTable(costRows, {
    x: 6.9, y: 1.7, w: 5.8,
    border: { type: "solid", pt: 0.5, color: "CCCCCC" },
    colW: [1.5, 4.3],
    rowH: [0.4, 0.5, 0.5, 0.5],
    margin: [3, 5, 3, 5],
  });

  // Cost tip box
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.6, y: 3.8, w: 12.1, h: 1.0,
    fill: { color: "FFF8E1" },
    rectRadius: 0.08,
  });
  slide.addText("💰 成本优化建议", {
    x: 0.8, y: 3.85, w: 11.7, h: 0.35,
    fontSize: 13, bold: true, color: ORANGE, fontFace: "Arial",
  });
  slide.addText("• 简单任务选用 DeepSeek-V4-Flash 等小模型，显著降低 Token 消耗\n• 实测 2 人可公用一个席位，3000 credits 够 2 人非高频使用", {
    x: 0.8, y: 4.2, w: 11.7, h: 0.5,
    fontSize: 11, color: DARK, fontFace: "Arial",
  });
}

// ===================== SLIDE 5: 优缺点 =====================
{
  const slide = pptx.addSlide();
  addSlideTitle(slide, "优缺点总结");
  addBottomLine(slide);

  // Advantages
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.6, y: 1.2, w: 5.8, h: 3.5,
    fill: { color: "E8F5E9" },
    rectRadius: 0.1,
  });
  slide.addText("✅ 优势", {
    x: 0.8, y: 1.3, w: 5.4, h: 0.4,
    fontSize: 16, bold: true, color: GREEN, fontFace: "Arial",
  });

  const pros = [
    "简单任务可选低成本小模型，灵活控制 Token 消耗",
    "支持多 Agent 集群工作，复杂任务效率提升明显",
    "响应速度快，交互体验流畅",
  ];
  pros.forEach((text, i) => {
    slide.addText(`• ${text}`, {
      x: 0.8, y: 1.8 + i * 0.6, w: 5.4, h: 0.5,
      fontSize: 12, color: DARK, fontFace: "Arial",
    });
  });

  // Disadvantages
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 6.9, y: 1.2, w: 5.8, h: 3.5,
    fill: { color: "FDE8E8" },
    rectRadius: 0.1,
  });
  slide.addText("⚠ 不足", {
    x: 7.1, y: 1.3, w: 5.4, h: 0.4,
    fontSize: 16, bold: true, color: RED, fontFace: "Arial",
  });

  const cons = [
    "无法集成 VS，日常需双开 IDE，对内存要求略高",
    "不支持 TFS（支持 Git）",
    "代码质量需人工校验架构合规性",
  ];
  cons.forEach((text, i) => {
    slide.addText(`• ${text}`, {
      x: 7.1, y: 1.8 + i * 0.6, w: 5.4, h: 0.5,
      fontSize: 12, color: DARK, fontFace: "Arial",
    });
  });
}

// ===================== SLIDE 6: 使用案例分享 =====================
{
  const slide = pptx.addSlide();
  addSlideTitle(slide, "使用案例分享");
  addBottomLine(slide);

  // --- 案例 1 ---
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.6, y: 1.1, w: 12.1, h: 2.0,
    fill: { color: LIGHT_BG },
    rectRadius: 0.08,
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.6, y: 1.1, w: 0.1, h: 2.0,
    fill: { color: ACCENT },
  });
  slide.addText("📘  案例 1：Repo Wiki — 代码知识库自动生成", {
    x: 1.0, y: 1.15, w: 11.5, h: 0.35,
    fontSize: 14, bold: true, color: ACCENT, fontFace: "Arial",
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 1.0, y: 1.52, w: 11.3, h: 0.02,
    fill: { color: "DDDDDD" },
  });
  slide.addText(
    "利用 Repo Wiki 自动分析当前仓库代码结构、模块关系、核心逻辑，生成详细文档总结\n" +
    "收益：可直接提交代码库作为团队共享知识沉淀，新成员上手成本大幅降低\n" +
    "收益：生成的文档可注入 Agent 项目记忆，后续执行无需重复理解代码上下文\n" +
    "收益：响应更快、结果更准，同时显著降低 Token 消耗成本",
    {
      x: 1.0, y: 1.6, w: 11.3, h: 1.4,
      fontSize: 11, color: DARK, fontFace: "Arial",
    }
  );

  // --- 案例 2 ---
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.6, y: 3.3, w: 5.8, h: 2.0,
    fill: { color: LIGHT_BG },
    rectRadius: 0.08,
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.6, y: 3.3, w: 0.1, h: 2.0,
    fill: { color: GREEN },
  });
  slide.addText("🐛  案例 2：前端 Bug 修复", {
    x: 1.0, y: 3.35, w: 5.2, h: 0.35,
    fontSize: 14, bold: true, color: GREEN, fontFace: "Arial",
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 1.0, y: 3.72, w: 5.0, h: 0.02,
    fill: { color: "DDDDDD" },
  });
  slide.addText(
    "简单案例分享日常工作效率提升：\n" +
    "描述问题现象 → 快速定位根因 →\n" +
    "直接生成修复代码。\n" +
    "从排查到修复，耗时从几十分钟\n" +
    "缩短到几分钟，积少成多。",
    {
      x: 1.0, y: 3.8, w: 5.0, h: 1.4,
      fontSize: 11, color: DARK, fontFace: "Arial",
    }
  );

  // --- 案例 3 ---
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 6.9, y: 3.3, w: 5.8, h: 2.0,
    fill: { color: LIGHT_BG },
    rectRadius: 0.08,
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 6.9, y: 3.3, w: 0.1, h: 2.0,
    fill: { color: ORANGE },
  });
  slide.addText("📄  案例 3：分析总结文档", {
    x: 7.3, y: 3.35, w: 5.2, h: 0.35,
    fontSize: 14, bold: true, color: ORANGE, fontFace: "Arial",
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 7.3, y: 3.72, w: 5.0, h: 0.02,
    fill: { color: "DDDDDD" },
  });
  slide.addText(
    "使用 Agent/Quest 模式处理文档：\n" +
    "自动理解结构、提炼核心结论\n" +
    "生成结构清晰的汇报摘要\n" +
    "进一步生成可直接演示的 PPT\n\n" +
    "收益：阅读→提炼→汇报，一条龙\n" +
    "省去手动排版，聚焦思考决策",
    {
      x: 7.3, y: 3.8, w: 5.0, h: 1.4,
      fontSize: 11, color: DARK, fontFace: "Arial",
    }
  );
}

// ===================== SLIDE 7: 适用场景 & 安全合规 =====================
{
  const slide = pptx.addSlide();
  addSlideTitle(slide, "适用场景建议 & 安全合规");
  addBottomLine(slide);

  // Scenarios
  slide.addText("适用场景", {
    x: 0.6, y: 1.2, w: 6, h: 0.4,
    fontSize: 16, bold: true, color: BLUE, fontFace: "Arial",
  });

  const sceneRows = [
    [
      { text: "场景", options: { bold: true, color: WHITE, fill: { color: GREEN }, fontSize: 11, fontFace: "Arial" } },
      { text: "说明", options: { bold: true, color: WHITE, fill: { color: GREEN }, fontSize: 11, fontFace: "Arial" } },
    ],
    [
      { text: "✅ 推荐", options: { bold: true, fontSize: 11, color: GREEN, fontFace: "Arial" } },
      { text: "独立新增的小型项目、子模块开发、模块耦合低的场景", options: { fontSize: 11, fontFace: "Arial" } },
    ],
    [
      { text: "❌ 不推荐", options: { bold: true, fontSize: 11, color: RED, fontFace: "Arial" } },
      { text: "高安全性代码、核心敏感数据、需严格架构管控的复杂系统", options: { fontSize: 11, fontFace: "Arial" } },
    ],
  ];

  slide.addTable(sceneRows, {
    x: 0.6, y: 1.7, w: 6,
    border: { type: "solid", pt: 0.5, color: "CCCCCC" },
    colW: [1.3, 4.7],
    rowH: [0.4, 0.7, 0.7],
    margin: [3, 5, 3, 5],
  });

  // Security
  slide.addText("安全与合规", {
    x: 7.3, y: 1.2, w: 5.5, h: 0.4,
    fontSize: 16, bold: true, color: BLUE, fontFace: "Arial",
  });

  const secRows = [
    [
      { text: "风险点", options: { bold: true, color: WHITE, fill: { color: RED }, fontSize: 11, fontFace: "Arial" } },
      { text: "说明", options: { bold: true, color: WHITE, fill: { color: RED }, fontSize: 11, fontFace: "Arial" } },
    ],
    [
      { text: "核心代码数据", options: { bold: true, fontSize: 11, fontFace: "Arial" } },
      { text: "不应接入公有大模型，建议私有部署", options: { fontSize: 11, fontFace: "Arial" } },
    ],
    [
      { text: "个人版风险", options: { bold: true, fontSize: 11, fontFace: "Arial" } },
      { text: "数据默认共享，存在泄露风险", options: { fontSize: 11, fontFace: "Arial" } },
    ],
    [
      { text: "企业版优势", options: { bold: true, fontSize: 11, fontFace: "Arial" } },
      { text: "承诺不训练用户数据，支持隐私模式", options: { fontSize: 11, color: GREEN, fontFace: "Arial" } },
    ],
  ];

  slide.addTable(secRows, {
    x: 7.3, y: 1.7, w: 5.5,
    border: { type: "solid", pt: 0.5, color: "CCCCCC" },
    colW: [1.5, 4.0],
    rowH: [0.4, 0.5, 0.5, 0.5],
    margin: [3, 5, 3, 5],
  });
}

// ===================== SLIDE 8: 团队使用建议 =====================
{
  const slide = pptx.addSlide();
  addSlideTitle(slide, "团队使用建议");
  addBottomLine(slide);

  const rows = [
    [
      { text: "方案", options: { bold: true, color: WHITE, fill: { color: BLUE }, fontSize: 13, fontFace: "Arial" } },
      { text: "适用场景", options: { bold: true, color: WHITE, fill: { color: BLUE }, fontSize: 13, fontFace: "Arial" } },
      { text: "说明", options: { bold: true, color: WHITE, fill: { color: BLUE }, fontSize: 13, fontFace: "Arial" } },
    ],
    [
      { text: "个人版报销", options: { bold: true, fontSize: 12, fontFace: "Arial" } },
      { text: "团队规模小、使用频率低", options: { fontSize: 12, fontFace: "Arial" } },
      { text: "成本低，但缺少统一管理与审计", options: { fontSize: 12, fontFace: "Arial" } },
    ],
    [
      { text: "采购企业版", options: { bold: true, fontSize: 12, color: GREEN, fontFace: "Arial" } },
      { text: "需统一管理、审计与合规", options: { fontSize: 12, fontFace: "Arial" } },
      { text: "推荐方案，满足安全与管控要求", options: { fontSize: 12, color: GREEN, fontFace: "Arial" } },
    ],
    [
      { text: "试点后推广", options: { bold: true, fontSize: 12, fontFace: "Arial" } },
      { text: "全体推广前", options: { fontSize: 12, fontFace: "Arial" } },
      { text: "开发人员偏好不同，先试点评估收益", options: { fontSize: 12, fontFace: "Arial" } },
    ],
  ];

  slide.addTable(rows, {
    x: 0.6, y: 1.3, w: 12.1,
    border: { type: "solid", pt: 0.5, color: "CCCCCC" },
    colW: [2.5, 4.5, 5.1],
    rowH: [0.5, 0.6, 0.6, 0.6],
    margin: [4, 6, 4, 6],
  });

  // Recommendation highlight
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.6, y: 4.0, w: 12.1, h: 0.8,
    fill: { color: "E8F0FE" },
    rectRadius: 0.08,
  });
  slide.addText("💡 建议：先选部分子模块试点 → 评估收益后 → 采购企业版全面推广", {
    x: 0.8, y: 4.05, w: 11.7, h: 0.7,
    fontSize: 15, bold: true, color: BLUE, fontFace: "Arial",
    align: "center",
  });
}

// ===================== SLIDE 9: Action Plan =====================
{
  const slide = pptx.addSlide();
  addSlideTitle(slide, "行动建议");
  addBottomLine(slide);

  const phases = [
    {
      title: "短期 — 试点验证",
      items: ["选择部分子模块开展 AI 辅助开发试点", "验证实际收益与团队接受度"],
      color: ACCENT,
      y: 1.3,
    },
    {
      title: "中期 — 企业版采购",
      items: ["评估企业版采购方案", "解决安全合规与统一管理需求"],
      color: ORANGE,
      y: 3.0,
    },
    {
      title: "长期 — 私有化部署",
      items: ["探索私有化部署方案", "覆盖核心代码开发场景"],
      color: GREEN,
      y: 4.7,
    },
  ];

  phases.forEach((phase) => {
    // Phase box
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.6, y: phase.y, w: 12.1, h: 1.4,
      fill: { color: LIGHT_BG },
      rectRadius: 0.08,
    });
    // Left accent bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.6, y: phase.y, w: 0.12, h: 1.4,
      fill: { color: phase.color },
    });
    // Phase title
    slide.addText(phase.title, {
      x: 1.0, y: phase.y + 0.1, w: 11.5, h: 0.4,
      fontSize: 15, bold: true, color: phase.color, fontFace: "Arial",
    });
    // Items
    phase.items.forEach((item, i) => {
      slide.addText(`${i + 1}. ${item}`, {
        x: 1.2, y: phase.y + 0.55 + i * 0.35, w: 11.3, h: 0.35,
        fontSize: 12, color: DARK, fontFace: "Arial",
      });
    });
  });
}

// ===================== SLIDE 10: 沟通要点（讨论用） =====================
{
  const slide = pptx.addSlide();
  addSlideTitle(slide, "团队沟通要点 — 与大家分享讨论");
  addBottomLine(slide);

  // 核心理念横幅
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.6, y: 1.15, w: 12.1, h: 0.65,
    fill: { color: "E8F0FE" },
    rectRadius: 0.08,
  });
  slide.addText("核心理念：AI 编码工具是辅助，不是替代 — 帮大家减少机械工作，专注核心技术", {
    x: 0.8, y: 1.18, w: 11.7, h: 0.6,
    fontSize: 14, bold: true, color: BLUE, fontFace: "Arial",
    align: "center",
  });

  const items = [
    {
      title: "理解顾虑",
      desc: "理解大家担心 AI 冲击现有工作模式，这份顾虑完全正常、我们充分理解",
      color: ACCENT,
    },
    {
      title: "明确定位",
      desc: "AI 做基础编码、查错、代码规整等重复性工作；核心架构、业务设计、决策仍由研发人员把控",
      color: GREEN,
    },
    {
      title: "实际收益",
      desc: "减少重复机械工作量，把精力聚焦在复杂业务与技术攻坚上，加快交付、减少低级 bug",
      color: GREEN,
    },
    {
      title: "风险可控",
      desc: "已梳理安全使用规则，小范围试点、全程人工审核把关，不会打乱现有开发流程",
      color: ORANGE,
    },
    {
      title: "落地方式",
      desc: "建议先选简单模块试点，记录工时与 bug 率变化，验证效果后根据团队接受度逐步调整",
      color: ACCENT,
    },
  ];

  items.forEach((item, i) => {
    const y = 1.95 + i * 0.98;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.6, y, w: 12.1, h: 0.83,
      fill: { color: LIGHT_BG },
      rectRadius: 0.06,
    });
    // 左侧色条
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.6, y, w: 0.1, h: 0.83,
      fill: { color: item.color },
    });
    slide.addText(item.title, {
      x: 1.0, y, w: 1.6, h: 0.83,
      fontSize: 13, bold: true, color: item.color, fontFace: "Arial",
    });
    slide.addText(item.desc, {
      x: 2.7, y, w: 9.8, h: 0.83,
      fontSize: 12, color: DARK, fontFace: "Arial",
    });
  });

  // 底部总结
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.6, y: 6.35, w: 12.1, h: 0.55,
    fill: { color: "E8F5E9" },
    rectRadius: 0.08,
  });
  slide.addText("工具不会取代我们，它只是帮忙处理基础代码和文档总结。用起来少做机械活，专心钻研核心技术 — 不强制，慢慢适应", {
    x: 0.8, y: 6.35, w: 11.7, h: 0.55,
    fontSize: 12, bold: true, color: GREEN, fontFace: "Arial",
    align: "center",
  });
}

// ===================== SLIDE 11: Thank you =====================
{
  const slide = pptx.addSlide();
  slide.background = { fill: BLUE };
  slide.addText("谢谢", {
    x: 0.8, y: 2.5, w: 11.7, h: 1.0,
    fontSize: 40, bold: true, color: WHITE, fontFace: "Arial",
    align: "center",
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 5.5, y: 3.6, w: 2.3, h: 0.06, fill: { color: WHITE },
  });
  slide.addText("Q & A", {
    x: 0.8, y: 3.9, w: 11.7, h: 0.8,
    fontSize: 20, color: WHITE, fontFace: "Arial",
    align: "center",
  });
}

const outputPath = "c:/Users/tengfei.ma/Documents/MD/Qoder使用调查/Qoder使用调查总结报告.pptx";
pptx.writeFile({ fileName: outputPath }).then(() => {
  console.log("PPT generated: " + outputPath);
});
