import { AudioManager, addAudioTrackToVideo, removeAudioTrackFromVideo, extractAudioTracksFromVideo, convertVideoAudioQuality } from '../src/lib/modules/audio';
import { AudioTrack } from '../src/lib/types';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const access = promisify(fs.access);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

describe('AudioManager', () => {
  const testMediaDir = path.join(__dirname, 'media');
  const testOutputDir = path.join(__dirname, '../test-output');
  const testVideoPath = path.join(testMediaDir, 'test-video.mp4');
  const testVideoMultiAudioPath = path.join(testMediaDir, 'test-video-multi-audio.mp4');
  const testAudioPath = path.join(testMediaDir, 'test-audio.mp3');
  const testVideoId = 'test-audio-001';

  beforeAll(async () => {
    // Verificar que los archivos de prueba existen
    try {
      await access(testVideoPath);
      await access(testVideoMultiAudioPath);
      await access(testAudioPath);
    } catch (error) {
      throw new Error('Los archivos de prueba no existen. Ejecuta: node tests/generate-test-media.js');
    }

    // Crear directorio de salida
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterEach(async () => {
    // Limpiar archivos de salida después de cada test
    // Temporarily disabled for debugging
    /*
    try {
      const files = fs.readdirSync(testOutputDir);
      for (const file of files) {
        if (file.includes(testVideoId)) {
          fs.unlinkSync(path.join(testOutputDir, file));
        }
      }
    } catch (error) {
      // Ignorar errores de limpieza
    }
    */
  });

  describe('Constructor', () => {
    it('debería crear una instancia con outputDir y videoId', () => {
      const manager = new AudioManager(testOutputDir, testVideoId);
      expect(manager).toBeInstanceOf(AudioManager);
    });
  });

  describe('extractAudioTracks', () => {
    it('debería extraer información de pistas de audio del video básico', async () => {
      const manager = new AudioManager(testOutputDir, testVideoId);
      const audioTracks = await manager.extractAudioTracks(testVideoPath);
      
      expect(Array.isArray(audioTracks)).toBe(true);
      expect(audioTracks.length).toBeGreaterThan(0);
      
      // Verificar estructura de la primera pista
      const firstTrack = audioTracks[0];
      expect(firstTrack).toHaveProperty('id');
      expect(firstTrack).toHaveProperty('language');
      expect(firstTrack).toHaveProperty('label');
      expect(firstTrack).toHaveProperty('codec');
      expect(firstTrack).toHaveProperty('bitrate');
      expect(firstTrack).toHaveProperty('channels');
      expect(firstTrack).toHaveProperty('isDefault');
      expect(firstTrack.isDefault).toBe(true);
    });

    it('debería extraer múltiples pistas de audio del video multi-audio', async () => {
      const manager = new AudioManager(testOutputDir, testVideoId);
      const audioTracks = await manager.extractAudioTracks(testVideoMultiAudioPath);
      
      expect(Array.isArray(audioTracks)).toBe(true);
      expect(audioTracks.length).toBeGreaterThanOrEqual(2);
      
      // Verificar que solo la primera pista es default
      const defaultTracks = audioTracks.filter(track => track.isDefault);
      expect(defaultTracks.length).toBe(1);
      expect(defaultTracks[0]).toBe(audioTracks[0]);
    });

    it('debería fallar con archivo inexistente', async () => {
      const manager = new AudioManager(testOutputDir, testVideoId);
      
      await expect(
        manager.extractAudioTracks('/path/to/non-existent-video.mp4')
      ).rejects.toThrow();
    });
  });

  describe('addAudioTrack', () => {
    it('debería añadir una pista de audio externa al video', async () => {
      const manager = new AudioManager(testOutputDir, testVideoId);
      
      const audioInfo: Omit<AudioTrack, 'id'> = {
        language: 'es',
        label: 'Audio en Español',
        codec: 'aac',
        bitrate: '128k',
        channels: 2,
        isDefault: false
      };

      const outputPath = await manager.addAudioTrack(
        testVideoPath,
        testAudioPath,
        audioInfo
      );

      expect(typeof outputPath).toBe('string');
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(outputPath).toMatch(/_with_\w+_\d+\.mp4$/); // Matches pattern like '_with_es_1234567890.mp4'
      
      // Verificar que el video resultante tiene más pistas de audio
      const newAudioTracks = await manager.extractAudioTracks(outputPath);
      const originalAudioTracks = await manager.extractAudioTracks(testVideoPath);
      
      console.log('Original audio tracks:', originalAudioTracks.length);
      console.log('New audio tracks:', newAudioTracks.length);
      console.log('Output file:', outputPath);
      
      expect(newAudioTracks.length).toBeGreaterThan(originalAudioTracks.length);
    }, 30000);

    it('debería fallar con archivo de audio inexistente', async () => {
      const manager = new AudioManager(testOutputDir, testVideoId);
      
      const audioInfo: Omit<AudioTrack, 'id'> = {
        language: 'en',
        label: 'Fake Audio',
        codec: 'aac',
        bitrate: '128k',
        channels: 2,
        isDefault: false
      };

      await expect(
        manager.addAudioTrack(
          testVideoPath,
          '/path/to/non-existent-audio.mp3',
          audioInfo
        )
      ).rejects.toThrow();
    });
  });

  describe('removeAudioTrack', () => {
    it('debería eliminar una pista de audio específica', async () => {
      const manager = new AudioManager(testOutputDir, testVideoId);
      
      // Usar el video con múltiples pistas de audio
      const originalTracks = await manager.extractAudioTracks(testVideoMultiAudioPath);
      expect(originalTracks.length).toBeGreaterThan(1);
      
      // Eliminar la segunda pista (índice 1)
      const outputPath = await manager.removeAudioTrack(testVideoMultiAudioPath, 1);
      
      expect(typeof outputPath).toBe('string');
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(outputPath).toContain('_audio_removed.mp4');
      
      // Verificar que el video resultante tiene menos pistas
      const newTracks = await manager.extractAudioTracks(outputPath);
      expect(newTracks.length).toBe(originalTracks.length - 1);
    }, 30000);

    it('debería fallar con índice de pista inválido', async () => {
      const manager = new AudioManager(testOutputDir, testVideoId);
      
      await expect(
        manager.removeAudioTrack(testVideoPath, 999)
      ).rejects.toThrow();
    });
  });

  describe('extractAudioTrack', () => {
    it('debería extraer una pista de audio como archivo separado', async () => {
      const manager = new AudioManager(testOutputDir, testVideoId);
      
      const outputPath = await manager.extractAudioTrack(testVideoPath, 0);
      
      expect(typeof outputPath).toBe('string');
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(outputPath).toMatch(/\.(mp3|aac|wav)$/);
    }, 20000);

    it('debería fallar con índice de pista inválido', async () => {
      const manager = new AudioManager(testOutputDir, testVideoId);
      
      await expect(
        manager.extractAudioTrack(testVideoPath, 999)
      ).rejects.toThrow();
    });
  });

  describe('convertAudioQuality', () => {
    it('debería convertir audio a alta calidad', async () => {
      const manager = new AudioManager(testOutputDir, testVideoId);
      
      const outputPath = await manager.convertAudioQuality(testVideoPath, 'high');
      
      expect(typeof outputPath).toBe('string');
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(outputPath).toContain('_audio_high.mp4');
      
      // Verificar que el audio tiene mejor calidad
      const originalTracks = await manager.extractAudioTracks(testVideoPath);
      const newTracks = await manager.extractAudioTracks(outputPath);
      
      expect(newTracks.length).toBe(originalTracks.length);
      // El bitrate debería ser mayor o igual
      const originalBitrate = parseInt(originalTracks[0].bitrate.replace('k', ''));
      const newBitrate = parseInt(newTracks[0].bitrate.replace('k', ''));
      expect(newBitrate).toBeGreaterThanOrEqual(originalBitrate);
    }, 30000);

    it('debería convertir audio a baja calidad', async () => {
      const manager = new AudioManager(testOutputDir, testVideoId);
      
      const outputPath = await manager.convertAudioQuality(testVideoPath, 'low');
      
      expect(typeof outputPath).toBe('string');
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(outputPath).toContain('_audio_low.mp4');
    }, 30000);

    it('debería fallar con calidad inválida', async () => {
      const manager = new AudioManager(testOutputDir, testVideoId);
      
      await expect(
        manager.convertAudioQuality(testVideoPath, 'invalid' as any)
      ).rejects.toThrow();
    });
  });

  describe('listAudioTracks', () => {
    it('debería listar pistas de audio disponibles', async () => {
      const manager = new AudioManager(testOutputDir, testVideoId);
      const audioTracks = await manager.listAudioTracks(testVideoPath);
      
      expect(Array.isArray(audioTracks)).toBe(true);
      // Debería ser igual a extractAudioTracks
      const extracted = await manager.extractAudioTracks(testVideoPath);
      expect(audioTracks).toEqual(extracted);
    });
  });

  describe('generateHlsWithAudio', () => {
    it('debería actualizar playlist maestro con información de audio', async () => {
      const manager = new AudioManager(testOutputDir, testVideoId);
      
      // Crear un playlist maestro de prueba
      const masterPlaylistPath = path.join(testOutputDir, 'master.m3u8');
      const initialContent = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=500000,RESOLUTION=640x360\n360p.m3u8\n';
      await writeFile(masterPlaylistPath, initialContent);

      const audioTracks: AudioTrack[] = [
        {
          id: 'audio_0',
          language: 'en',
          label: 'English',
          codec: 'aac',
          bitrate: '128k',
          channels: 2,
          isDefault: true
        },
        {
          id: 'audio_1',
          language: 'es',
          label: 'Español',
          codec: 'aac',
          bitrate: '128k',
          channels: 2,
          isDefault: false
        }
      ];

      await manager.generateHlsWithAudio(masterPlaylistPath, audioTracks);
      
      const updatedContent = await readFile(masterPlaylistPath, 'utf-8');
      expect(updatedContent).toContain('#EXT-X-MEDIA:TYPE=AUDIO');
      expect(updatedContent).toContain('LANGUAGE="en"');
      expect(updatedContent).toContain('LANGUAGE="es"');
      expect(updatedContent).toContain('AUDIO="audio"');
    });
  });

  describe('Funciones de conveniencia', () => {
    it('addAudioTrackToVideo debería funcionar igual que el método de clase', async () => {
      const audioInfo: Omit<AudioTrack, 'id'> = {
        language: 'es',
        label: 'Convenience Test',
        codec: 'aac',
        bitrate: '128k',
        channels: 2,
        isDefault: false
      };

      const outputPath = await addAudioTrackToVideo(
        testVideoPath,
        testAudioPath,
        testOutputDir,
        testVideoId,
        audioInfo
      );

      expect(typeof outputPath).toBe('string');
      expect(fs.existsSync(outputPath)).toBe(true);
    }, 30000);

    it('extractAudioTracksFromVideo debería funcionar igual que el método de clase', async () => {
      const audioTracks = await extractAudioTracksFromVideo(
        testVideoPath,
        testOutputDir,
        testVideoId
      );

      expect(Array.isArray(audioTracks)).toBe(true);
      expect(audioTracks.length).toBeGreaterThan(0);
    });

    it('removeAudioTrackFromVideo debería funcionar igual que el método de clase', async () => {
      const outputPath = await removeAudioTrackFromVideo(
        testVideoMultiAudioPath,
        1,
        testOutputDir,
        testVideoId
      );

      expect(typeof outputPath).toBe('string');
      expect(fs.existsSync(outputPath)).toBe(true);
    }, 30000);

    it('convertVideoAudioQuality debería funcionar igual que el método de clase', async () => {
      const outputPath = await convertVideoAudioQuality(
        testVideoPath,
        'medium',
        testOutputDir,
        testVideoId
      );

      expect(typeof outputPath).toBe('string');
      expect(fs.existsSync(outputPath)).toBe(true);
    }, 30000);
  });
});