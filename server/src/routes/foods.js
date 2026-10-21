import { Router } from 'express'
import db from '../db.js'
import { auth } from '../services/auth.js'
import { suggestShelfLife } from '../services/suggest.js'
import { fuzzySearch, daysFor } from '../services/food-dict.js'

const router = Router()

/** GET /api/foods/fuzzy?q=  本地词典模糊查询（调味品/常见食品，毫秒级响应） */
router.get('/fuzzy', auth, (req, res) => {
  const category = ['refrigerated', 'frozen', 'ambient'].includes(req.query.category)
    ? req.query.category
    : null
  const items = fuzzySearch(req.query.q).map(item => ({
    name: item.name,
    category: category || item.category,
    days: daysFor(item, category || item.category)
  }))
  res.json({ items })
})

/** POST /api/foods/suggest  AI 推荐保质期 {name, category} */
router.post('/suggest', auth, async (req, res) => {
  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ error: '请先填写食品名称' })
  try {
    res.json(await suggestShelfLife(name, req.body?.category))
  } catch (e) {
    res.status(502).json({ error: `AI 建议失败：${e.message}` })
  }
})

/** 校验并补全食品字段 */
function sanitize(body) {
  const errors = []
  if (!body.name || !String(body.name).trim()) errors.push('名称不能为空')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.expireDate || '')) errors.push('过期时间格式需为 YYYY-MM-DD')
  if (!['refrigerated', 'frozen', 'ambient'].includes(body.category)) body.category = 'refrigerated'
  return {
    errors,
    data: {
      name: String(body.name).trim(),
      category: body.category,
      quantity: Number.isFinite(+body.quantity) && +body.quantity > 0 ? +body.quantity : 1,
      unit: String(body.unit || '').slice(0, 10),
      added_at: /^\d{4}-\d{2}-\d{2}$/.test(body.addedAt || '') ? body.addedAt : new Date().toISOString().slice(0, 10),
      expire_date: body.expireDate,
      opened_date: /^\d{4}-\d{2}-\d{2}$/.test(body.openedDate || '') ? body.openedDate : null,
      note: String(body.note || '').slice(0, 500)
    }
  }
}

/** GET /api/foods?status=&category=&q=  列表（按过期时间升序） */
router.get('/', auth, (req, res) => {
  const { status = 'stock', category, q } = req.query
  let sql = 'SELECT * FROM foods WHERE user_id = ?'
  const params = [req.uid]
  if (status !== 'all') {
    sql += ' AND status = ?'
    params.push(status)
  }
  if (category) {
    sql += ' AND category = ?'
    params.push(category)
  }
  if (q) {
    sql += ' AND name LIKE ?'
    params.push(`%${q}%`)
  }
  sql += ' ORDER BY expire_date ASC'
  res.json(db.prepare(sql).all(...params))
})

/** POST /api/foods  新增（支持批量数组） */
router.post('/', auth, (req, res) => {
  const list = Array.isArray(req.body) ? req.body : [req.body]
  const stmt = db.prepare(
    `INSERT INTO foods (user_id, name, category, quantity, unit, added_at, expire_date, opened_date, note)
     VALUES (@uid, @name, @category, @quantity, @unit, @added_at, @expire_date, @opened_date, @note)`
  )
  const created = []
  for (const body of list) {
    const { errors, data } = sanitize(body)
    if (errors.length) return res.status(400).json({ error: errors.join('；') })
    const info = stmt.run({ uid: req.uid, ...data })
    created.push(db.prepare('SELECT * FROM foods WHERE id = ?').get(info.lastInsertRowid))
  }
  res.status(201).json(created.length === 1 ? created[0] : created)
})

/** PUT /api/foods/:id  编辑 */
router.put('/:id', auth, (req, res) => {
  const food = db.prepare('SELECT * FROM foods WHERE id = ? AND user_id = ?').get(req.params.id, req.uid)
  if (!food) return res.status(404).json({ error: '食品不存在' })
  const merged = { ...food, ...req.body }
  const { errors, data } = sanitize(merged)
  if (errors.length) return res.status(400).json({ error: errors.join('；') })
  db.prepare(
    `UPDATE foods SET name=@name, category=@category, quantity=@quantity, unit=@unit,
     added_at=@added_at, expire_date=@expire_date, opened_date=@opened_date, note=@note,
     status=@status, updated_at=datetime('now','localtime') WHERE id=@id`
  ).run({
    ...data,
    status: ['stock', 'eaten', 'expired'].includes(merged.status) ? merged.status : food.status,
    id: food.id
  })
  res.json(db.prepare('SELECT * FROM foods WHERE id = ?').get(food.id))
})

/** POST /api/foods/:id/eat  标记已吃完 */
router.post('/:id/eat', auth, (req, res) => {
  const info = db
    .prepare("UPDATE foods SET status='eaten', updated_at=datetime('now','localtime') WHERE id=? AND user_id=?")
    .run(req.params.id, req.uid)
  if (!info.changes) return res.status(404).json({ error: '食品不存在' })
  res.json({ ok: true })
})

/** DELETE /api/foods/:id */
router.delete('/:id', auth, (req, res) => {
  const info = db.prepare('DELETE FROM foods WHERE id = ? AND user_id = ?').run(req.params.id, req.uid)
  if (!info.changes) return res.status(404).json({ error: '食品不存在' })
  res.json({ ok: true })
})

export default router
