import { Hono } from 'hono'
import * as fs from 'fs'
import * as path from 'path'

const streaming = new Hono()

// Directorios de trabajo
const PROCESSED_DIR = path.join(process.cwd(), 'processed_videos')
const EXAMPLE_OUTPUT_DIR = path.join(process.cwd(), 'example-output')

// Servir master playlist
streaming.get('/:videoId/master.m3u8', async (c) => {
  try {
    const videoId = c.req.param('videoId')
    let masterPath: string
    
    if (videoId === 'demo') {
      masterPath = path.join(EXAMPLE_OUTPUT_DIR, 'master.m3u8')
    } else {
      masterPath = path.join(PROCESSED_DIR, videoId, 'master.m3u8')
    }
    
    if (!fs.existsSync(masterPath)) {
      return c.json({ error: 'Master playlist no encontrado' }, 404)
    }
    
    let content = fs.readFileSync(masterPath, 'utf8')
    
    // Reemplazar URLs absolutas con rutas relativas del servidor
    const baseUrl = `/stream/${videoId}`
    
    // Si las URLs ya contienen localhost:3000, las convertimos a rutas relativas
    content = content.replace(/http:\/\/localhost:3000\/example-output\/([^\s]+)/g, `${baseUrl}/$1`)
    
    // Para URLs relativas, añadir el baseUrl
    content = content.replace(/^([^#].*\.m3u8)$/gm, (match) => {
      if (!match.startsWith('http') && !match.startsWith('/')) {
        return `${baseUrl}/${match}`
      }
      return match
    })
    
    // Para URIs en las directivas MEDIA, convertir URLs absolutas a relativas
    content = content.replace(/URI="http:\/\/localhost:3000\/example-output\/([^"]+)"/g, `URI="${baseUrl}/$1"`)
    content = content.replace(/URI="([^"]+)"/g, (match, uri) => {
      if (!uri.startsWith('http') && !uri.startsWith('/')) {
        return `URI="${baseUrl}/${uri}"`
      }
      return match
    })
    
    // Remove audio references if audio.m3u8 doesn't exist
    if (videoId === 'demo') {
      const audioPath = path.join(EXAMPLE_OUTPUT_DIR, 'audio.m3u8')
      if (!fs.existsSync(audioPath)) {
        // Remove audio media line and audio references from stream info
        content = content.replace(/^#EXT-X-MEDIA:TYPE=AUDIO.*$/gm, '')
        content = content.replace(/,AUDIO="[^"]*"/g, '')
        content = content.replace(/\n\n+/g, '\n')
      }
    }
    
    // Remove subtitle references to prevent HLS.js from trying to parse .vtt files as M3U8
    // HLS.js will handle subtitles through other mechanisms
    content = content.replace(/^#EXT-X-MEDIA:TYPE=SUBTITLES.*$/gm, '')
    content = content.replace(/,SUBTITLES="[^"]*"/g, '')
    content = content.replace(/\n\n+/g, '\n')
    
    c.header('Content-Type', 'application/vnd.apple.mpegurl')
    c.header('Cache-Control', 'no-cache')
    return c.text(content)
  } catch (error) {
    return c.json({ error: `Error al servir master playlist: ${error instanceof Error ? error.message : 'Error desconocido'}` }, 500)
  }
})

