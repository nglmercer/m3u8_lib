import * as path from 'path';
import { promises as fs } from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { HlsOptions, ConversionParams, ConversionResult, ProcessedResolution, VideoMetadata, VideoResolution } from '../types';
import { defaultHlsOptions } from '../config/defaults';

// Configurar rutas de FFmpeg y FFprobe
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}
if (ffprobeStatic && typeof ffprobeStatic === 'string') {
  ffmpeg.setFfprobePath(ffprobeStatic);
}

// Definir rutas relativas a la raíz del proyecto
const PROJECT_ROOT = path.join(__dirname, '../../..');
const PROCESSED_DIR = path.join(PROJECT_ROOT, 'processed_videos');
const VIDEOS_DIR = path.join(PROJECT_ROOT, 'videos');

export class HlsConverter {
  private options: HlsOptions;
  private customOutputDir?: string;

  constructor(options: Partial<HlsOptions> = {}, customOutputDir?: string) {
    this.options = { ...defaultHlsOptions, ...options };
    this.customOutputDir = customOutputDir;
  }

  /**
   * Asegurar que un directorio existe
   */
  private async ensureDirExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        try {
          await fs.mkdir(dirPath, { recursive: true });
          console.log(`Directorio creado: ${dirPath}`);
        } catch (mkdirError) {
          console.error(`Error creando directorio ${dirPath}:`, mkdirError);
          throw mkdirError;
        }
      } else {
        console.error(`Error accediendo al directorio ${dirPath}:`, error);
        throw error;
      }
    }
  }

  /**
   * Obtener metadatos del video usando ffprobe
   */
  private async getVideoMetadata(inputPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, data) => {
        if (err) {
          return reject(new Error(`Error de ffprobe: ${err.message}`));
        }
        if (!data) {
          return reject(new Error('ffprobe no devolvió datos.'));
        }

        const videoStream = data.streams?.find(s => s.codec_type === 'video');
        if (!videoStream) {
          throw new Error('No se encontró stream de video');
        }

        const width = videoStream.width!;
        const height = videoStream.height!;
        const bitrate = videoStream.bit_rate
          ? `${Math.round(Number(videoStream.bit_rate) / 1000)}k`
          : data.format?.bit_rate
            ? `${Math.round(data.format.bit_rate / 1000)}k`
            : '5000k';

        resolve({
          width,
          height,
          bitrate,
          duration: data.format?.duration,
          codec: videoStream.codec_name
        });
      });
    });
  }

  /**
   * Procesar una resolución específica
   */
  private processResolution(
    inputPath: string,
    outputDir: string,
    resolutionInfo: VideoResolution & { isOriginal?: boolean },
    videoId: string
  ): Promise<ProcessedResolution> {
    return new Promise(async (resolve, reject) => {
      const { name, size, bitrate, isOriginal } = resolutionInfo;
      const {
        hlsTime, hlsPlaylistType, copyCodecsThresholdHeight,
        audioCodec, audioBitrate, videoCodec, videoProfile, crf, gopSize,
        segmentNameTemplate, resolutionPlaylistName
      } = this.options;

      const resOutputDir = path.join(outputDir, name);
      const playlistPath = path.join(resOutputDir, resolutionPlaylistName);
      const segmentPath = path.join(resOutputDir, segmentNameTemplate);
      const bandwidth = parseInt(String(bitrate).replace('k', '')) * 1000 || 500000;

      await this.ensureDirExists(resOutputDir);

      const command = ffmpeg(inputPath);
      const outputOptions: string[] = [];

      // Determinar si debemos copiar códecs o re-codificar
      const shouldCopyCodecs = isOriginal && parseInt(name) <= copyCodecsThresholdHeight;

      if (shouldCopyCodecs) {
        console.log(`[${videoId}] Segmentando resolución ${name} copiando streams.`);
        outputOptions.push('-c:v copy', '-c:a copy');
      } else {
        console.log(`[${videoId}] Re-codificando a ${name}.`);
        outputOptions.push(
          `-vf scale=${size}`,
          `-c:a ${audioCodec}`, `-ar 48000`, `-b:a ${audioBitrate}`,
          `-c:v ${videoCodec}`, `-profile:v ${videoProfile}`, `-crf ${crf}`, `-sc_threshold 0`,
          `-g ${gopSize}`, `-keyint_min ${gopSize}`,
          `-b:v ${bitrate}`,
          `-maxrate ${Math.floor(bandwidth * 1.2 / 1000)}k`,
          `-bufsize ${Math.floor(bandwidth * 1.5 / 1000)}k`
        );
      }

      // Opciones comunes de HLS
      outputOptions.push(
        `-hls_time ${hlsTime}`,
        `-hls_playlist_type ${hlsPlaylistType}`,
        `-hls_segment_filename ${segmentPath}`
      );

      command
        .outputOptions(outputOptions)
        .output(playlistPath)
        .on('start', (commandLine) => {
          console.log(`[${videoId}] Iniciado procesamiento ${name}: ${commandLine.substring(0, 200)}...`);
        })
        .on('progress', (progress) => {
          if (progress.percent && Math.round(progress.percent) % 10 === 0) {
            console.log(`[${videoId}] Procesando ${name}: ${progress.percent.toFixed(2)}% completado`);
          }
        })
        .on('end', () => {
          console.log(`[${videoId}] Terminado procesamiento ${name}`);
          resolve({
            name,
            size,
            bitrate,
            bandwidth,
            playlistRelativePath: `${name}/${resolutionPlaylistName}`
          });
        })
        .on('error', (err) => {
          console.error(`[${videoId}] Error procesando ${name}:`, err.message);
          reject(new Error(`Error procesando ${name}: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * Convertir video a HLS
   */
  async convertToHls(
    inputPath: string,
    params: ConversionParams,
    userOptions: Partial<HlsOptions> = {}
  ): Promise<ConversionResult> {
    const options = { ...this.options, ...userOptions };
    const { videoId, basePath = '' } = params;
    const baseDir = this.customOutputDir || PROCESSED_DIR;
    const outputDir = path.join(baseDir, videoId);

    try {
      await this.ensureDirExists(outputDir);
    } catch (err: any) {
      throw new Error(`Falló al asegurar que el directorio de salida existe: ${err.message}`);
    }

    // Obtener información del video original
    let metadata: VideoMetadata;
    try {
      metadata = await this.getVideoMetadata(inputPath);
      console.log(`[${videoId}] Resolución original: ${metadata.width}x${metadata.height}, Bitrate: ${metadata.bitrate}`);

      if (!metadata.width || !metadata.height) {
        throw new Error('No se pudieron determinar las dimensiones del video original.');
      }
    } catch (err: any) {
      console.error(`[${videoId}] Error obteniendo metadatos del video:`, err.message);
      throw new Error(`Falló al obtener metadatos del video: ${err.message}`);
    }

    // Preparar resoluciones objetivo
    const targetResolutions = [...options.resolutions];
    const originalResName = `${metadata.height}p`;
    const originalAlreadyDefined = targetResolutions.some(r => r.name === originalResName);

    // Agregar resolución original si no está ya definida
    if (!originalAlreadyDefined && metadata.width && metadata.height) {
      const isDifferent = !targetResolutions.some(r => r.size === `${metadata.width}x${metadata.height}`);
      if (isDifferent) {
        targetResolutions.push({
          name: originalResName,
          size: `${metadata.width}x${metadata.height}`,
          bitrate: metadata.bitrate,
          isOriginal: true
        });
        targetResolutions.sort((a, b) => parseInt(a.name) - parseInt(b.name));
      } else {
        const existingRes = targetResolutions.find(r => r.size === `${metadata.width}x${metadata.height}`);
        if (existingRes) (existingRes as any).isOriginal = true;
      }
    }

    console.log(`[${videoId}] Resoluciones objetivo:`, targetResolutions.map(r => r.name));

    // Procesar resoluciones concurrentemente
    const processingPromises = targetResolutions.map(resInfo =>
      this.processResolution(inputPath, outputDir, resInfo, videoId)
    );

    try {
      const results = await Promise.allSettled(processingPromises);

      const successfulResults: ProcessedResolution[] = [];
      const errors: any[] = [];
      
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          successfulResults.push(result.value);
        } else {
          errors.push(result.reason);
          console.error(`[${videoId}] Una tarea de procesamiento de resolución falló:`, result.reason.message || result.reason);
        }
      });

      if (errors.length > 0) {
        throw new Error(`La conversión HLS falló para ${errors.length} resolución(es).`);
      }

      if (successfulResults.length === 0) {
        throw new Error('La conversión HLS no resultó en resoluciones exitosas.');
      }

      // Crear playlist maestro
      const newBasePath = basePath ? basePath.endsWith('/') ? basePath : `${basePath}/` : '';
      const proxyBaseUrl = options.proxyBaseUrlTemplate
        .replace('{videoId}', videoId)
        .replace('{basePath}', newBasePath);
      
      let masterPlaylistContent = '#EXTM3U\n#EXT-X-VERSION:3\n';

      successfulResults.sort((a, b) => a.bandwidth - b.bandwidth);

      successfulResults.forEach(res => {
        const newRelativePath = `${proxyBaseUrl}${res.playlistRelativePath}`;
        // Add codec information for better browser compatibility
        const codecs = 'avc1.42E01E,mp4a.40.2'; // H.264 Baseline Profile + AAC-LC
        masterPlaylistContent += `#EXT-X-STREAM-INF:BANDWIDTH=${res.bandwidth},RESOLUTION=${res.size},CODECS="${codecs}"\n`;
        masterPlaylistContent += `${newRelativePath}\n`;
      });

      const masterPlaylistPath = path.join(outputDir, options.masterPlaylistName);
      await fs.writeFile(masterPlaylistPath, masterPlaylistContent);
      console.log(`[${videoId}] Playlist maestro creado exitosamente: ${masterPlaylistPath}`);

      return {
        message: 'Conversión HLS exitosa',
        outputDir,
        masterPlaylistPath,
        masterPlaylistUrl: `${proxyBaseUrl}${options.masterPlaylistName}`
      };

    } catch (error: any) {
      console.error(`[${videoId}] Error durante el proceso de conversión HLS:`, error.message);
      throw error;
    }
  }

  /**
   * Obtener directorio de videos procesados
   */
  static get PROCESSED_DIR(): string {
    return PROCESSED_DIR;
  }

  /**
   * Obtener directorio de videos
   */
  static get VIDEOS_DIR(): string {
    return VIDEOS_DIR;
  }
}

// Función de conveniencia para mantener compatibilidad
export async function convertToHls(
  inputPath: string,
  params: ConversionParams,
  userOptions: Partial<HlsOptions> = {}
): Promise<ConversionResult> {
  const converter = new HlsConverter(userOptions);
  return converter.convertToHls(inputPath, params, userOptions);
}

// Función de conveniencia para asegurar que existe un directorio
export async function ensureDirExists(dirPath: string): Promise<void> {
  const converter = new HlsConverter();
  return (converter as any).ensureDirExists(dirPath);
}