import { Hono } from 'hono'
import { promises as fsPromises } from 'fs'
import * as path from 'path'

const staticRoutes = new Hono()

// Endpoint para servir el reproductor HTML estático
staticRoutes.get('/', async (c) => {
  try {
    const htmlPath = path.join(__dirname, '../../public/index.html')
    const htmlContent = await fsPromises.readFile(htmlPath, 'utf-8')
    return c.html(htmlContent)
  } catch (error) {
    // Fallback a documentación de API si no existe el archivo HTML
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>HLS Video Streaming API</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
          .method { color: #007acc; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>🎬 HLS Video Streaming API</h1>
        <p>API para conversión y streaming de videos en formato HLS</p>
        
        <h2>📋 Endpoints Disponibles:</h2>
        
        <div class="endpoint">
          <span class="method">GET</span> <code>/api/videos</code>
          <p>Lista todos los videos disponibles</p>
        </div>
        
        <div class="endpoint">
          <span class="method">POST</span> <code>/api/videos/:videoId/process</code>
          <p>Procesa un video para HLS</p>
        </div>
        
        <div class="endpoint">
          <span class="method">GET</span> <code>/api/videos/:videoId</code>
          <p>Obtiene información detallada de un video</p>
        </div>
        
        <div class="endpoint">
          <span class="method">GET</span> <code>/stream/:videoId/master.m3u8</code>
          <p>Playlist maestro HLS para un video</p>
        </div>
        
        <div class="endpoint">
          <span class="method">GET</span> <code>/stream/:videoId/:quality/playlist.m3u8</code>
          <p>Playlist de calidad específica (360p, 480p, 720p)</p>
        </div>
        
        <h2>🎥 Demo:</h2>
        <p><a href="/stream/demo/master.m3u8">Video Demo HLS</a></p>
        
        <h2>🚀 Estado del Servidor:</h2>
        <p>✅ Servidor funcionando correctamente en puerto 3000</p>
      </body>
      </html>
    `)
  }
})

export default staticRoutes