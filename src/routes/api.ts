import { Hono } from 'hono'
import * as fs from 'fs'
import * as path from 'path'
import { HlsConverter } from '../lib'

const api = new Hono()

// Directorios de trabajo
const VIDEOS_DIR = path.join(process.cwd(), 'videos')
const PROCESSED_DIR = path.join(process.cwd(), 'processed_videos')
const EXAMPLE_OUTPUT_DIR = path.join(process.cwd(), 'example-output')

// Listar videos disponibles
api.get('/videos', async (c) => {
  try {
    const videos = []
    
    // Buscar en directorio de videos originales
    if (fs.existsSync(VIDEOS_DIR)) {
      const files = fs.readdirSync(VIDEOS_DIR)
      for (const file of files) {
        if (file.match(/\.(mp4|avi|mov|mkv)$/i)) {
          const videoPath = path.join(VIDEOS_DIR, file)
          const stats = fs.statSync(videoPath)
          const videoId = path.parse(file).name
          
          // Verificar si está procesado
          const processedDir = path.join(PROCESSED_DIR, videoId)
          const isProcessed = fs.existsSync(path.join(processedDir, 'master.m3u8'))
          
          videos.push({
            id: videoId,
            filename: file,
            size: stats.size,
            created: stats.birthtime,
            processed: isProcessed,
            streamUrl: isProcessed ? `/stream/${videoId}/master.m3u8` : null
          })
        }
      }
    }
    
    // Buscar en example-output
    if (fs.existsSync(EXAMPLE_OUTPUT_DIR)) {
      const masterFile = path.join(EXAMPLE_OUTPUT_DIR, 'master.m3u8')
      if (fs.existsSync(masterFile)) {
        videos.push({
          id: 'demo',
          filename: 'demo-video',
          size: 0,
          created: fs.statSync(masterFile).birthtime,
          processed: true,
          streamUrl: '/stream/demo/master.m3u8'
        })
      }
    }
    
    return c.json({ videos })
  } catch (error) {
    return c.json({ error: 'Error al listar videos' }, 500)
  }
})

// Procesar video para HLS
api.post('/videos/:videoId/process', async (c) => {
  try {
    const videoId = c.req.param('videoId')
    const videoPath = path.join(VIDEOS_DIR, `${videoId}.mp4`)
    
    if (!fs.existsSync(videoPath)) {
      return c.json({ error: 'Video no encontrado' }, 404)
    }
    
    const converter = new HlsConverter({}, PROCESSED_DIR)
    
    const result = await converter.convertToHls(videoPath, {
      videoId,
      basePath: ''
    })
    
    return c.json({
      message: 'Video procesado exitosamente',
      videoId,
      streamUrl: `/stream/${videoId}/master.m3u8`,
      result
    })
  } catch (error) {
    return c.json({ error: `Error al procesar video: ${error instanceof Error ? error.message : 'Error desconocido'}` }, 500)
  }
})

// Endpoint para obtener información de un video
api.get('/videos/:videoId', async (c) => {
  try {
    const videoId = c.req.param('videoId')
    
    if (videoId === 'demo') {
      const masterPath = path.join(EXAMPLE_OUTPUT_DIR, 'master.m3u8')
      if (!fs.existsSync(masterPath)) {
        return c.json({ error: 'Video demo no encontrado' }, 404)
      }
      
      return c.json({
        id: 'demo',
        filename: 'demo-video',
        processed: true,
        streamUrl: '/stream/demo/master.m3u8',
        qualities: ['360p', '480p', '720p'],
        hasSubtitles: true,
        hasAudio: true
      })
    }
    
    const videoPath = path.join(VIDEOS_DIR, `${videoId}.mp4`)
    const processedDir = path.join(PROCESSED_DIR, videoId)
    const masterPath = path.join(processedDir, 'master.m3u8')
    
    if (!fs.existsSync(videoPath) && !fs.existsSync(masterPath)) {
      return c.json({ error: 'Video no encontrado' }, 404)
    }
    
    const isProcessed = fs.existsSync(masterPath)
    const qualities = []
    
    if (isProcessed) {
      // Buscar directorios de calidad
      const qualityDirs = fs.readdirSync(processedDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(name => name.match(/^\d+p$/))
      
      qualities.push(...qualityDirs)
    }
    
    return c.json({
      id: videoId,
      filename: `${videoId}.mp4`,
      processed: isProcessed,
      streamUrl: isProcessed ? `/stream/${videoId}/master.m3u8` : null,
      qualities,
      hasSubtitles: isProcessed && fs.existsSync(path.join(processedDir, 'subtitles')),
      hasAudio: isProcessed && fs.existsSync(path.join(processedDir, 'audio'))
    })
  } catch (error) {
    return c.json({ error: `Error al obtener información del video: ${error instanceof Error ? error.message : 'Error desconocido'}` }, 500)
  }
})

export default api