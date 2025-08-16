import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import * as fs from 'fs'
import * as path from 'path'
import apiRoutes from './routes/api'
import streamingRoutes from './routes/streaming'
import staticRoutes from './routes/static'

const app = new Hono()

// Configurar CORS
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}))

// Directorios de trabajo
const VIDEOS_DIR = path.join(process.cwd(), 'videos')
const PROCESSED_DIR = path.join(process.cwd(), 'processed_videos')
const EXAMPLE_OUTPUT_DIR = path.join(process.cwd(), 'example-output')

// Crear directorios si no existen
;[VIDEOS_DIR, PROCESSED_DIR, EXAMPLE_OUTPUT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
})

// Configurar rutas
app.route('/', staticRoutes)
app.route('/api', apiRoutes)
app.route('/stream', streamingRoutes)

// Iniciar servidor
serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`🚀 HLS Video Streaming API running on http://localhost:${info.port}`)
  console.log(`📺 Demo video available at: http://localhost:${info.port}/stream/demo/master.m3u8`)
  console.log(`📋 API documentation at: http://localhost:${info.port}/`)
})
