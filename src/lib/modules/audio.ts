import * as path from 'path';
import { promises as fs } from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { AudioTrack } from '../types';

// Configurar rutas de FFmpeg y FFprobe
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}
if (ffprobeStatic && typeof ffprobeStatic === 'string') {
  ffmpeg.setFfprobePath(ffprobeStatic);
}
import { audioConfigs } from '../config/defaults';

export class AudioManager {
  private outputDir: string;
  private videoId: string;

  constructor(outputDir: string, videoId: string) {
    this.outputDir = outputDir;
    this.videoId = videoId;
  }

  /**
   * Extraer información de pistas de audio existentes
   */
  async extractAudioTracks(inputPath: string): Promise<AudioTrack[]> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, data) => {
        if (err) {
          return reject(new Error(`Error extrayendo pistas de audio: ${err.message}`));
        }

        const audioStreams = data.streams?.filter(s => s.codec_type === 'audio') || [];
        const tracks: AudioTrack[] = [];

        audioStreams.forEach((stream, index) => {
          const language = stream.tags?.language || 'unknown';
          const title = stream.tags?.title || `Audio ${index + 1}`;
          const codec = stream.codec_name || 'unknown';
          const bitrate = stream.bit_rate ? `${Math.round(Number(stream.bit_rate) / 1000)}k` : '128k';
          const channels = stream.channels || 2;
          
          tracks.push({
            id: `audio_${index}`,
            language,
            label: title,
            codec,
            bitrate,
            channels,
            isDefault: index === 0
          });
        });

        resolve(tracks);
      });
    });
  }

  /**
   * Añadir pista de audio externa
   */
  async addAudioTrack(
    inputVideoPath: string,
    audioPath: string,
    audioInfo: Omit<AudioTrack, 'id'>
  ): Promise<string> {
    const outputPath = path.join(this.outputDir, `${this.videoId}_with_audio.mp4`);
    
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });
    
    console.log(`[${this.videoId}] Debug - Input video:`, inputVideoPath);
    console.log(`[${this.videoId}] Debug - Audio file:`, audioPath);
    console.log(`[${this.videoId}] Debug - Output path:`, outputPath);

    return new Promise((resolve, reject) => {
      const command = ffmpeg()
        .input(inputVideoPath)
        .input(audioPath)
        .output(outputPath);

      if (audioInfo.isDefault) {
        command.outputOptions([
          '-c:v', 'copy',
          '-c:a:0', 'copy',
          `-c:a:1`, audioInfo.codec || 'aac',
          '-disposition:a:1', 'default'
        ]);
      } else {
        command.outputOptions([
          '-c:v', 'copy',
          '-c:a:0', 'copy',
          `-c:a:1`, audioInfo.codec || 'aac'
        ]);
      }

      try {
        console.log(`[${this.videoId}] Debug - FFmpeg command:`, command._getArguments());
      } catch (e) {
        console.log(`[${this.videoId}] Debug - Could not get command arguments`);
      }

      command
        .on('start', (commandLine) => {
          console.log(`[${this.videoId}] FFmpeg command: ${commandLine}`);
        })
        .on('end', () => {
          console.log(`[${this.videoId}] Pista de audio añadida exitosamente`);
          resolve(outputPath);
        })
        .on('error', (err: any) => {
          console.error(`[${this.videoId}] Error añadiendo pista de audio:`, err.message);
          reject(new Error(`Error añadiendo pista de audio: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * Eliminar pistas de audio específicas
   */
  async removeAudioTrack(inputPath: string, trackIndex: number): Promise<string> {
    const outputPath = path.join(this.outputDir, `${this.videoId}_audio_removed.mp4`);

    return new Promise((resolve, reject) => {
      // Primero obtener información de las pistas
      this.extractAudioTracks(inputPath)
        .then(tracks => {
          if (trackIndex >= tracks.length) {
            throw new Error(`Índice de pista de audio inválido: ${trackIndex}`);
          }

          const command = ffmpeg(inputPath)
            .outputOptions(['-c:v copy']);

          // Mapear todas las pistas de audio excepto la que queremos eliminar
          tracks.forEach((track, index) => {
            if (index !== trackIndex) {
              command.outputOptions([`-map 0:a:${index}`, `-c:a:${index} copy`]);
            }
          });

          command
            .output(outputPath)
            .on('end', () => {
              console.log(`[${this.videoId}] Pista de audio eliminada exitosamente`);
              resolve(outputPath);
            })
            .on('error', (err: any) => {
              console.error(`[${this.videoId}] Error eliminando pista de audio:`, err.message);
              reject(new Error(`Error eliminando pista de audio: ${err.message}`));
            })
            .run();
        })
        .catch(reject);
    });
  }

  /**
   * Modificar pista de audio existente
   */
  async modifyAudioTrack(
    inputPath: string,
    trackIndex: number,
    newAudioInfo: Partial<AudioTrack>
  ): Promise<string> {
    const outputPath = path.join(this.outputDir, `${this.videoId}_audio_modified.mp4`);

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .outputOptions(['-c:v copy']);

      // Obtener información actual de las pistas
      this.extractAudioTracks(inputPath)
        .then(tracks => {
          if (trackIndex >= tracks.length) {
            throw new Error(`Índice de pista de audio inválido: ${trackIndex}`);
          }

          tracks.forEach((track, index) => {
            if (index === trackIndex) {
              // Modificar la pista específica
              const codec = newAudioInfo.codec || track.codec;
              const bitrate = newAudioInfo.bitrate || track.bitrate;
              const language = newAudioInfo.language || track.language;
              const label = newAudioInfo.label || track.label;

              command.outputOptions([
                `-map 0:a:${index}`,
                `-c:a:${index} ${codec}`,
                `-b:a:${index} ${bitrate}`,
                `-metadata:s:a:${index} language=${language}`,
                `-metadata:s:a:${index} title="${label}"`
              ]);

              if (newAudioInfo.isDefault !== undefined) {
                if (newAudioInfo.isDefault) {
                  command.outputOptions([`-disposition:a:${index} default`]);
                } else {
                  command.outputOptions([`-disposition:a:${index} 0`]);
                }
              }
            } else {
              // Copiar otras pistas sin modificar
              command.outputOptions([`-map 0:a:${index}`, `-c:a:${index} copy`]);
            }
          });

          command
            .output(outputPath)
            .on('end', () => {
              console.log(`[${this.videoId}] Pista de audio modificada exitosamente`);
              resolve(outputPath);
            })
            .on('error', (err: any) => {
              console.error(`[${this.videoId}] Error modificando pista de audio:`, err.message);
              reject(new Error(`Error modificando pista de audio: ${err.message}`));
            })
            .run();
        })
        .catch(reject);
    });
  }

  /**
   * Convertir audio a diferentes calidades
   */
  async convertAudioQuality(
    inputPath: string,
    quality: keyof typeof audioConfigs
  ): Promise<string> {
    const config = audioConfigs[quality];
    const outputPath = path.join(this.outputDir, `${this.videoId}_audio_${quality}.mp4`);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-c:v copy',
          `-c:a ${config.codec}`,
          `-b:a ${config.bitrate}`
        ])
        .output(outputPath)
        .on('end', () => {
          console.log(`[${this.videoId}] Audio convertido a calidad ${quality}`);
          resolve(outputPath);
        })
        .on('error', (err: any) => {
          console.error(`[${this.videoId}] Error convirtiendo calidad de audio:`, err.message);
          reject(new Error(`Error convirtiendo calidad de audio: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * Extraer pista de audio como archivo separado
   */
  async extractAudioTrack(inputPath: string, trackIndex: number): Promise<string> {
    const outputPath = path.join(this.outputDir, `${this.videoId}_audio_${trackIndex}.aac`);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          `-map 0:a:${trackIndex}`,
          '-c:a aac',
          '-vn' // Sin video
        ])
        .output(outputPath)
        .on('end', () => {
          console.log(`[${this.videoId}] Pista de audio extraída: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err: any) => {
          console.error(`[${this.videoId}] Error extrayendo pista de audio:`, err.message);
          reject(new Error(`Error extrayendo pista de audio: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * Generar playlist HLS con múltiples pistas de audio
   */
  async generateHlsWithAudio(
    masterPlaylistPath: string,
    audioTracks: AudioTrack[]
  ): Promise<void> {
    try {
      let content = await fs.readFile(masterPlaylistPath, 'utf-8');
      
      // Añadir información de audio al playlist maestro
      const audioLines: string[] = [];
      
      audioTracks.forEach(track => {
        audioLines.push(
          `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="${track.label}",` +
          `LANGUAGE="${track.language}",${track.isDefault ? 'DEFAULT=YES,' : ''}` +
          `URI="audio_${track.id}.m3u8"`
        );
      });

      // Insertar líneas de audio después de la versión
      const lines = content.split('\n');
      const versionIndex = lines.findIndex(line => line.startsWith('#EXT-X-VERSION'));
      
      if (versionIndex !== -1) {
        lines.splice(versionIndex + 1, 0, ...audioLines);
        
        // Actualizar las líneas de stream para incluir audio
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
            if (!lines[i].includes('AUDIO')) {
              lines[i] += ',AUDIO="audio"';
            }
          }
        }
        
        content = lines.join('\n');
        await fs.writeFile(masterPlaylistPath, content);
        console.log(`[${this.videoId}] Playlist maestro actualizado con pistas de audio`);
      }
    } catch (error: any) {
      console.error(`[${this.videoId}] Error actualizando playlist con audio:`, error.message);
      throw error;
    }
  }

  /**
   * Listar pistas de audio disponibles
   */
  async listAudioTracks(inputPath: string): Promise<AudioTrack[]> {
    return this.extractAudioTracks(inputPath);
  }
}

// Funciones de conveniencia
export async function addAudioTrackToVideo(
  videoPath: string,
  audioPath: string,
  outputDir: string,
  videoId: string,
  audioInfo: Omit<AudioTrack, 'id'>
): Promise<string> {
  const manager = new AudioManager(outputDir, videoId);
  return manager.addAudioTrack(videoPath, audioPath, audioInfo);
}

export async function removeAudioTrackFromVideo(
  videoPath: string,
  trackIndex: number,
  outputDir: string,
  videoId: string
): Promise<string> {
  const manager = new AudioManager(outputDir, videoId);
  return manager.removeAudioTrack(videoPath, trackIndex);
}

export async function extractAudioTracksFromVideo(
  videoPath: string,
  outputDir: string,
  videoId: string
): Promise<AudioTrack[]> {
  const manager = new AudioManager(outputDir, videoId);
  return manager.extractAudioTracks(videoPath);
}

export async function convertVideoAudioQuality(
  videoPath: string,
  quality: keyof typeof audioConfigs,
  outputDir: string,
  videoId: string
): Promise<string> {
  const manager = new AudioManager(outputDir, videoId);
  return manager.convertAudioQuality(videoPath, quality);
}