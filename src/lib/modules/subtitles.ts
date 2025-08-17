import * as path from 'path';
import { promises as fs } from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { SubtitleTrack } from '../types';

// Configurar rutas de FFmpeg y FFprobe
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}
if (ffprobeStatic && typeof ffprobeStatic === 'string') {
  ffmpeg.setFfprobePath(ffprobeStatic);
}

export class SubtitleManager {
  private outputDir: string;
  private videoId: string;

  constructor(outputDir: string, videoId: string) {
    this.outputDir = outputDir;
    this.videoId = videoId;
  }

  /**
   * Extraer subtítulos existentes del video
   */
  async extractSubtitles(inputPath: string): Promise<SubtitleTrack[]> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, data) => {
        if (err) {
          return reject(new Error(`Error extrayendo subtítulos: ${err.message}`));
        }

        const subtitleStreams = data.streams?.filter(s => s.codec_type === 'subtitle') || [];
        const tracks: SubtitleTrack[] = [];

        subtitleStreams.forEach((stream, index) => {
          const language = stream.tags?.language || 'unknown';
          const title = stream.tags?.title || `Subtitle ${index + 1}`;
          
          tracks.push({
            id: `sub_${index}`,
            language,
            label: title,
            path: '',
            format: this.detectSubtitleFormat(stream.codec_name || 'srt'),
            isDefault: index === 0
          });
        });

        resolve(tracks);
      });
    });
  }

  /**
   * Detectar formato de subtítulo basado en el codec
   */
  private detectSubtitleFormat(codecName: string): 'srt' | 'vtt' | 'ass' {
    switch (codecName.toLowerCase()) {
      case 'webvtt':
      case 'vtt':
        return 'vtt';
      case 'ass':
      case 'ssa':
        return 'ass';
      default:
        return 'srt';
    }
  }

  /**
   * Añadir subtítulos externos al video
   */
  async addSubtitle(
    inputVideoPath: string,
    subtitlePath: string,
    subtitleInfo: Omit<SubtitleTrack, 'path'>
  ): Promise<string> {
    // Generate unique output filename to avoid conflicts
    const timestamp = Date.now();
    const outputPath = path.join(this.outputDir, `${this.videoId}_with_${subtitleInfo.language}_${timestamp}.mp4`);
    // Generate an ID if not provided
    const subtitleId = (subtitleInfo as any).id || `sub_${subtitleInfo.language}_${timestamp}`;
    const vttOutputPath = path.join(this.outputDir, `${subtitleId}.vtt`);

    return new Promise((resolve, reject) => {
      // Primero convertir subtítulo a VTT si no lo es
      if (subtitleInfo.format !== 'vtt') {
        this.convertToVtt(subtitlePath, vttOutputPath)
          .then(() => {
            // Luego añadir al video
            this.embedSubtitleInVideo(inputVideoPath, vttOutputPath, outputPath, subtitleInfo)
              .then(() => resolve(outputPath))
              .catch(reject);
          })
          .catch(reject);
      } else {
        this.embedSubtitleInVideo(inputVideoPath, subtitlePath, outputPath, subtitleInfo)
          .then(() => resolve(outputPath))
          .catch(reject);
      }
    });
  }

  /**
   * Convertir subtítulo a formato VTT
   */
  async convertToVtt(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions(['-f', 'webvtt'])
        .output(outputPath)
        .on('end', () => {
          console.log(`[${this.videoId}] Subtítulo convertido a VTT: ${outputPath}`);
          resolve();
        })
        .on('error', (err: any) => {
          console.error(`[${this.videoId}] Error convirtiendo subtítulo:`, err.message);
          reject(new Error(`Error convirtiendo subtítulo: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * Embebir subtítulo en el video
   */
  private embedSubtitleInVideo(
    videoPath: string,
    subtitlePath: string,
    outputPath: string,
    subtitleInfo: Omit<SubtitleTrack, 'path'>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg()
        .input(videoPath)
        .input(subtitlePath)
        .outputOptions([
          '-c:v', 'copy',
          '-c:a', 'copy',
          '-c:s', 'mov_text',
          '-metadata:s:s:0', `language=${subtitleInfo.language}`,
          '-metadata:s:s:0', `title=${subtitleInfo.label}`
        ])
        .output(outputPath);

      if (subtitleInfo.isDefault) {
        command.outputOptions(['-disposition:s:0', 'default']);
      }

      command
        .on('start', (commandLine) => {
          console.log(`[${this.videoId}] FFmpeg command: ${commandLine}`);
        })
        .on('end', () => {
          console.log(`[${this.videoId}] Subtítulo añadido exitosamente`);
          resolve();
        })
        .on('error', (err: any) => {
          console.error(`[${this.videoId}] Error añadiendo subtítulo:`, err.message);
          reject(new Error(`Error añadiendo subtítulo: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * Eliminar subtítulos del video
   */
  async removeSubtitles(inputPath: string): Promise<string> {
    const outputPath = path.join(this.outputDir, `${this.videoId}_no_subs.mp4`);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-c:v copy',
          '-c:a copy',
          '-sn' // Eliminar todos los subtítulos
        ])
        .output(outputPath)
        .on('end', () => {
          console.log(`[${this.videoId}] Subtítulos eliminados exitosamente`);
          resolve(outputPath);
        })
        .on('error', (err: any) => {
          console.error(`[${this.videoId}] Error eliminando subtítulos:`, err.message);
          reject(new Error(`Error eliminando subtítulos: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * Modificar subtítulos existentes
   */
  async modifySubtitle(
    inputPath: string,
    subtitleIndex: number,
    newSubtitlePath: string,
    subtitleInfo: Partial<SubtitleTrack>
  ): Promise<string> {
    const outputPath = path.join(this.outputDir, `${this.videoId}_modified_subs.mp4`);

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .input(newSubtitlePath)
        .outputOptions([
          '-c:v copy',
          '-c:a copy',
          '-c:s webvtt',
          `-map 0:v`,
          `-map 0:a`,
          `-map 1:s:0`
        ]);

      if (subtitleInfo.language) {
        command.outputOptions([`-metadata:s:s:${subtitleIndex} language=${subtitleInfo.language}`]);
      }

      if (subtitleInfo.label) {
        command.outputOptions([`-metadata:s:s:${subtitleIndex} title="${subtitleInfo.label}"`]);
      }

      if (subtitleInfo.isDefault) {
        command.outputOptions([`-disposition:s:${subtitleIndex} default`]);
      }

      command
        .output(outputPath)
        .on('end', () => {
          console.log(`[${this.videoId}] Subtítulo modificado exitosamente`);
          resolve(outputPath);
        })
        .on('error', (err: any) => {
          console.error(`[${this.videoId}] Error modificando subtítulo:`, err.message);
          reject(new Error(`Error modificando subtítulo: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * Generar playlist M3U8 para subtítulos individuales
   */
  async generateSubtitlePlaylist(
    vttFilePath: string,
    language: string,
    duration?: number
  ): Promise<string> {
    const subtitlesDir = path.join(this.outputDir, 'subtitles');
    await fs.mkdir(subtitlesDir, { recursive: true });
    
    const playlistPath = path.join(subtitlesDir, `${language}.m3u8`);
    const vttFileName = path.basename(vttFilePath);
    
    // Generar contenido del playlist M3U8 para subtítulos
    const segmentDuration = duration || 10;
    const playlistContent = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-PLAYLIST-TYPE:VOD',
      `#EXT-X-TARGETDURATION:${segmentDuration}`,
      '#EXT-X-MEDIA-SEQUENCE:0',
      `#EXTINF:${segmentDuration}.000,`,
      vttFileName,
      '#EXT-X-ENDLIST'
    ].join('\n');
    
    await fs.writeFile(playlistPath, playlistContent);
    console.log(`[${this.videoId}] Playlist de subtítulos generado: ${path.basename(playlistPath)}`);
    
    return `subtitles/${language}.m3u8`;
  }

  /**
   * Generar playlist HLS con subtítulos
   */
  async generateHlsWithSubtitles(
    masterPlaylistPath: string,
    subtitles: SubtitleTrack[]
  ): Promise<void> {
    try {
      let content = await fs.readFile(masterPlaylistPath, 'utf-8');
      
      // Generar playlists M3U8 para cada subtítulo y obtener URIs
      const subtitleLines: string[] = [];
      
      for (const subtitle of subtitles) {
        // Generar playlist M3U8 para este subtítulo
        const playlistUri = await this.generateSubtitlePlaylist(
          subtitle.path,
          subtitle.language
        );
        
        subtitleLines.push(
          `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="${subtitle.label}",` +
          `LANGUAGE="${subtitle.language}",${subtitle.isDefault ? 'DEFAULT=YES,' : ''}` +
          `URI="${playlistUri}"`
        );
      }

      // Insertar líneas de subtítulos después de la versión
      const lines = content.split('\n');
      const versionIndex = lines.findIndex(line => line.startsWith('#EXT-X-VERSION'));
      
      if (versionIndex !== -1) {
        lines.splice(versionIndex + 1, 0, ...subtitleLines);
        
        // Actualizar las líneas de stream para incluir subtítulos
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
            if (!lines[i].includes('SUBTITLES')) {
              lines[i] += ',SUBTITLES="subs"';
            }
          }
        }
        
        content = lines.join('\n');
        await fs.writeFile(masterPlaylistPath, content);
        console.log(`[${this.videoId}] Playlist maestro actualizado con subtítulos M3U8`);
      }
    } catch (error: any) {
      console.error(`[${this.videoId}] Error actualizando playlist con subtítulos:`, error.message);
      throw error;
    }
  }

  /**
   * Listar subtítulos disponibles
   */
  async listSubtitles(inputPath: string): Promise<SubtitleTrack[]> {
    return this.extractSubtitles(inputPath);
  }
}

// Funciones de conveniencia
export async function addSubtitleToVideo(
  videoPath: string,
  subtitlePath: string,
  outputDir: string,
  videoId: string,
  subtitleInfo: Omit<SubtitleTrack, 'path'>
): Promise<string> {
  const manager = new SubtitleManager(outputDir, videoId);
  return manager.addSubtitle(videoPath, subtitlePath, subtitleInfo);
}

export async function removeSubtitlesFromVideo(
  videoPath: string,
  outputDir: string,
  videoId: string
): Promise<string> {
  const manager = new SubtitleManager(outputDir, videoId);
  return manager.removeSubtitles(videoPath);
}

export async function extractSubtitlesFromVideo(
  videoPath: string,
  outputDir: string,
  videoId: string
): Promise<SubtitleTrack[]> {
  const manager = new SubtitleManager(outputDir, videoId);
  return manager.extractSubtitles(videoPath);
}