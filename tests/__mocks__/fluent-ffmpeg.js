// Mock de fluent-ffmpeg para tests
const fs = require('fs');
const path = require('path');

class MockFfmpegCommand {
  constructor(input) {
    this.inputPath = input;
    this.inputs = input ? [input] : [];
    this.options = {};
    this.outputPath = null;
    this.callbacks = {};
  }

  videoCodec(codec) {
    this.options.videoCodec = codec;
    return this;
  }

  audioCodec(codec) {
    this.options.audioCodec = codec;
    return this;
  }

  size(size) {
    this.options.size = size;
    return this;
  }

  videoBitrate(bitrate) {
    this.options.videoBitrate = bitrate;
    return this;
  }

  audioBitrate(bitrate) {
    this.options.audioBitrate = bitrate;
    return this;
  }

  fps(fps) {
    this.options.fps = fps;
    return this;
  }

  format(format) {
    this.options.format = format;
    return this;
  }

  outputOptions(options) {
    this.options.outputOptions = options;
    return this;
  }

  input(inputPath) {
    this.inputs = this.inputs || [];
    this.inputs.push(inputPath);
    return this;
  }

  output(outputPath) {
    this.outputPath = outputPath;
    return this;
  }

  save(outputPath) {
    this.outputPath = outputPath;
    return this;
  }

  on(event, callback) {
    this.callbacks[event] = callback;
    return this;
  }

