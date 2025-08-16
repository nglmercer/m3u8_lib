# HLS Video Library

Una librería TypeScript completa para la conversión de videos a formato HLS (HTTP Live Streaming) con capacidades avanzadas de gestión de subtítulos, pistas de audio y múltiples calidades de video.

## Características

- ✅ **Conversión a HLS**: Convierte videos a formato M3U8 con segmentación automática
- ✅ **Gestión de Subtítulos**: Añadir, modificar y eliminar subtítulos (SRT, VTT, ASS)
- ✅ **Gestión de Audio**: Manipular múltiples pistas de audio con diferentes idiomas
- ✅ **Múltiples Calidades**: Generar automáticamente diferentes resoluciones y bitrates
- ✅ **TypeScript**: Completamente tipado para mejor experiencia de desarrollo
- ✅ **Modular**: Arquitectura modular para usar solo las funcionalidades necesarias
- ✅ **Optimización Automática**: Algoritmos inteligentes para optimizar calidades según el contenido

## Instalación

```bash
npm install
npm run build:lib
```

### Dependencias del Sistema

Esta librería requiere FFmpeg instalado en el sistema:

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows
# Descargar desde https://ffmpeg.org/download.html
```

## Desarrollo

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# Compilar la librería
npm run build:lib

# Ejecutar tests
npm test
```

Abrir http://localhost:3000 para ver la aplicación en desarrollo.

## Uso Básico

### Conversión Simple a HLS

```typescript
import { HlsLibrary, createHlsLibrary } from './src/lib';

// Crear instancia de la librería
const hlsLib = createHlsLibrary('./output', 'video-001');

// Convertir video a HLS
const result = await hlsLib.convertVideo('./input/video.mp4', {
  basePath: 'videos/',
  resolutions: ['360p', '720p', '1080p'],
  includeSubtitles: true,
  includeMultipleAudio: true,
  autoOptimize: true
});

console.log('Conversión completada:', result.masterPlaylistUrl);
```

### Uso Modular

```typescript
import { 
  HlsConverter, 
  SubtitleManager, 
  AudioManager, 
  QualityManager 
} from './src/lib';

// Solo conversión HLS
const converter = new HlsConverter();
const result = await converter.convertToHls(
  './input/video.mp4',
  { videoId: 'video-001', basePath: 'videos/' }
);

// Solo gestión de subtítulos
const subtitleManager = new SubtitleManager('./output', 'video-001');
const subtitles = await subtitleManager.extractSubtitles('./input/video.mp4');
```

## API Detallada

### HlsLibrary (Clase Principal)

```typescript
const hlsLib = new HlsLibrary(outputDir: string, videoId: string, options?: HlsOptions);
```

#### Métodos

- `convertVideo(inputPath, options)`: Conversión completa con todas las opciones
- `subtitles`: Acceso al gestor de subtítulos
- `audio`: Acceso al gestor de audio
- `quality`: Acceso al gestor de calidades

### Gestión de Subtítulos

```typescript
const subtitleManager = new SubtitleManager(outputDir, videoId);

// Extraer subtítulos existentes
const subtitles = await subtitleManager.extractSubtitles('./video.mp4');

// Añadir subtítulo externo
const result = await subtitleManager.addSubtitle(
  './video.mp4',
  './subtitles.srt',
  {
    id: 'sub_es',
    language: 'es',
    label: 'Español',
    format: 'srt',
    isDefault: false
  }
);

// Eliminar subtítulos
const cleanVideo = await subtitleManager.removeSubtitles('./video.mp4');

// Modificar subtítulo existente
const modified = await subtitleManager.modifySubtitle(
  './video.mp4',
  0, // índice del subtítulo
  './new-subtitles.srt',
  { language: 'en', label: 'English' }
);
```

### Gestión de Audio

```typescript
const audioManager = new AudioManager(outputDir, videoId);

// Extraer información de pistas de audio
const audioTracks = await audioManager.extractAudioTracks('./video.mp4');

// Añadir pista de audio externa
const result = await audioManager.addAudioTrack(
  './video.mp4',
  './audio-spanish.aac',
  {
    language: 'es',
    label: 'Español',
    codec: 'aac',
    bitrate: '128k',
    channels: 2,
    isDefault: false
  }
);

// Eliminar pista de audio
const result = await audioManager.removeAudioTrack('./video.mp4', 1);

// Convertir calidad de audio
const highQuality = await audioManager.convertAudioQuality('./video.mp4', 'high');

// Extraer pista de audio como archivo separado
const audioFile = await audioManager.extractAudioTrack('./video.mp4', 0);
```

