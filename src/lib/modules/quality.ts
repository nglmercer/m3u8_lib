import * as path from 'path';
import { promises as fs } from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { QualityLevel, VideoResolution, VideoMetadata } from '../types';
import { commonResolutions } from '../config/defaults';

export class QualityManager {
  private outputDir: string;
  private videoId: string;

  constructor(outputDir: string, videoId: string) {
    this.outputDir = outputDir;
    this.videoId = videoId;
  }

  /**
   * Obtener metadatos del video para determinar calidades disponibles
   */
  async getVideoMetadata(inputPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, data) => {
        if (err) {
          return reject(new Error(`Error obteniendo metadatos: ${err.message}`));
        }

        const videoStream = data.streams?.find(s => s.codec_type === 'video');
        if (!videoStream) {
          return reject(new Error('No se encontró stream de video'));
        }

        const width = videoStream.width!;
        const height = videoStream.height!;
        const bitrate = videoStream.bit_rate
          ? `${Math.round(Number(videoStream.bit_rate) / 1000)}k`
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
   * Generar múltiples calidades de video
   */
  async generateQualities(
    inputPath: string,
    targetResolutions: string[]
  ): Promise<QualityLevel[]> {
    const metadata = await this.getVideoMetadata(inputPath);
    const qualities: QualityLevel[] = [];
    const processingPromises: Promise<QualityLevel>[] = [];

    // Filtrar resoluciones que no excedan la resolución original
    const validResolutions = targetResolutions.filter(res => {
      const resHeight = parseInt(res.replace('p', ''));
      return resHeight <= metadata.height;
    });

    console.log(`[${this.videoId}] Generando calidades:`, validResolutions);

    for (const resolution of validResolutions) {
      const resolutionConfig = commonResolutions[resolution];
      if (!resolutionConfig) {
        console.warn(`[${this.videoId}] Resolución no soportada: ${resolution}`);
        continue;
      }

      const promise = this.generateSingleQuality(
        inputPath,
        {
          name: resolution,
          size: resolutionConfig.size,
          bitrate: resolutionConfig.bitrate
        },
        metadata
      );

      processingPromises.push(promise);
    }

    const results = await Promise.allSettled(processingPromises);
    
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        qualities.push(result.value);
      } else {
        console.error(`[${this.videoId}] Error generando calidad:`, result.reason.message);
      }
    });

    return qualities.sort((a, b) => a.bandwidth - b.bandwidth);
  }

  /**
   * Generar una calidad específica
   */
  private generateSingleQuality(
    inputPath: string,
    resolution: VideoResolution,
    originalMetadata: VideoMetadata
  ): Promise<QualityLevel> {
    return new Promise((resolve, reject) => {
      const outputPath = path.join(this.outputDir, `${this.videoId}_${resolution.name}.mp4`);
      const bandwidth = parseInt(resolution.bitrate.replace('k', '')) * 1000;

      // Determinar si necesitamos escalar o podemos copiar
      const [targetWidth, targetHeight] = resolution.size.split('x').map(Number);
      const needsScaling = targetWidth !== originalMetadata.width || targetHeight !== originalMetadata.height;

      const command = ffmpeg(inputPath);
      const outputOptions: string[] = [];

      if (needsScaling) {
        console.log(`[${this.videoId}] Escalando a ${resolution.name}`);
        // Usar configuración más simple y compatible
        const audioBitrate = bandwidth <= 1000000 ? '96k' : '128k';
        
        outputOptions.push(
          `-vf scale=${resolution.size}`,
          '-c:v libx264',
          '-preset fast',
          `-b:v ${resolution.bitrate}`,
          '-c:a aac',
          `-b:a ${audioBitrate}`
        );
      } else {
        console.log(`[${this.videoId}] Copiando streams para ${resolution.name}`);
        outputOptions.push('-c:v copy', '-c:a copy');
      }

      command
        .outputOptions(outputOptions)
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log(`[${this.videoId}] Iniciando ${resolution.name}: ${commandLine.substring(0, 100)}...`);
        })
        .on('progress', (progress) => {
          if (progress.percent && Math.round(progress.percent) % 20 === 0) {
            console.log(`[${this.videoId}] ${resolution.name}: ${progress.percent.toFixed(1)}% completado`);
          }
        })
        .on('end', () => {
          console.log(`[${this.videoId}] Completado ${resolution.name}`);
          resolve({
            id: `quality_${resolution.name}`,
            resolution,
            path: outputPath,
            bandwidth
          });
        })
        .on('error', (err: any) => {
          console.error(`[${this.videoId}] Error generando ${resolution.name}:`, err.message);
          reject(new Error(`Error generando ${resolution.name}: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * Añadir nueva calidad a un video existente
   */
  async addQuality(
    inputPath: string,
    targetResolution: string
  ): Promise<QualityLevel> {
    const resolutionConfig = commonResolutions[targetResolution];
    if (!resolutionConfig) {
      throw new Error(`Resolución no soportada: ${targetResolution}`);
    }

    const metadata = await this.getVideoMetadata(inputPath);
    const resHeight = parseInt(targetResolution.replace('p', ''));
    
    if (resHeight > metadata.height) {
      throw new Error(`No se puede escalar a una resolución mayor que la original (${metadata.height}p)`);
    }

    return this.generateSingleQuality(
      inputPath,
      {
        name: targetResolution,
        size: resolutionConfig.size,
        bitrate: resolutionConfig.bitrate
      },
      metadata
    );
  }

  /**
   * Eliminar calidad específica
   */
  async removeQuality(qualityId: string): Promise<void> {
    const qualityPath = path.join(this.outputDir, `${this.videoId}_${qualityId}.mp4`);
    
    try {
      await fs.access(qualityPath);
      await fs.unlink(qualityPath);
      console.log(`[${this.videoId}] Calidad ${qualityId} eliminada`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.warn(`[${this.videoId}] Calidad ${qualityId} no encontrada`);
      } else {
        throw new Error(`Error eliminando calidad ${qualityId}: ${error.message}`);
      }
    }
  }

  /**
   * Modificar calidad existente
   */
  async modifyQuality(
    inputPath: string,
    qualityId: string,
    newResolution: VideoResolution
  ): Promise<QualityLevel> {
    // Primero eliminar la calidad existente
    await this.removeQuality(qualityId);
    
    // Luego generar la nueva calidad
    const metadata = await this.getVideoMetadata(inputPath);
    return this.generateSingleQuality(inputPath, newResolution, metadata);
  }

  /**
   * Listar calidades disponibles
   */
  async listAvailableQualities(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.outputDir);
      const qualityFiles = files.filter(file => 
        file.startsWith(`${this.videoId}_`) && file.endsWith('.mp4')
      );
      
      return qualityFiles.map(file => {
        const match = file.match(new RegExp(`${this.videoId}_(\d+p)\.mp4`));
        return match ? match[1] : '';
      }).filter(Boolean);
    } catch (error: any) {
      console.error(`[${this.videoId}] Error listando calidades:`, error.message);
      return [];
    }
  }

  /**
   * Obtener resoluciones recomendadas basadas en el video original
   */
  async getRecommendedQualities(inputPath: string): Promise<string[]> {
    const metadata = await this.getVideoMetadata(inputPath);
    const originalHeight = metadata.height;
    
    const allQualities = Object.keys(commonResolutions);
    const recommended = allQualities.filter(quality => {
      const height = parseInt(quality.replace('p', ''));
      return height <= originalHeight;
    });

    // Siempre incluir algunas calidades estándar
    const standardQualities = ['360p', '480p', '720p'];
    const finalQualities = [...new Set([...recommended, ...standardQualities])]
      .filter(quality => {
        const height = parseInt(quality.replace('p', ''));
        return height <= originalHeight;
      })
      .sort((a, b) => parseInt(a.replace('p', '')) - parseInt(b.replace('p', '')));

    return finalQualities;
  }

  /**
   * Optimizar calidades automáticamente
   */
  async autoOptimizeQualities(
    inputPath: string,
    targetBandwidths: number[] = [500000, 1000000, 2000000, 5000000]
  ): Promise<QualityLevel[]> {
    const metadata = await this.getVideoMetadata(inputPath);
    const qualities: QualityLevel[] = [];
    
    for (const bandwidth of targetBandwidths) {
      const bitrate = `${Math.floor(bandwidth / 1000)}k`;
      
      // Determinar resolución apropiada para el bandwidth
      let targetResolution: VideoResolution;
      
      if (bandwidth <= 500000) {
        targetResolution = { name: '360p', size: '640x360', bitrate };
      } else if (bandwidth <= 1000000) {
        targetResolution = { name: '480p', size: '854x480', bitrate };
      } else if (bandwidth <= 2000000) {
        targetResolution = { name: '720p', size: '1280x720', bitrate };
      } else {
        targetResolution = { name: '1080p', size: '1920x1080', bitrate };
      }
      
      // Verificar que no exceda la resolución original
      const targetHeight = parseInt(targetResolution.name.replace('p', ''));
      if (targetHeight <= metadata.height) {
        try {
          const quality = await this.generateSingleQuality(inputPath, targetResolution, metadata);
          qualities.push(quality);
        } catch (error: any) {
          console.error(`[${this.videoId}] Error generando calidad optimizada:`, error.message);
        }
      }
    }
    
    return qualities;
  }

  /**
   * Generar playlist HLS con múltiples calidades
   */
  async generateHlsWithQualities(
    masterPlaylistPath: string,
    qualities: QualityLevel[]
  ): Promise<void> {
    try {
      let content = '#EXTM3U\n#EXT-X-VERSION:3\n';
      
      // Ordenar calidades por bandwidth
      const sortedQualities = qualities.sort((a, b) => a.bandwidth - b.bandwidth);
      
      sortedQualities.forEach(quality => {
        content += `#EXT-X-STREAM-INF:BANDWIDTH=${quality.bandwidth},RESOLUTION=${quality.resolution.size}\n`;
        content += `${quality.id}.m3u8\n`;
      });
      
      await fs.writeFile(masterPlaylistPath, content);
      console.log(`[${this.videoId}] Playlist maestro actualizado con ${qualities.length} calidades`);
    } catch (error: any) {
      console.error(`[${this.videoId}] Error actualizando playlist con calidades:`, error.message);
      throw error;
    }
  }
}

// Funciones de conveniencia
export async function generateVideoQualities(
  inputPath: string,
  targetResolutions: string[],
  outputDir: string,
  videoId: string
): Promise<QualityLevel[]> {
  const manager = new QualityManager(outputDir, videoId);
  return manager.generateQualities(inputPath, targetResolutions);
}

export async function addVideoQuality(
  inputPath: string,
  targetResolution: string,
  outputDir: string,
  videoId: string
): Promise<QualityLevel> {
  const manager = new QualityManager(outputDir, videoId);
  return manager.addQuality(inputPath, targetResolution);
}

export async function getRecommendedVideoQualities(
  inputPath: string,
  outputDir: string,
  videoId: string
): Promise<string[]> {
  const manager = new QualityManager(outputDir, videoId);
  return manager.getRecommendedQualities(inputPath);
}

export async function autoOptimizeVideoQualities(
  inputPath: string,
  outputDir: string,
  videoId: string,
  targetBandwidths?: number[]
): Promise<QualityLevel[]> {
  const manager = new QualityManager(outputDir, videoId);
  return manager.autoOptimizeQualities(inputPath, targetBandwidths);
}