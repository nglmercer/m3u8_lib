import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import * as path from 'path'

const staticRoutes = new Hono()

// Configurar el directorio público para archivos estáticos
const publicPath = path.join(__dirname, '../../public')

// Servir archivos estáticos desde el directorio public
staticRoutes.use('/*', serveStatic({
  root: publicPath,
  index: 'index.html'
}))

// Ruta específica para la raíz que sirve index.html
staticRoutes.get('/', serveStatic({
  path: './index.html',
  root: publicPath
}))

export default staticRoutes