### Gestión de Calidades

```typescript
const qualityManager = new QualityManager(outputDir, videoId);

// Generar múltiples calidades
const qualities = await qualityManager.generateQualities(
  './video.mp4',
  ['360p', '480p', '720p', '1080p']
);

// Añadir una calidad específica
const quality = await qualityManager.addQuality('./video.mp4', '720p');

// Obtener calidades recomendadas
const recommended = await qualityManager.getRecommendedQualities('./video.mp4');

// Optimización automática
const optimized = await qualityManager.autoOptimizeQualities(
  './video.mp4',
  [500000, 1000000, 2000000, 5000000] // bandwidths objetivo
);

// Eliminar calidad
await qualityManager.removeQuality('720p');

// Listar calidades disponibles
const available = await qualityManager.listAvailableQualities();
```

## Estructura del Proyecto

```
src/
├── lib/                    # Librería HLS
│   ├── types/             # Definiciones de tipos TypeScript
│   ├── config/            # Configuraciones por defecto
│   ├── core/              # Funcionalidad principal de conversión
│   ├── modules/           # Módulos especializados
│   │   ├── subtitles.ts   # Gestión de subtítulos
│   │   ├── audio.ts       # Gestión de audio
│   │   └── quality.ts     # Gestión de calidades
│   └── index.ts           # Exportaciones principales
├── hls/                   # Código original (referencia)
└── ...
```

## Tipos TypeScript

```typescript
interface VideoResolution {
  name: string;
  size: string;
  bitrate: string;
  isOriginal?: boolean;
}

interface SubtitleTrack {
  id: string;
  language: string;
  label: string;
  path: string;
  format: 'srt' | 'vtt' | 'ass';
  isDefault?: boolean;
}

interface AudioTrack {
  id: string;
  language: string;
  label: string;
  codec: string;
  bitrate: string;
  channels: number;
  isDefault?: boolean;
}

interface QualityLevel {
  id: string;
  resolution: VideoResolution;
  path: string;
  bandwidth: number;
}
```

## Ejemplo de Uso Completo

```typescript
import { createHlsLibrary } from './src/lib';
import path from 'path';

async function processVideo(inputPath: string, videoId: string) {
  const outputDir = path.join('./processed_videos', videoId);
  const hlsLib = createHlsLibrary(outputDir, videoId);
  
  try {
    // Conversión completa con todas las características
    const result = await hlsLib.convertVideo(inputPath, {
      basePath: 'streaming/',
      resolutions: ['360p', '480p', '720p', '1080p'],
      includeSubtitles: true,
      includeMultipleAudio: true,
      autoOptimize: true
    });
    
    console.log('✅ Video procesado exitosamente');
    console.log('📁 Directorio de salida:', result.outputDir);
    console.log('🎬 URL del playlist maestro:', result.masterPlaylistUrl);
    
    return result;
  } catch (error) {
    console.error('❌ Error procesando video:', error.message);
    throw error;
  }
}

// Uso
processVideo('./videos/movie.mp4', 'movie-001')
  .then(result => console.log('Listo para streaming!', result.masterPlaylistUrl))
  .catch(console.error);
```

## Manejo de Errores

```typescript
try {
  const result = await hlsLib.convertVideo('./video.mp4');
} catch (error) {
  if (error.message.includes('ffprobe')) {
    console.error('Error de FFmpeg - verificar instalación');
  } else if (error.message.includes('ENOENT')) {
    console.error('Archivo no encontrado');
  } else {
    console.error('Error desconocido:', error.message);
  }
}
```

## Scripts Disponibles

- `npm run dev` - Ejecutar en modo desarrollo
- `npm run build` - Compilar aplicación
- `npm run build:lib` - Compilar solo la librería
- `npm test` - Ejecutar tests
- `npm run clean` - Limpiar archivos compilados

## Licencia

MIT License

---

**Desarrollado con ❤️ para la comunidad de streaming de video**
