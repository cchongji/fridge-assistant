import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { auth } from '../services/auth.js'
import { recognize } from '../services/recognize.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const router = Router()
const uploadDir = path.join(__dirname, '..', 'uploads')
fs.mkdirSync(uploadDir, { recursive: true })

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '.png'
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`)
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype))
})

/** POST /api/recognize  multipart 字段 image */
router.post('/', auth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传图片（multipart 字段 image）' })
  const imagePath = req.file.path
  try {
    const result = await recognize(imagePath)
    res.json({ ...result, imageUrl: `/uploads/${req.file.filename}` })
  } catch (e) {
    res.status(502).json({ error: `识别失败：${e.message}` })
  }
})

export default router
