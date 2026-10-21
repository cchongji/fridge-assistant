/**
 * 内置食品词典：覆盖大部分调味品与常见食品
 * 格式: [名称, 默认分区, {r:冷藏天数, f:冷冻天数, a:常温天数}]
 * 未指定的存储方式回退到分类默认值（refrigerated 7 / frozen 180 / ambient 180）
 */

const DEFAULT_DAYS = { refrigerated: 7, frozen: 180, ambient: 180 }

// prettier-ignore
const RAW = [
  // ── 调味品 ──
  ['食盐', 'ambient', { a: 1825, r: 1825, f: 1825 }],
  ['白糖', 'ambient', { a: 1825 }],
  ['冰糖', 'ambient', { a: 1825 }],
  ['红糖', 'ambient', { a: 1095 }],
  ['生抽', 'ambient', { a: 730 }],
  ['老抽', 'ambient', { a: 730 }],
  ['味极鲜', 'ambient', { a: 730 }],
  ['蚝油', 'refrigerated', { r: 60, a: 180 }],
  ['料酒', 'ambient', { a: 1095 }],
  ['白酒', 'ambient', { a: 3650 }],
  ['啤酒', 'ambient', { a: 180 }],
  ['红酒', 'ambient', { a: 1095 }],
  ['米醋', 'ambient', { a: 1095 }],
  ['陈醋', 'ambient', { a: 1095 }],
  ['白醋', 'ambient', { a: 1095 }],
  ['香油', 'ambient', { a: 540 }],
  ['食用油', 'ambient', { a: 540 }],
  ['橄榄油', 'ambient', { a: 720 }],
  ['花生油', 'ambient', { a: 540 }],
  ['豆瓣酱', 'ambient', { a: 540 }],
  ['甜面酱', 'ambient', { a: 365 }],
  ['番茄酱', 'refrigerated', { r: 60, a: 365 }],
  ['芝麻酱', 'ambient', { a: 365 }],
  ['花生酱', 'ambient', { a: 540 }],
  ['沙拉酱', 'refrigerated', { r: 90, a: 180 }],
  ['芥末', 'ambient', { a: 365 }],
  ['腐乳', 'refrigerated', { r: 180, a: 365 }],
  ['豆豉', 'ambient', { a: 365 }],
  ['剁椒', 'refrigerated', { r: 180, a: 365 }],
  ['酸豆角', 'refrigerated', { r: 90, a: 180 }],
  ['味精', 'ambient', { a: 1825 }],
  ['鸡精', 'ambient', { a: 1095 }],
  ['十三香', 'ambient', { a: 1095 }],
  ['胡椒粉', 'ambient', { a: 1095 }],
  ['孜然粉', 'ambient', { a: 1095 }],
  ['咖喱块', 'refrigerated', { r: 180, a: 365 }],
  ['淀粉', 'ambient', { a: 1095 }],
  ['面粉', 'ambient', { a: 180 }],
  ['泡打粉', 'ambient', { a: 1095 }],
  ['酵母', 'refrigerated', { r: 365, a: 180 }],
  ['味噌', 'refrigerated', { r: 365 }],
  ['火锅底料', 'ambient', { a: 540 }],

  // ── 香辛/鲜蔬配料 ──
  ['小米椒', 'refrigerated', { r: 7, f: 365, a: 3 }],
  ['干辣椒', 'ambient', { a: 1095 }],
  ['辣椒酱', 'refrigerated', { r: 180, a: 365 }],
  ['辣椒油', 'refrigerated', { r: 90, a: 180 }],
  ['青椒', 'refrigerated', { r: 7, f: 180, a: 5 }],
  ['红椒', 'refrigerated', { r: 10, f: 180, a: 5 }],
  ['生姜', 'refrigerated', { r: 21, a: 30 }],
  ['大蒜', 'ambient', { a: 60, r: 60 }],
  ['小葱', 'refrigerated', { r: 7 }],
  ['大葱', 'refrigerated', { r: 14, a: 21 }],
  ['香菜', 'refrigerated', { r: 5 }],
  ['洋葱', 'ambient', { a: 30, r: 30 }],

  // ── 蔬菜 ──
  ['绿叶菜', 'refrigerated', { r: 3 }],
  ['生菜', 'refrigerated', { r: 5 }],
  ['菠菜', 'refrigerated', { r: 3 }],
  ['油麦菜', 'refrigerated', { r: 3 }],
  ['大白菜', 'refrigerated', { r: 14, a: 21 }],
  ['娃娃菜', 'refrigerated', { r: 7 }],
  ['卷心菜', 'refrigerated', { r: 14 }],
  ['紫甘蓝', 'refrigerated', { r: 14 }],
  ['西兰花', 'refrigerated', { r: 7 }],
  ['花菜', 'refrigerated', { r: 7 }],
  ['白萝卜', 'refrigerated', { r: 14 }],
  ['胡萝卜', 'refrigerated', { r: 21 }],
  ['土豆', 'ambient', { a: 30, r: 21 }],
  ['红薯', 'ambient', { a: 30 }],
  ['山药', 'ambient', { a: 21 }],
  ['芋头', 'ambient', { a: 30 }],
  ['莲藕', 'refrigerated', { r: 7 }],
  ['韭菜', 'refrigerated', { r: 3 }],
  ['芹菜', 'refrigerated', { r: 7 }],
  ['黄瓜', 'refrigerated', { r: 7 }],
  ['丝瓜', 'refrigerated', { r: 5 }],
  ['苦瓜', 'refrigerated', { r: 7 }],
  ['冬瓜', 'refrigerated', { r: 14 }],
  ['南瓜', 'ambient', { a: 30 }],
  ['番茄', 'refrigerated', { r: 7 }],
  ['茄子', 'refrigerated', { r: 7 }],
  ['豆角', 'refrigerated', { r: 5 }],
  ['荷兰豆', 'refrigerated', { r: 5 }],
  ['玉米', 'refrigerated', { r: 5 }],
  ['金针菇', 'refrigerated', { r: 5 }],
  ['香菇', 'refrigerated', { r: 5 }],
  ['杏鲍菇', 'refrigerated', { r: 7 }],
  ['平菇', 'refrigerated', { r: 3 }],
  ['干木耳', 'ambient', { a: 365 }],
  ['干香菇', 'ambient', { a: 365 }],
  ['紫菜', 'ambient', { a: 365 }],
  ['干海带', 'ambient', { a: 365 }],

  // ── 水果 ──
  ['苹果', 'refrigerated', { r: 30, a: 14 }],
  ['梨', 'refrigerated', { r: 14 }],
  ['香蕉', 'ambient', { a: 5 }],
  ['橙子', 'refrigerated', { r: 14 }],
  ['橘子', 'refrigerated', { r: 10 }],
  ['柚子', 'refrigerated', { r: 21 }],
  ['柠檬', 'refrigerated', { r: 21 }],
  ['葡萄', 'refrigerated', { r: 7 }],
  ['提子', 'refrigerated', { r: 7 }],
  ['西瓜', 'refrigerated', { r: 5 }],
  ['哈密瓜', 'refrigerated', { r: 7 }],
  ['草莓', 'refrigerated', { r: 3 }],
  ['蓝莓', 'refrigerated', { r: 5 }],
  ['樱桃', 'refrigerated', { r: 5 }],
  ['桃子', 'refrigerated', { r: 5 }],
  ['李子', 'refrigerated', { r: 7 }],
  ['芒果', 'refrigerated', { r: 5 }],
  ['菠萝', 'refrigerated', { r: 5 }],
  ['猕猴桃', 'refrigerated', { r: 14 }],
  ['火龙果', 'ambient', { a: 7 }],
  ['榴莲', 'refrigerated', { r: 3 }],
  ['荔枝', 'refrigerated', { r: 3 }],
  ['龙眼', 'refrigerated', { r: 5 }],
  ['冬枣', 'refrigerated', { r: 14 }],
  ['柿子', 'ambient', { a: 7 }],

  // ── 肉禽 ──
  ['猪肉', 'refrigerated', { r: 2, f: 180 }],
  ['五花肉', 'refrigerated', { r: 2, f: 180 }],
  ['排骨', 'refrigerated', { r: 2, f: 180 }],
  ['猪肝', 'refrigerated', { r: 1, f: 90 }],
  ['牛肉', 'refrigerated', { r: 3, f: 180 }],
  ['牛排', 'frozen', { f: 180, r: 2 }],
  ['羊肉', 'refrigerated', { r: 3, f: 180 }],
  ['鸡肉', 'refrigerated', { r: 2, f: 180 }],
  ['鸡翅', 'frozen', { f: 180, r: 2 }],
  ['鸡腿', 'frozen', { f: 180, r: 2 }],
  ['鸭肉', 'refrigerated', { r: 2, f: 180 }],
  ['培根', 'refrigerated', { r: 30 }],
  ['火腿肠', 'ambient', { a: 180 }],
  ['香肠', 'refrigerated', { r: 90, a: 60 }],
  ['腊肉', 'refrigerated', { r: 180, a: 90 }],
  ['午餐肉', 'ambient', { a: 1095 }],
  ['鸡翅中', 'frozen', { f: 180, r: 2 }],

  // ── 水产 ──
  ['鲜鱼', 'refrigerated', { r: 1, f: 90 }],
  ['三文鱼', 'refrigerated', { r: 1, f: 30 }],
  ['带鱼', 'frozen', { f: 180, r: 2 }],
  ['黄花鱼', 'frozen', { f: 180, r: 2 }],
  ['鲜虾', 'frozen', { f: 90, r: 1 }],
  ['虾仁', 'frozen', { f: 90 }],
  ['蟹', 'refrigerated', { r: 1 }],
  ['鱿鱼', 'frozen', { f: 90, r: 1 }],
  ['贝壳类', 'refrigerated', { r: 1 }],
  ['鱼豆腐', 'frozen', { f: 30 }],
  ['虾滑', 'frozen', { f: 30 }],

  // ── 蛋奶豆 ──
  ['鸡蛋', 'refrigerated', { r: 30, a: 15 }],
  ['鸭蛋', 'refrigerated', { r: 30 }],
  ['咸鸭蛋', 'refrigerated', { r: 60 }],
  ['皮蛋', 'ambient', { a: 90 }],
  ['纯牛奶', 'refrigerated', { r: 7, a: 180 }],
  ['鲜牛奶', 'refrigerated', { r: 7 }],
  ['酸奶', 'refrigerated', { r: 21 }],
  ['奶酪', 'refrigerated', { r: 90 }],
  ['黄油', 'refrigerated', { r: 180, f: 365 }],
  ['淡奶油', 'refrigerated', { r: 30 }],
  ['豆腐', 'refrigerated', { r: 3 }],
  ['内酯豆腐', 'refrigerated', { r: 7 }],
  ['豆浆', 'refrigerated', { r: 2 }],
  ['豆干', 'refrigerated', { r: 7 }],
  ['腐竹', 'ambient', { a: 365 }],
  ['鲜豆腐皮', 'refrigerated', { r: 3 }],

  // ── 主食/面点 ──
  ['米饭', 'refrigerated', { r: 3, f: 30 }],
  ['馒头', 'refrigerated', { r: 5, f: 30 }],
  ['包子', 'frozen', { f: 30, r: 3 }],
  ['鲜面条', 'refrigerated', { r: 3 }],
  ['挂面', 'ambient', { a: 365 }],
  ['饺子', 'frozen', { f: 90 }],
  ['汤圆', 'frozen', { f: 90 }],
  ['大米', 'ambient', { a: 365 }],
  ['小米', 'ambient', { a: 365 }],
  ['糯米', 'ambient', { a: 365 }],
  ['燕麦', 'ambient', { a: 365 }],
  ['麦片', 'ambient', { a: 365 }],
  ['面包', 'ambient', { a: 5, r: 7 }],
  ['吐司', 'ambient', { a: 5, r: 7 }],
  ['蛋糕', 'refrigerated', { r: 2 }],
  ['饼干', 'ambient', { a: 180 }],
  ['薯片', 'ambient', { a: 180 }],

  // ── 饮品/干货/其他 ──
  ['可乐', 'ambient', { a: 540 }],
  ['果汁', 'refrigerated', { r: 7 }],
  ['咖啡豆', 'ambient', { a: 180 }],
  ['咖啡粉', 'ambient', { a: 90 }],
  ['茶叶', 'ambient', { a: 730 }],
  ['蜂蜜', 'ambient', { a: 1825 }],
  ['坚果', 'ambient', { a: 180 }],
  ['瓜子', 'ambient', { a: 180 }],
  ['红枣', 'ambient', { a: 365 }],
  ['枸杞', 'ambient', { a: 365 }],
  ['冰淇淋', 'frozen', { f: 90 }]
]

export const FOOD_DICT = RAW.map(([n, c, d]) => ({
  name: n,
  category: c,
  days: {
    refrigerated: d.r ?? DEFAULT_DAYS.refrigerated,
    frozen: d.f ?? DEFAULT_DAYS.frozen,
    ambient: d.a ?? DEFAULT_DAYS.a
  }
}))

/** 获取某食品在某分区下的建议天数 */
export function daysFor(entry, category) {
  return entry.days[category] ?? entry.days[entry.category] ?? 7
}

/**
 * 模糊查询：完全匹配 > 前缀匹配 > 包含匹配
 * @param {string} q 关键词
 * @param {number} limit
 */
export function fuzzySearch(q, limit = 10) {
  const kw = String(q || '').trim().toLowerCase()
  if (!kw) return []
  const scored = []
  for (const item of FOOD_DICT) {
    const n = item.name.toLowerCase()
    let score = 0
    if (n === kw) score = 100
    else if (n.startsWith(kw)) score = 80
    else if (n.includes(kw)) score = 60
    else if (kw.includes(n)) score = 40
    if (score) scored.push({ score, item })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map(({ item }) => item)
}
