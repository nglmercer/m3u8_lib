import { Hono } from 'hono'
import * as fs from 'fs'
import * as path from 'path'

const streaming = new Hono()

// Directorios de trabajo
const PROCESSED_DIR = path.join(process.cwd(), 'processed_videos')
const EXAMPLE_OUTPUT_DIR = path.join(process.cwd(), 'example-output')

// Sistema de debug
class DebugLogger {
  private static enabled = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true'
  
  static log(category: string, message: string, data?: any) {
    if (this.enabled) {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}] [${category}] ${message}`, data ? JSON.stringify(data, null, 2) : '')
    }
  }
  
  static error(category: string, message: string, error?: any) {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [ERROR] [${category}] ${message}`, error)
  }
}

class M3U8Handler {
  private static readonly VALID_M3U8_HEADERS = [
    '#EXTM3U',
    '#EXT-X-VERSION',
    '#EXT-X-TARGETDURATION',
    '#EXT-X-MEDIA-SEQUENCE',
    '#EXT-X-PLAYLIST-TYPE',
    '#EXT-X-STREAM-INF',
    '#EXT-X-MEDIA',
    '#EXT-X-ENDLIST'
  ]
  
  static validateM3U8Content(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    const lines = content.split('\n').filter(line => line.trim())
    
    DebugLogger.log('M3U8_VALIDATION', 'Validando contenido M3U8', { lineCount: lines.length })
    
    // Verificar que comience con #EXTM3U
    if (!lines[0] || !lines[0].startsWith('#EXTM3U')) {
      errors.push('El archivo M3U8 debe comenzar con #EXTM3U')
    }
    
    // Verificar estructura básica
    let hasValidHeaders = false
    for (const line of lines) {
      if (line.startsWith('#')) {
        const header = line.split(':')[0]
        if (this.VALID_M3U8_HEADERS.some(validHeader => header.startsWith(validHeader))) {
          hasValidHeaders = true
          break
        }
      }
    }
    
    if (!hasValidHeaders) {
      errors.push('No se encontraron headers válidos de M3U8')
    }
    
    const isValid = errors.length === 0
    DebugLogger.log('M3U8_VALIDATION', 'Resultado de validación', { isValid, errors })
    
    return { isValid, errors }
  }
  
  static processM3U8Content(content: string, baseUrl: string, videoId: string): string {
    DebugLogger.log('M3U8_PROCESSING', 'Procesando contenido M3U8', { baseUrl, videoId })
    
    let processedContent = content
    
    // Reemplazar URLs absolutas con rutas relativas del servidor
    processedContent = processedContent.replace(/http:\/\/localhost:3000\/example-output\/([^\s]+)/g, `${baseUrl}/$1`)
    
    // Para URLs relativas, añadir el baseUrl
    processedContent = processedContent.replace(/^([^#].*\.m3u8)$/gm, (match) => {
      if (!match.startsWith('http') && !match.startsWith('/')) {
        // Handle demo-specific structure
        if (videoId === 'demo' && match.startsWith('real-world-demo/')) {
          // Convert 'real-world-demo/480p/playlist.m3u8' to '/stream/demo/480p/playlist.m3u8'
          const pathParts = match.split('/')
          if (pathParts.length === 3 && pathParts[0] === 'real-world-demo') {
            return `${baseUrl}/${pathParts[1]}/${pathParts[2]}`
          }
        }
        return `${baseUrl}/${match}`
      }
      return match
    })
    
    // Para URIs en las directivas MEDIA
    processedContent = processedContent.replace(/URI="http:\/\/localhost:3000\/example-output\/([^"]+)"/g, `URI="${baseUrl}/$1"`)
    processedContent = processedContent.replace(/URI="([^"]+)"/g, (match, uri) => {
      if (!uri.startsWith('http') && !uri.startsWith('/')) {
        // Para archivos de subtítulos (.vtt), convertir a playlist de subtítulos
        if (uri.endsWith('.vtt')) {
          const language = uri.split('.')[0]
          if (language) {
            return `URI="${baseUrl}/subtitles/${language}.m3u8"`
          }
          // Fallback for unknown VTT files
          return `URI="${baseUrl}/subtitles/${uri}"`
        }
        // Para otros archivos (como .m3u8), usar ruta directa
        return `URI="${baseUrl}/${uri}"`
      }
      return match
    })
    
    DebugLogger.log('M3U8_PROCESSING', 'Contenido M3U8 procesado exitosamente')
    return processedContent
  }
  
  static getFilePath(videoId: string, filename: string, subdirectory?: string): string {
    let filePath: string
    
    if (videoId === 'demo') {
      if (subdirectory) {
        filePath = path.join(EXAMPLE_OUTPUT_DIR, 'real-world-demo', subdirectory, filename)
      } else {
        filePath = path.join(EXAMPLE_OUTPUT_DIR, 'real-world-demo', filename)
      }
    } else {
      if (subdirectory) {
        filePath = path.join(PROCESSED_DIR, videoId, subdirectory, filename)
      } else {
        filePath = path.join(PROCESSED_DIR, videoId, filename)
      }
    }
    
    DebugLogger.log('M3U8_HANDLER', 'Ruta de archivo generada', { videoId, filename, subdirectory, filePath })
    return filePath
  }
  
  static fileExists(filePath: string): boolean {
    const exists = fs.existsSync(filePath)
    DebugLogger.log('M3U8_HANDLER', 'Verificación de existencia de archivo', { filePath, exists })
    return exists
  }
  
  static readFileContent(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      DebugLogger.log('M3U8_HANDLER', 'Archivo leído exitosamente', { filePath, contentLength: content.length })
      return content
    } catch (error) {
      DebugLogger.error('M3U8_HANDLER', 'Error al leer archivo', { filePath, error })
      throw error
    }
  }
  
  static getContentType(extension: string): string {
    const contentTypes: { [key: string]: string } = {
      '.m3u8': 'application/vnd.apple.mpegurl',
      '.ts': 'video/mp2t',
      '.vtt': 'text/vtt',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.aac': 'audio/aac'
    }
    
    const contentType = contentTypes[extension.toLowerCase()] || 'application/octet-stream'
    DebugLogger.log('M3U8_HANDLER', 'Tipo de contenido determinado', { extension, contentType })
    return contentType
  }
}


