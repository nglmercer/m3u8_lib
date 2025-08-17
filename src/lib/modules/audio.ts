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
if (ffprobeStatic) {
  const ffprobePath = typeof ffprobeStatic === 'string' ? ffprobeStatic : ffprobeStatic.path;
  ffmpeg.setFfprobePath(ffprobePath);
}
import { audioConfigs } from '../config/defaults';

/**
 * Utilidad para normalizar y validar URIs de audio
 */
export class AudioUriUtils {
  /**
   * Normaliza una URI de audio eliminando duplicaciones y asegurando formato correcto
   */
  static normalizeAudioUri(uri: string): string {
    if (!uri) return '';
    
    // Eliminar todas las duplicaciones de 'audio/' de forma recursiva
    let normalized = uri;
    while (normalized.includes('audio/audio/')) {
      normalized = normalized.replace(/audio\/audio\//g, 'audio/');
    }
    
    // Asegurar que comience con 'audio/' si no está presente
    if (!normalized.startsWith('audio/')) {
      normalized = `audio/${normalized}`;
    }
    
    // Eliminar barras dobles
    normalized = normalized.replace(/\/+/g, '/');
    
    return normalized;
  }
  
  /**
   * Valida que una URI de audio tenga el formato correcto
   */
  static validateAudioUri(uri: string): boolean {
    if (!uri) return false;
    
    // Debe comenzar con 'audio/' y terminar con '.m3u8'
    return uri.startsWith('audio/') && uri.endsWith('.m3u8');
  }
  
  /**
   * Genera una URI de audio consistente basada en el ID del track
   */
  static generateAudioUri(trackId: string): string {
    if (!trackId) return '';
    
    // Limpiar el trackId de prefijos 'audio/' si los tiene
    const cleanId = trackId.replace(/^audio\//g, '');
    
    return `audio/${cleanId}.m3u8`;
  }
  
  /**
   * Corrige un array de AudioTracks normalizando sus URIs
   */
  static fixAudioTracksUris(tracks: AudioTrack[]): AudioTrack[] {
    return tracks.map(track => ({
      ...track,
      uri: track.uri ? this.normalizeAudioUri(track.uri) : this.generateAudioUri(track.id)
    }));
  }
}

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
    const timestamp = Date.now();
    const outputPath = path.join(this.outputDir, `${this.videoId}_with_${audioInfo.language}_${timestamp}.mp4`);
    
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });

    // Verify input files exist
    try {
      await fs.access(inputVideoPath);
      await fs.access(audioPath);
    } catch (error) {
      throw new Error(`Input file not found: ${error}`);
    }

    return new Promise((resolve, reject) => {
      try {
        const command = ffmpeg()
          .input(inputVideoPath)
          .input(audioPath)
          .output(outputPath)
          .outputOptions([
            '-map', '0:v',     // Map video from first input
            '-map', '0:a',     // Map audio from first input (original video)
            '-map', '1:a',     // Map audio from second input (new audio file)
            '-c:v', 'copy',    // Copy video codec
            '-c:a:0', 'copy',  // Copy first audio track
            '-c:a:1', audioInfo.codec || 'aac',  // Encode second audio track
            '-shortest'        // Stop when shortest input ends
          ]);
        
        if (audioInfo.isDefault) {
          command.outputOptions(['-disposition:a:1', 'default']);
        }

        command
          .on('start', (commandLine) => {
            console.log(`[${this.videoId}] FFmpeg started with command: ${commandLine}`);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log(`[${this.videoId}] Processing: ${Math.round(progress.percent)}% done`);
            }
          })
          .on('stderr', (stderrLine) => {
            console.log(`[${this.videoId}] FFmpeg stderr: ${stderrLine}`);
          })
          .on('end', async () => {
            try {
              // Verify output file was created and has content
              const stats = await fs.stat(outputPath);
              if (stats.size < 1000) {
                reject(new Error(`Output file is too small (${stats.size} bytes), likely corrupted`));
                return;
              }
              console.log(`[${this.videoId}] Pista de audio añadida exitosamente (${stats.size} bytes)`);
              resolve(outputPath);
            } catch (error) {
              console.error(`[${this.videoId}] Error checking output file:`, error);
              reject(new Error(`Failed to verify output file: ${error}`));
            }
          })
          .on('error', (err: any) => {
            console.error(`[${this.videoId}] FFmpeg error:`, err);
            console.error(`[${this.videoId}] Full error:`, err);
            reject(new Error(`Error añadiendo pista de audio: ${err.message}`));
          });

        command.run();
      } catch (error) {
        console.error(`[${this.videoId}] Error setting up FFmpeg command:`, error);
        reject(new Error(`Failed to start FFmpeg: ${error}`));
      }
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
   * Extraer y convertir pistas de audio a formato HLS
   */
  /**
   * Generar audio HLS separado una sola vez (optimizado)
   * Extrae todas las pistas de audio del video original y las convierte a HLS
   * sin re-codificar por cada calidad de video
   */
  async generateSeparateAudioHls(
    inputPath: string
  ): Promise<{ audioPlaylistPaths: string[]; audioTracks: AudioTrack[] }> {
    const audioPlaylistPaths: string[] = [];
    const validAudioTracks: AudioTrack[] = [];
    
    // Asegurar que el directorio de audio existe
    const audioDir = path.join(this.outputDir, 'audio');
    await fs.mkdir(audioDir, { recursive: true });
    
    // Extraer información de pistas de audio del video original
    const realAudioTracks = await this.extractAudioTracks(inputPath);
    console.log(`[${this.videoId}] Pistas de audio encontradas: ${realAudioTracks.length}`);
    
    // Generar HLS para cada pista de audio una sola vez
    for (let i = 0; i < realAudioTracks.length; i++) {
      const track = realAudioTracks[i];
      const audioPlaylistPath = path.join(audioDir, `${track.language || 'unknown'}.m3u8`);
      const audioSegmentPattern = path.join(audioDir, `${track.language || 'unknown'}_segment%03d.ts`);
      
      console.log(`[${this.videoId}] Generando HLS para audio: ${track.label} (${track.language})`);
      
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions([
            `-map 0:a:${i}`,
            '-c:a aac',
            '-b:a 128k',
            '-ar 48000',
            '-ac 2',
            '-vn', // Sin video
            '-hls_time 10',
            '-hls_playlist_type vod',
            `-hls_segment_filename ${audioSegmentPattern}`
          ])
          .output(audioPlaylistPath)
          .on('start', (commandLine) => {
            console.log(`[${this.videoId}] FFmpeg audio HLS: ${commandLine.substring(0, 200)}...`);
          })
          .on('end', () => {
            console.log(`[${this.videoId}] Audio HLS generado: ${path.basename(audioPlaylistPath)}`);
            resolve();
          })
          .on('error', (err: any) => {
            console.error(`[${this.videoId}] Error generando audio HLS:`, err.message);
            reject(new Error(`Error generando audio HLS: ${err.message}`));
          })
          .run();
      });
      
      // Usar ruta relativa para el playlist
      const relativeUri = `audio/${track.language || 'unknown'}.m3u8`;
      const normalizedUri = AudioUriUtils.normalizeAudioUri(relativeUri);
      
      audioPlaylistPaths.push(normalizedUri);
      validAudioTracks.push({
        ...track,
        uri: normalizedUri
      });
    }
    
    // Aplicar corrección final a todas las URIs
    const correctedTracks = AudioUriUtils.fixAudioTracksUris(validAudioTracks);
    
    return { audioPlaylistPaths, audioTracks: correctedTracks };
  }

  async generateAudioHls(
    inputPath: string,
    audioTracks: AudioTrack[]
  ): Promise<{ audioPlaylistPaths: string[]; audioTracks: AudioTrack[] }> {
    const audioPlaylistPaths: string[] = [];
    const validAudioTracks: AudioTrack[] = [];
    
    // Asegurar que el directorio de salida existe
    await fs.mkdir(this.outputDir, { recursive: true });
    
    // Verificar si es un archivo de video o audio
    const isVideoFile = inputPath.includes('.mp4') || inputPath.includes('.avi') || inputPath.includes('.mov');
    
    if (isVideoFile) {
      // Procesar video: extraer pistas de audio reales
      const realAudioTracks = await this.extractAudioTracks(inputPath);
      console.log(`[${this.videoId}] Pistas de audio reales encontradas: ${realAudioTracks.length}`);
      
      for (let i = 0; i < realAudioTracks.length; i++) {
        const track = realAudioTracks[i];
        const audioPlaylistPath = path.join(this.outputDir, `audio/${track.id}.m3u8`);
        const audioSegmentPattern = path.join(this.outputDir, `audio/${track.id}_segment%03d.ts`);
        
        console.log(`[${this.videoId}] Generando HLS para pista de audio: ${track.label}`);
        
        await new Promise<void>((resolve, reject) => {
          ffmpeg(inputPath)
            .outputOptions([
              `-map 0:a:${i}`,
              '-c:a aac',
              '-b:a 128k',
              '-ar 48000',
              '-ac 2',
              '-vn',
              '-hls_time 10',
              '-hls_playlist_type vod',
              `-hls_segment_filename ${audioSegmentPattern}`
            ])
            .output(audioPlaylistPath)
            .on('start', (commandLine) => {
              console.log(`[${this.videoId}] FFmpeg audio HLS: ${commandLine.substring(0, 200)}...`);
            })
            .on('end', () => {
              console.log(`[${this.videoId}] Audio HLS generado: ${path.basename(audioPlaylistPath)}`);
              resolve();
            })
            .on('error', (err: any) => {
              console.error(`[${this.videoId}] Error generando audio HLS:`, err.message);
              reject(new Error(`Error generando audio HLS: ${err.message}`));
            })
            .run();
        });
        
        // Normalizar la URI antes de añadirla
        const relativeUri = `audio/${track.id}.m3u8`;
        const normalizedUri = AudioUriUtils.normalizeAudioUri(relativeUri);
        
        audioPlaylistPaths.push(audioPlaylistPath);
        validAudioTracks.push({
          ...track,
          uri: normalizedUri
        });
      }
    } else {
      // Procesar archivo de audio individual
      for (const track of audioTracks) {
        const audioPlaylistPath = path.join(this.outputDir, `audio/${track.id}.m3u8`);
        const audioSegmentPattern = path.join(this.outputDir, `audio/${track.id}_segment%03d.ts`);
        
        console.log(`[${this.videoId}] Generando HLS para archivo de audio: ${track.label}`);
        
        await new Promise<void>((resolve, reject) => {
          ffmpeg(inputPath)
            .outputOptions([
              '-c:a aac',
              '-b:a 128k',
              '-ar 48000',
              '-ac 2',
              '-hls_time 10',
              '-hls_playlist_type vod',
              `-hls_segment_filename ${audioSegmentPattern}`
            ])
            .output(audioPlaylistPath)
            .on('start', (commandLine) => {
              console.log(`[${this.videoId}] FFmpeg audio HLS: ${commandLine.substring(0, 200)}...`);
            })
            .on('end', () => {
              console.log(`[${this.videoId}] Audio HLS generado: ${path.basename(audioPlaylistPath)}`);
              resolve();
            })
            .on('error', (err: any) => {
              console.error(`[${this.videoId}] Error generando audio HLS:`, err.message);
              reject(new Error(`Error generando audio HLS: ${err.message}`));
            })
            .run();
        });
        
        // Normalizar la URI antes de añadirla
        const relativeUri = `audio/${track.id}.m3u8`;
        const normalizedUri = AudioUriUtils.normalizeAudioUri(relativeUri);
        
        audioPlaylistPaths.push(audioPlaylistPath);
        validAudioTracks.push({
          ...track,
          uri: normalizedUri
        });
      }
    }
    
    return { audioPlaylistPaths, audioTracks: validAudioTracks };
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
        // Normalizar la URI para evitar duplicaciones
        const normalizedUri = track.uri || AudioUriUtils.generateAudioUri(track.id);
        const validatedUri = AudioUriUtils.normalizeAudioUri(normalizedUri);
        
        audioLines.push(
          `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="${track.label}",` +
          `LANGUAGE="${track.language}",${track.isDefault ? 'DEFAULT=YES,' : ''}` +
          `URI="${validatedUri}"`
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
   * Generar múltiples pistas de audio artificiales para demo
   * Usa el mismo archivo de audio pero simula diferentes idiomas
   */
  async generateDemoAudioTracks(
    inputPath: string
  ): Promise<{ audioPlaylistPaths: string[]; audioTracks: AudioTrack[] }> {
    const audioPlaylistPaths: string[] = [];
    const validAudioTracks: AudioTrack[] = [];
    
    // Asegurar que el directorio de audio existe
    const audioDir = path.join(this.outputDir, 'audio');
    await fs.mkdir(audioDir, { recursive: true });
    
    // Definir múltiples idiomas para el demo
    const demoLanguages = [
      { code: 'es', name: 'Español', isDefault: true },
      { code: 'en', name: 'English', isDefault: false },
      { code: 'fr', name: 'Français', isDefault: false },
      { code: 'de', name: 'Deutsch', isDefault: false }
    ];
    
    console.log(`[${this.videoId}] Generando ${demoLanguages.length} pistas de audio para demo`);
    
    // Generar HLS para cada idioma simulado
    for (let i = 0; i < demoLanguages.length; i++) {
      const lang = demoLanguages[i];
      const audioPlaylistPath = path.join(audioDir, `${lang.code}.m3u8`);
      const audioSegmentPattern = path.join(audioDir, `${lang.code}_segment%03d.ts`);
      
      console.log(`[${this.videoId}] Generando HLS para audio: ${lang.name} (${lang.code})`);
      
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions([
            '-map 0:a:0', // Usar la primera pista de audio
            '-c:a aac',
            '-b:a 128k',
            '-ar 48000',
            '-ac 2',
            '-vn', // Sin video
            '-hls_time 10',
            '-hls_playlist_type vod',
            `-hls_segment_filename ${audioSegmentPattern}`
          ])
          .output(audioPlaylistPath)
          .on('start', (commandLine) => {
            console.log(`[${this.videoId}] FFmpeg demo audio HLS: ${commandLine.substring(0, 200)}...`);
          })
          .on('end', () => {
            console.log(`[${this.videoId}] Demo audio HLS generado: ${path.basename(audioPlaylistPath)}`);
            resolve();
          })
          .on('error', (err: any) => {
            console.error(`[${this.videoId}] Error generando demo audio HLS:`, err.message);
            reject(new Error(`Error generando demo audio HLS: ${err.message}`));
          })
          .run();
      });
      
      // Usar ruta relativa para el playlist y normalizar URI
      const relativeUri = `audio/${lang.code}.m3u8`;
      const normalizedUri = AudioUriUtils.normalizeAudioUri(relativeUri);
      
      audioPlaylistPaths.push(normalizedUri);
      validAudioTracks.push({
        id: lang.code, // Usar solo el código sin prefijo 'audio/'
        language: lang.code,
        label: lang.name,
        codec: 'aac',
        bitrate: '128k',
        channels: 2,
        isDefault: lang.isDefault,
        uri: normalizedUri
      });
    }
    
    return { audioPlaylistPaths, audioTracks: validAudioTracks };
  }

  /**
   * Listar pistas de audio disponibles
   */
  async listAudioTracks(inputPath: string): Promise<AudioTrack[]> {
    return this.extractAudioTracks(inputPath);
  }

  /**
   * Validar y corregir URIs de audio en un array de tracks
   */
  validateAndFixAudioUris(tracks: AudioTrack[]): AudioTrack[] {
    console.log(`[${this.videoId}] Validando y corrigiendo URIs de audio...`);
    
    const correctedTracks = AudioUriUtils.fixAudioTracksUris(tracks);
    
    // Reportar correcciones realizadas
    tracks.forEach((original, index) => {
      const corrected = correctedTracks[index];
      if (original.uri !== corrected.uri) {
        console.log(`[${this.videoId}] URI corregida: "${original.uri}" -> "${corrected.uri}"`);
      }
    });
    
    return correctedTracks;
  }

  /**
   * Validar una URI de audio individual
   */
  static validateAudioUri(uri: string): boolean {
    return AudioUriUtils.validateAudioUri(uri);
  }

  /**
   * Normalizar una URI de audio individual
   */
  static normalizeAudioUri(uri: string): string {
    return AudioUriUtils.normalizeAudioUri(uri);
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