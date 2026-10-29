import { upload } from './http'
import type { RecognizeResult } from './types'

/** POST /api/recognize  multipart 字段 image */
export const recognizeImage = (file: File) => upload<RecognizeResult>('/recognize', file, 'image')