// Servir playlist de calidad específica
streaming.get('/:videoId/:quality/playlist.m3u8', async (c) => {
  try {
    const videoId = c.req.param('videoId')
    const quality = c.req.param('quality')
    let playlistPath: string
    
    if (videoId === 'demo') {
      playlistPath = path.join(EXAMPLE_OUTPUT_DIR, `real-world-demo_${quality}`, quality, 'playlist.m3u8')
    } else {
      playlistPath = path.join(PROCESSED_DIR, videoId, quality, 'playlist.m3u8')
    }
    
    if (!fs.existsSync(playlistPath)) {
      return c.json({ error: `Playlist de calidad ${quality} no encontrado` }, 404)
    }
    
    let content = fs.readFileSync(playlistPath, 'utf8')
    
    // Reemplazar URLs relativas de segmentos
    const baseUrl = `${c.req.url.split('/stream')[0]}/stream/${videoId}/${quality}`
    content = content.replace(/^([^#].*\.ts)$/gm, `${baseUrl}/$1`)
    
    c.header('Content-Type', 'application/vnd.apple.mpegurl')
    c.header('Cache-Control', 'no-cache')
    return c.text(content)
  } catch (error) {
    return c.json({ error: `Error al servir playlist de calidad: ${error instanceof Error ? error.message : 'Error desconocido'}` }, 500)
  }
})

// Ruta específica para manejar las URLs anidadas del demo
streaming.get('/:videoId/real-world-demo_:quality/:qualityDir/:file', async (c) => {
  try {
    const videoId = c.req.param('videoId')
    const quality = c.req.param('quality')
    const qualityDir = c.req.param('qualityDir')
    const file = c.req.param('file')
    
    if (videoId === 'demo') {
      const filePath = path.join(EXAMPLE_OUTPUT_DIR, `real-world-demo_${quality}`, qualityDir, file)
      
      if (!fs.existsSync(filePath)) {
        return c.json({ error: `Archivo ${file} no encontrado` }, 404)
      }
      
      const fileBuffer = fs.readFileSync(filePath)
      const ext = path.extname(file).toLowerCase()
      
      let contentType = 'application/octet-stream'
      switch (ext) {
        case '.m3u8':
          contentType = 'application/vnd.apple.mpegurl'
          break
        case '.ts':
          contentType = 'video/mp2t'
          break
        case '.vtt':
          contentType = 'text/vtt'
          break
        case '.mp4':
          contentType = 'video/mp4'
          break
        case '.mp3':
          contentType = 'audio/mpeg'
          break
        case '.aac':
          contentType = 'audio/aac'
          break
      }
      
      c.header('Content-Type', contentType)
      c.header('Cache-Control', ext === '.m3u8' ? 'no-cache' : 'public, max-age=31536000')
      
      if (ext === '.m3u8') {
        // Para playlists, procesar el contenido
        let content = fileBuffer.toString('utf8')
        const baseUrl = `/stream/${videoId}/${qualityDir}`
        content = content.replace(/^([^#].*\.ts)$/gm, `${baseUrl}/$1`)
        return c.text(content)
      }
      
      return c.body(fileBuffer)
    }
    
    return c.json({ error: 'Video no encontrado' }, 404)
  } catch (error) {
    return c.json({ error: `Error al servir archivo: ${error instanceof Error ? error.message : 'Error desconocido'}` }, 500)
  }
})

// Servir segmentos de video
streaming.get('/:videoId/:quality/:segment', async (c) => {
  try {
    const videoId = c.req.param('videoId')
    const quality = c.req.param('quality')
    const segment = c.req.param('segment')
    let segmentPath: string
    
    if (videoId === 'demo') {
      segmentPath = path.join(EXAMPLE_OUTPUT_DIR, `real-world-demo_${quality}`, quality, segment)
    } else {
      segmentPath = path.join(PROCESSED_DIR, videoId, quality, segment)
    }
    
    if (!fs.existsSync(segmentPath)) {
      return c.json({ error: 'Segmento no encontrado' }, 404)
    }
    
    const fileBuffer = fs.readFileSync(segmentPath)
    
    c.header('Content-Type', 'video/mp2t')
    c.header('Cache-Control', 'public, max-age=31536000')
    c.header('Accept-Ranges', 'bytes')
    
    return c.body(fileBuffer)
  } catch (error) {
    return c.json({ error: `Error al servir segmento: ${error instanceof Error ? error.message : 'Error desconocido'}` }, 500)
  }
})

// Servir subtítulos
streaming.get('/:videoId/subtitles/:filename', async (c) => {
  try {
    const videoId = c.req.param('videoId')
    const filename = c.req.param('filename')
    let subtitlePath: string
    
    if (videoId === 'demo') {
      subtitlePath = path.join(EXAMPLE_OUTPUT_DIR, filename)
    } else {
      subtitlePath = path.join(PROCESSED_DIR, videoId, 'subtitles', filename)
    }
    
    if (!fs.existsSync(subtitlePath)) {
      return c.json({ error: 'Archivo de subtítulos no encontrado' }, 404)
    }
    
    const content = fs.readFileSync(subtitlePath, 'utf8')
    
    c.header('Content-Type', 'text/vtt')
    c.header('Cache-Control', 'public, max-age=31536000')
    c.header('Access-Control-Allow-Origin', '*')
    
    return c.text(content)
  } catch (error) {
    return c.json({ error: `Error al servir subtítulos: ${error instanceof Error ? error.message : 'Error desconocido'}` }, 500)
  }
})

// Servir archivos de subtítulos directamente (para referencias en master playlist)
streaming.get('/:videoId/:filename', async (c) => {
  try {
    const videoId = c.req.param('videoId')
    const filename = c.req.param('filename')
    
    // Solo manejar archivos .vtt para subtítulos
    if (!filename.endsWith('.vtt')) {
      return c.json({ error: 'Archivo no encontrado' }, 404)
    }
    
    let filePath: string
    
    if (videoId === 'demo') {
      filePath = path.join(EXAMPLE_OUTPUT_DIR, filename)
    } else {
      filePath = path.join(PROCESSED_DIR, videoId, filename)
    }
    
    if (!fs.existsSync(filePath)) {
      return c.json({ error: 'Archivo de subtítulos no encontrado' }, 404)
    }
    
    const content = fs.readFileSync(filePath, 'utf8')
    
    c.header('Content-Type', 'text/vtt')
    c.header('Cache-Control', 'public, max-age=31536000')
    c.header('Access-Control-Allow-Origin', '*')
    
    return c.text(content)
  } catch (error) {
    return c.json({ error: `Error al servir archivo: ${error instanceof Error ? error.message : 'Error desconocido'}` }, 500)
  }
})

// Servir audio playlist
streaming.get('/:videoId/audio/:filename', async (c) => {
  try {
    const videoId = c.req.param('videoId')
    const filename = c.req.param('filename')
    let audioPath: string
    
    if (videoId === 'demo') {
      audioPath = path.join(EXAMPLE_OUTPUT_DIR, 'audio', filename)
    } else {
      audioPath = path.join(PROCESSED_DIR, videoId, 'audio', filename)
    }
    
    if (!fs.existsSync(audioPath)) {
      return c.json({ error: 'Archivo de audio no encontrado' }, 404)
    }
    
    let content = fs.readFileSync(audioPath, 'utf8')
    
    // Reemplazar URLs relativas de segmentos de audio
    const baseUrl = `${c.req.url.split('/stream')[0]}/stream/${videoId}/audio`
    content = content.replace(/^([^#].*\.(ts|aac|mp3))$/gm, `${baseUrl}/$1`)
    
    c.header('Content-Type', 'application/vnd.apple.mpegurl')
    c.header('Cache-Control', 'no-cache')
    
    return c.text(content)
  } catch (error) {
    return c.json({ error: `Error al servir audio: ${error instanceof Error ? error.message : 'Error desconocido'}` }, 500)
  }
})

// Servir archivos estáticos (fallback para cualquier archivo)
streaming.get('/:videoId/*', async (c) => {
  try {
    const videoId = c.req.param('videoId')
    const filePath = c.req.path.replace(`/stream/${videoId}/`, '')
    let fullPath: string
    
    if (videoId === 'demo') {
      fullPath = path.join(EXAMPLE_OUTPUT_DIR, filePath)
    } else {
      fullPath = path.join(PROCESSED_DIR, videoId, filePath)
    }
    
    if (!fs.existsSync(fullPath)) {
      return c.json({ error: 'Archivo no encontrado' }, 404)
    }
    
    const stats = fs.statSync(fullPath)
    if (stats.isDirectory()) {
      return c.json({ error: 'No se puede servir un directorio' }, 400)
    }
    
    const fileBuffer = fs.readFileSync(fullPath)
    const ext = path.extname(fullPath).toLowerCase()
    
    // Determinar Content-Type basado en la extensión
    let contentType = 'application/octet-stream'
    switch (ext) {
      case '.m3u8':
        contentType = 'application/vnd.apple.mpegurl'
        break
      case '.ts':
        contentType = 'video/mp2t'
        break
      case '.vtt':
        contentType = 'text/vtt'
        break
      case '.mp4':
        contentType = 'video/mp4'
        break
      case '.mp3':
        contentType = 'audio/mpeg'
        break
      case '.aac':
        contentType = 'audio/aac'
        break
    }
    
    c.header('Content-Type', contentType)
    c.header('Cache-Control', ext === '.m3u8' ? 'no-cache' : 'public, max-age=31536000')
    
    return c.body(fileBuffer)
  } catch (error) {
    return c.json({ error: `Error al servir archivo: ${error instanceof Error ? error.message : 'Error desconocido'}` }, 500)
  }
})

export default streaming