// Ruta principal para servir master playlist
streaming.get('/:videoId/master.m3u8', async (c) => {
  try {
    const videoId = c.req.param('videoId')
    const baseUrl = `/stream/${videoId}`
    
    DebugLogger.log('STREAMING', 'Solicitando master playlist', { videoId })
    
    const filePath = M3U8Handler.getFilePath(videoId, 'master.m3u8')
    
    if (!M3U8Handler.fileExists(filePath)) {
      DebugLogger.error('STREAMING', 'Master playlist no encontrado', { filePath })
      return c.text('Master playlist no encontrado', 404)
    }
    
    const content = M3U8Handler.readFileContent(filePath)
    const validation = M3U8Handler.validateM3U8Content(content)
    
    if (!validation.isValid) {
      DebugLogger.error('STREAMING', 'Master playlist inválido', validation.errors)
      return c.text('Master playlist inválido', 500)
    }
    
    const processedContent = M3U8Handler.processM3U8Content(content, baseUrl, videoId)
    
    c.header('Content-Type', M3U8Handler.getContentType('.m3u8'))
    c.header('Cache-Control', 'no-cache')
    c.header('Access-Control-Allow-Origin', '*')
    
    return c.text(processedContent)
  } catch (error) {
    DebugLogger.error('STREAMING', 'Error sirviendo master playlist', error)
    return c.text('Error interno del servidor', 500)
  }
})

// Ruta para servir playlists de calidad específica
streaming.get('/:videoId/:quality/playlist.m3u8', async (c) => {
  try {
    const videoId = c.req.param('videoId')
    const quality = c.req.param('quality')
    const baseUrl = `/stream/${videoId}/${quality}`
    
    DebugLogger.log('STREAMING', 'Solicitando playlist de calidad', { videoId, quality })
    
    const filePath = M3U8Handler.getFilePath(videoId, 'playlist.m3u8', quality)
    
    if (!M3U8Handler.fileExists(filePath)) {
      DebugLogger.error('STREAMING', 'Playlist de calidad no encontrado', { filePath })
      return c.text('Playlist no encontrado', 404)
    }
    
    const content = M3U8Handler.readFileContent(filePath)
    const validation = M3U8Handler.validateM3U8Content(content)
    
    if (!validation.isValid) {
      DebugLogger.error('STREAMING', 'Playlist de calidad inválido', validation.errors)
      return c.text('Playlist inválido', 500)
    }
    
    const processedContent = M3U8Handler.processM3U8Content(content, baseUrl, videoId)
    
    c.header('Content-Type', M3U8Handler.getContentType('.m3u8'))
    c.header('Cache-Control', 'no-cache')
    c.header('Access-Control-Allow-Origin', '*')
    
    return c.text(processedContent)
  } catch (error) {
    DebugLogger.error('STREAMING', 'Error sirviendo playlist de calidad', error)
    return c.text('Error interno del servidor', 500)
  }
})

// Ruta para servir segmentos de video
streaming.get('/:videoId/:quality/:segment', async (c) => {
  try {
    const videoId = c.req.param('videoId')
    const quality = c.req.param('quality')
    const segment = c.req.param('segment')
    
    DebugLogger.log('STREAMING', 'Solicitando segmento de video', { videoId, quality, segment })
    
    const filePath = M3U8Handler.getFilePath(videoId, segment, quality)
    
    if (!M3U8Handler.fileExists(filePath)) {
      DebugLogger.error('STREAMING', 'Segmento no encontrado', { filePath })
      return c.text('Segmento no encontrado', 404)
    }
    
    const extension = path.extname(segment)
    const contentType = M3U8Handler.getContentType(extension)
    
    c.header('Content-Type', contentType)
    c.header('Cache-Control', 'public, max-age=31536000')
    c.header('Access-Control-Allow-Origin', '*')
    
    const fileBuffer = fs.readFileSync(filePath)
    return c.body(fileBuffer)
  } catch (error) {
    DebugLogger.error('STREAMING', 'Error sirviendo segmento', error)
    return c.text('Error interno del servidor', 500)
  }
})