  run() {
    // Validar archivos de entrada para addAudioTrack y addSubtitle
    if (this.inputs && this.inputs.length > 1) {
      // Verificar si el archivo de audio/subtítulo existe (simulado)
      const secondPath = this.inputs[1];
      if (secondPath.includes('non-existent') || secondPath.includes('/path/to/')) {
        setTimeout(() => {
          if (this.callbacks.error) {
            this.callbacks.error(new Error(`No such file or directory: ${secondPath}`));
          }
        }, 50);
        return this;
      }
    }
    
    // Validar archivo de video principal para operaciones de subtítulos
    if (this.inputPath && (this.inputPath.includes('non-existent') || this.inputPath.includes('/path/to/'))) {
      setTimeout(() => {
        if (this.callbacks.error) {
          this.callbacks.error(new Error(`No such file or directory: ${this.inputPath}`));
        }
      }, 50);
      return this;
    }
    
    // Validar índices de pista para operaciones de audio
    if (this.outputPath && this.outputPath.includes('_audio_')) {
      // Extraer índice de pista del outputPath para extractAudioTrack
      const match = this.outputPath.match(/_audio_(\d+)\.(aac|mp3|wav)$/);
      if (match) {
        const trackIndex = parseInt(match[1]);
        // Simular que solo hay 1 pista de audio en videos normales
        if (!this.inputPath.includes('multi-audio') && trackIndex >= 1) {
          setTimeout(() => {
            if (this.callbacks.error) {
              this.callbacks.error(new Error(`Índice de pista de audio inválido: ${trackIndex}`));
            }
          }, 50);
          return this;
        }
        // Para videos multi-audio, simular 2 pistas (índices 0 y 1)
        if (this.inputPath.includes('multi-audio') && trackIndex >= 2) {
          setTimeout(() => {
            if (this.callbacks.error) {
              this.callbacks.error(new Error(`Índice de pista de audio inválido: ${trackIndex}`));
            }
          }, 50);
          return this;
        }
      }
    }
    
    // Simular procesamiento asíncrono
    setTimeout(() => {
      try {
        // Crear archivo de salida mock
        if (this.outputPath) {
          const dir = path.dirname(this.outputPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          // Crear archivo mock con contenido básico
          let mockContent;
          if (this.outputPath.endsWith('.m3u8')) {
            mockContent = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:10.0,\nsegment0.ts\n#EXT-X-ENDLIST\n';
          } else if (this.outputPath.endsWith('.mp4') || this.outputPath.endsWith('.avi') || this.outputPath.endsWith('.mkv')) {
            // Create a larger mock file for video operations (>1000 bytes)
            mockContent = 'mock video/audio content with additional padding to make file larger than 1000 bytes. '.repeat(50);
          } else {
            mockContent = 'mock video/audio content';
          }
          
          fs.writeFileSync(this.outputPath, mockContent);
        }
        
        // Simular progreso
        if (this.callbacks.progress) {
          this.callbacks.progress({ percent: 100 });
        }
        
        // Simular finalización exitosa
        if (this.callbacks.end) {
          this.callbacks.end();
        }
      } catch (error) {
        if (this.callbacks.error) {
          this.callbacks.error(error);
        }
      }
    }, 100); // Simular delay mínimo
    
    return this;
  }

  // Método estático para ffprobe
  static ffprobe(inputPath, callback) {
    setTimeout(() => {
      // Verificar si el archivo existe (simulado)
      if (inputPath.includes('non-existent') || inputPath.includes('/path/to/')) {
        callback(new Error('No such file or directory'), null);
        return;
      }
      
      // Mock de metadatos de video basado en el nombre del archivo
      let mockMetadata;
      
      if (inputPath.includes('multi-audio') || inputPath.includes('_with_audio') || inputPath.includes('_with_')) {
        // Video con múltiples pistas de audio o con audio añadido
        mockMetadata = {
          format: {
            duration: 5.0,
            size: '1024000',
            bit_rate: '2048000',
            format_name: 'mov,mp4,m4a,3gp,3g2,mj2'
          },
          streams: [
            {
              codec_type: 'video',
              codec_name: 'h264',
              width: 854,
              height: 480,
              r_frame_rate: '30/1',
              avg_frame_rate: '30/1',
              duration: 5.0,
              bit_rate: '5000000'
            },
            {
              codec_type: 'audio',
              codec_name: 'aac',
              sample_rate: '44100',
              channels: 2,
              duration: 5.0,
              bit_rate: '128000',
              tags: {
                language: 'en',
                title: 'English Audio'
              }
            },
            {
              codec_type: 'audio',
              codec_name: 'aac',
              sample_rate: '44100',
              channels: 2,
              duration: 5.0,
              bit_rate: '128000',
              tags: {
                language: 'es',
                title: 'Spanish Audio'
              }
            }
          ]
        };
      } else if (inputPath.includes('hd') || inputPath.includes('HD')) {
        // Video HD
        mockMetadata = {
          format: {
            duration: 5.0,
            size: '2048000',
            bit_rate: '4096000',
            format_name: 'mov,mp4,m4a,3gp,3g2,mj2'
          },
          streams: [
            {
              codec_type: 'video',
              codec_name: 'h264',
              width: 1280,
              height: 720,
              r_frame_rate: '30/1',
              avg_frame_rate: '30/1',
              duration: 5.0,
              bit_rate: '5000000'
            },
            {
              codec_type: 'audio',
              codec_name: 'aac',
              sample_rate: '44100',
              channels: 2,
              duration: 5.0,
              bit_rate: '128000',
              tags: {
                language: 'en',
                title: 'English Audio'
              }
            }
          ]
        };
      } else {
        // Video estándar
        mockMetadata = {
          format: {
            duration: 5.0,
            size: '1024000',
            bit_rate: '2048000',
            format_name: 'mov,mp4,m4a,3gp,3g2,mj2'
          },
          streams: [
            {
              codec_type: 'video',
              codec_name: 'h264',
              width: 854,
              height: 480,
              r_frame_rate: '30/1',
              avg_frame_rate: '30/1',
              duration: 5.0,
              bit_rate: '5000000'
            },
            {
              codec_type: 'audio',
              codec_name: 'aac',
              sample_rate: '44100',
              channels: 2,
              duration: 5.0,
              bit_rate: '128000',
              tags: {
                language: 'en',
                title: 'English Audio'
              }
            }
          ]
        };
      }
      
      callback(null, mockMetadata);
    }, 50);
  }
}

// Función principal que simula fluent-ffmpeg
function mockFfmpeg(input) {
  return new MockFfmpegCommand(input);
}

// Agregar ffprobe como método estático
mockFfmpeg.ffprobe = MockFfmpegCommand.ffprobe;
mockFfmpeg.setFfmpegPath = function(path) {
  // Mock implementation - do nothing
};
mockFfmpeg.setFfprobePath = function(path) {
  // Mock implementation - do nothing
};

// Exportar el mock
module.exports = mockFfmpeg;
module.exports.default = mockFfmpeg;