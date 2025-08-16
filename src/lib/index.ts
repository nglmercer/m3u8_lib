// Exportaciones principales de la librería HLS

// Tipos e interfaces
export * from './types';

// Configuración por defecto
export * from './config/defaults';

// Convertidor principal
export { HlsConverter, convertToHls, ensureDirExists } from './core/converter';

// Utilidades M3U8
export { M3U8Builder, createM3U8Builder, validateM3U8Content } from './utils/m3u8-builder';
export type {
  M3U8MediaTrack,
  M3U8StreamInfo,
  M3U8PlaylistOptions
} from './utils/m3u8-builder';

// Importar para uso interno
import { HlsConverter } from './core/converter';

// Módulos de gestión
export { 
  SubtitleManager,
  addSubtitleToVideo,
  removeSubtitlesFromVideo,
  extractSubtitlesFromVideo
} from './modules/subtitles';

export {
  AudioManager,
  addAudioTrackToVideo,
  removeAudioTrackFromVideo,
  extractAudioTracksFromVideo,
  convertVideoAudioQuality
} from './modules/audio';

export {
  QualityManager,
  generateVideoQualities,
  addVideoQuality,
  getRecommendedVideoQualities,
  autoOptimizeVideoQualities
} from './modules/quality';

// Clase principal que integra todas las funcionalidades
export class HlsLibrary {
  private converter: HlsConverter;
  private outputDir: string;
  private videoId: string;

  constructor(outputDir: string, videoId: string, options?: any) {
    this.outputDir = outputDir;
    this.videoId = videoId;
    this.converter = new HlsConverter(options);
  }

  /**
   * Convertir video a HLS con todas las opciones
   */
  async convertVideo(
    inputPath: string,
    options?: {
      basePath?: string;
      resolutions?: string[];
      includeSubtitles?: boolean;
      includeMultipleAudio?: boolean;
      autoOptimize?: boolean;
    }
  ) {
    const { basePath = '', resolutions = [], includeSubtitles = false, includeMultipleAudio = false, autoOptimize = false } = options || {};

    // Conversión básica a HLS
    const result = await this.converter.convertToHls(
      inputPath,
      { videoId: this.videoId, basePath }
    );

    // Generar calidades adicionales si se especifican
    if (resolutions.length > 0) {
      const qualityManager = new (await import('./modules/quality')).QualityManager(this.outputDir, this.videoId);
      await qualityManager.generateQualities(inputPath, resolutions);
    }

    // Auto-optimizar calidades si se solicita
    if (autoOptimize) {
      const qualityManager = new (await import('./modules/quality')).QualityManager(this.outputDir, this.videoId);
      await qualityManager.autoOptimizeQualities(inputPath);
    }

    // Incluir subtítulos si se solicita
    if (includeSubtitles) {
      const subtitleManager = new (await import('./modules/subtitles')).SubtitleManager(this.outputDir, this.videoId);
      const subtitles = await subtitleManager.extractSubtitles(inputPath);
      if (subtitles.length > 0) {
        await subtitleManager.generateHlsWithSubtitles(result.masterPlaylistPath, subtitles);
      }
    }

    // Incluir múltiples pistas de audio si se solicita
    if (includeMultipleAudio) {
      const audioManager = new (await import('./modules/audio')).AudioManager(this.outputDir, this.videoId);
      const audioTracks = await audioManager.extractAudioTracks(inputPath);
      if (audioTracks.length > 1) {
        await audioManager.generateHlsWithAudio(result.masterPlaylistPath, audioTracks);
      }
    }

    return result;
  }

  /**
   * Gestionar subtítulos
   */
  get subtitles() {
    const { SubtitleManager } = require('./modules/subtitles');
    return new SubtitleManager(this.outputDir, this.videoId);
  }

  /**
   * Gestionar audio
   */
  get audio() {
    const { AudioManager } = require('./modules/audio');
    return new AudioManager(this.outputDir, this.videoId);
  }

  /**
   * Gestionar calidades
   */
  get quality() {
    const { QualityManager } = require('./modules/quality');
    return new QualityManager(this.outputDir, this.videoId);
  }
}

// Función de conveniencia para crear una instancia de la librería
export function createHlsLibrary(outputDir: string, videoId: string, options?: any): HlsLibrary {
  return new HlsLibrary(outputDir, videoId, options);
}

// Exportación por defecto
export default HlsLibrary;