// Ruta para servir audio playlist
streaming.get('/:videoId/audio/:audioFile', async (c) => {
  try {
    const videoId = c.req.param('videoId')
    const audioFile = c.req.param('audioFile')
    
    DebugLogger.log('STREAMING', 'Solicitando archivo de audio', { videoId, audioFile })
    
    const filePath = M3U8Handler.getFilePath(videoId, audioFile, 'audio')
    
    if (!M3U8Handler.fileExists(filePath)) {
      DebugLogger.error('STREAMING', 'Archivo de audio no encontrado', { filePath })
      return c.text('Archivo de audio no encontrado', 404)
    }
    
    const extension = path.extname(audioFile)
    const contentType = M3U8Handler.getContentType(extension)
    
    c.header('Content-Type', contentType)
    c.header('Cache-Control', extension === '.m3u8' ? 'no-cache' : 'public, max-age=31536000')
    c.header('Access-Control-Allow-Origin', '*')
    
    if (extension === '.m3u8') {
      const content = M3U8Handler.readFileContent(filePath)
      const baseUrl = `/stream/${videoId}/audio`
      const processedContent = M3U8Handler.processM3U8Content(content, baseUrl, videoId)
      return c.text(processedContent)
    } else {
      const fileBuffer = fs.readFileSync(filePath)
      return c.body(fileBuffer)
    }
  } catch (error) {
    DebugLogger.error('STREAMING', 'Error sirviendo archivo de audio', error)
    return c.text('Error interno del servidor', 500)
  }
})

// Ruta para servir subtítulos
streaming.get('/:videoId/subtitles/:subtitleFile', async (c) => {
  try {
    const videoId = c.req.param('videoId')
    const subtitleFile = c.req.param('subtitleFile')
    
    DebugLogger.log('STREAMING', 'Solicitando archivo de subtítulos', { videoId, subtitleFile })
    
    const filePath = M3U8Handler.getFilePath(videoId, subtitleFile, 'subtitles')
    
    if (!M3U8Handler.fileExists(filePath)) {
      DebugLogger.error('STREAMING', 'Archivo de subtítulos no encontrado', { filePath })
      return c.text('Archivo de subtítulos no encontrado', 404)
    }
    
    const extension = path.extname(subtitleFile)
    const contentType = M3U8Handler.getContentType(extension)
    
    c.header('Content-Type', contentType)
    c.header('Cache-Control', 'public, max-age=31536000')
    c.header('Access-Control-Allow-Origin', '*')
    
    if (extension === '.vtt') {
      const content = M3U8Handler.readFileContent(filePath)
      return c.text(content)
    } else if (extension === '.m3u8') {
      // Para playlists de subtítulos
      const content = M3U8Handler.readFileContent(filePath)
      const baseUrl = `/stream/${videoId}/subtitles`
      const processedContent = M3U8Handler.processM3U8Content(content, baseUrl, videoId)
      return c.text(processedContent)
    } else {
      const fileBuffer = fs.readFileSync(filePath)
      return c.body(fileBuffer)
    }
  } catch (error) {
    DebugLogger.error('STREAMING', 'Error sirviendo archivo de subtítulos', error)
    return c.text('Error interno del servidor', 500)
  }
})

// Ruta para servir archivos VTT directamente desde el master playlist
streaming.get('/:videoId/:vttFile', async (c) => {
  try {
    const videoId = c.req.param('videoId')
    const vttFile = c.req.param('vttFile')
    
    // Solo procesar archivos .vtt
    if (!vttFile.endsWith('.vtt')) {
      return c.text('Archivo no encontrado', 404)
    }
    
    DebugLogger.log('STREAMING', 'Solicitando archivo VTT directo', { videoId, vttFile })
    
    const filePath = M3U8Handler.getFilePath(videoId, vttFile, 'subtitles')
    
    if (!M3U8Handler.fileExists(filePath)) {
      DebugLogger.error('STREAMING', 'Archivo VTT no encontrado', { filePath })
      return c.text('Archivo VTT no encontrado', 404)
    }
    
    const content = M3U8Handler.readFileContent(filePath)
    
    c.header('Content-Type', 'text/vtt')
    c.header('Cache-Control', 'public, max-age=31536000')
    c.header('Access-Control-Allow-Origin', '*')
    
    return c.text(content)
  } catch (error) {
    DebugLogger.error('STREAMING', 'Error sirviendo archivo VTT', error)
    return c.text('Error interno del servidor', 500)
  }
})

export default streaming