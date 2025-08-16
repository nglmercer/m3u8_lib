import { HlsOptions } from '../types';

// Configuración por defecto para la conversión HLS
export const defaultHlsOptions: HlsOptions = {
  resolutions: [
    // Las resoluciones se pueden agregar dinámicamente
    // { name: '480p', size: '854x480', bitrate: '800k' },
    // { name: '720p', size: '1280x720', bitrate: '1500k' },
    // { name: '1080p', size: '1920x1080', bitrate: '2800k' }
  ],
  hlsTime: 10, // Duración del segmento en segundos
  hlsPlaylistType: 'vod', // 'vod' o 'event'
  copyCodecsThresholdHeight: 720, // Altura máxima para considerar copiar códecs originales
  audioCodec: 'aac',
  audioBitrate: '128k',
  videoCodec: 'h264',
  videoProfile: 'main',
  crf: 20, // Factor de tasa constante (menor = mejor calidad, archivo más grande)
  gopSize: 48, // Tamaño del grupo de imágenes (intervalo de keyframe)
  proxyBaseUrlTemplate: 'http://localhost:3000/stream-resource/{basePath}{videoId}/',
  masterPlaylistName: 'master.m3u8',
  segmentNameTemplate: 'segment%03d.ts',
  resolutionPlaylistName: 'playlist.m3u8'
};

// Resoluciones predefinidas comunes
export const commonResolutions: Record<string, { size: string; bitrate: string }> = {
  '240p': { size: '426x240', bitrate: '600k' },
  '360p': { size: '640x360', bitrate: '800k' },
  '480p': { size: '854x480', bitrate: '1200k' },
  '720p': { size: '1280x720', bitrate: '1500k' },
  '1080p': { size: '1920x1080', bitrate: '2800k' },
  '1440p': { size: '2560x1440', bitrate: '5000k' },
  '2160p': { size: '3840x2160', bitrate: '8000k' }
};

// Configuraciones de audio predefinidas
export const audioConfigs = {
  low: { bitrate: '96k', codec: 'aac' },
  medium: { bitrate: '128k', codec: 'aac' },
  high: { bitrate: '192k', codec: 'aac' },
  lossless: { bitrate: '320k', codec: 'aac' }
};