import { SubtitleManager, addSubtitleToVideo, removeSubtitlesFromVideo, extractSubtitlesFromVideo } from '../src/lib/modules/subtitles';
import { SubtitleTrack } from '../src/lib/types';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const access = promisify(fs.access);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

describe('SubtitleManager', () => {
  const testMediaDir = path.join(__dirname, 'media');
  const testOutputDir = path.join(__dirname, '../test-output');
  const testVideoPath = path.join(testMediaDir, 'test-video.mp4');
  const testSubtitleEsPath = path.join(testMediaDir, 'test-subtitles-es.srt');
  const testSubtitleEnPath = path.join(testMediaDir, 'test-subtitles-en.srt');
  const testVideoId = 'test-subtitles-001';

  beforeAll(async () => {
    // Verificar que los archivos de prueba existen
    try {
      await access(testVideoPath);
      await access(testSubtitleEsPath);
      await access(testSubtitleEnPath);
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
  });

  describe('Constructor', () => {
    it('debería crear una instancia con outputDir y videoId', () => {
      const manager = new SubtitleManager(testOutputDir, testVideoId);
      expect(manager).toBeInstanceOf(SubtitleManager);
    });
  });

  describe('extractSubtitles', () => {
    it('debería extraer información de subtítulos del video', async () => {
      const manager = new SubtitleManager(testOutputDir, testVideoId);
      const subtitles = await manager.extractSubtitles(testVideoPath);
      
      expect(Array.isArray(subtitles)).toBe(true);
      // El video de prueba básico no tiene subtítulos embebidos
      expect(subtitles.length).toBe(0);
    });

    it('debería manejar videos sin subtítulos', async () => {
      const manager = new SubtitleManager(testOutputDir, testVideoId);
      const subtitles = await manager.extractSubtitles(testVideoPath);
      
      expect(subtitles).toEqual([]);
    });

    it('debería fallar con archivo inexistente', async () => {
      const manager = new SubtitleManager(testOutputDir, testVideoId);
      
      await expect(
        manager.extractSubtitles('/path/to/non-existent-video.mp4')
      ).rejects.toThrow();
    });
  });

  describe('addSubtitle', () => {
    it('debería añadir subtítulos externos al video', async () => {
      const manager = new SubtitleManager(testOutputDir, testVideoId);
      
      const subtitleInfo: Omit<SubtitleTrack, 'path'> = {
        id: 'sub_es',
        language: 'es',
        label: 'Español',
        format: 'srt',
        isDefault: true
      };

      const outputPath = await manager.addSubtitle(
        testVideoPath,
        testSubtitleEsPath,
        subtitleInfo
      );

      expect(typeof outputPath).toBe('string');
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(outputPath).toContain('_with_');
    }, 30000);

    it('debería convertir subtítulos SRT a VTT automáticamente', async () => {
      const manager = new SubtitleManager(testOutputDir, testVideoId);
      
      const subtitleInfo: Omit<SubtitleTrack, 'path'> = {
        id: 'sub_en',
        language: 'en',
        label: 'English',
        format: 'srt',
        isDefault: false
      };

      const outputPath = await manager.addSubtitle(
        testVideoPath,
        testSubtitleEnPath,
        subtitleInfo
      );

      expect(fs.existsSync(outputPath)).toBe(true);
      
      // Verificar que se creó el archivo VTT
      const vttPath = path.join(testOutputDir, 'sub_en.vtt');
      expect(fs.existsSync(vttPath)).toBe(true);
    }, 30000);

    it('debería fallar con archivo de subtítulo inexistente', async () => {
      const manager = new SubtitleManager(testOutputDir, testVideoId);
      
      const subtitleInfo: Omit<SubtitleTrack, 'path'> = {
        id: 'sub_fake',
        language: 'es',
        label: 'Fake',
        format: 'srt',
        isDefault: false
      };

      await expect(
        manager.addSubtitle(
          testVideoPath,
          '/path/to/non-existent-subtitle.srt',
          subtitleInfo
        )
      ).rejects.toThrow();
    });
  });

  describe('removeSubtitles', () => {
    it('debería eliminar subtítulos del video', async () => {
      const manager = new SubtitleManager(testOutputDir, testVideoId);
      
      // Primero añadir subtítulos
      const subtitleInfo: Omit<SubtitleTrack, 'path'> = {
        id: 'sub_temp',
        language: 'es',
        label: 'Temporal',
        format: 'srt',
        isDefault: true
      };

      const videoWithSubs = await manager.addSubtitle(
        testVideoPath,
        testSubtitleEsPath,
        subtitleInfo
      );

      // Luego eliminar subtítulos
      const videoWithoutSubs = await manager.removeSubtitles(videoWithSubs);
      
      expect(typeof videoWithoutSubs).toBe('string');
      expect(fs.existsSync(videoWithoutSubs)).toBe(true);
      expect(videoWithoutSubs).toContain('_no_subs.mp4');
    }, 45000);

    it('debería fallar con archivo inexistente', async () => {
      const manager = new SubtitleManager(testOutputDir, testVideoId);
      
      await expect(
        manager.removeSubtitles('/path/to/non-existent-video.mp4')
      ).rejects.toThrow();
    });
  });

  describe('listSubtitles', () => {
    it('debería listar subtítulos disponibles', async () => {
      const manager = new SubtitleManager(testOutputDir, testVideoId);
      const subtitles = await manager.listSubtitles(testVideoPath);
      
      expect(Array.isArray(subtitles)).toBe(true);
      // Debería ser igual a extractSubtitles
      const extracted = await manager.extractSubtitles(testVideoPath);
      expect(subtitles).toEqual(extracted);
    });
  });

  describe('generateHlsWithSubtitles', () => {
    it('debería actualizar playlist maestro con información de subtítulos', async () => {
      const manager = new SubtitleManager(testOutputDir, testVideoId);
      
      // Crear un playlist maestro de prueba
      const masterPlaylistPath = path.join(testOutputDir, 'master.m3u8');
      const initialContent = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=500000,RESOLUTION=640x360\n360p.m3u8\n';
      await writeFile(masterPlaylistPath, initialContent);

      const subtitles: SubtitleTrack[] = [
        {
          id: 'sub_es',
          language: 'es',
          label: 'Español',
          path: '',
          format: 'vtt',
          isDefault: true
        },
        {
          id: 'sub_en',
          language: 'en',
          label: 'English',
          path: '',
          format: 'vtt',
          isDefault: false
        }
      ];

      await manager.generateHlsWithSubtitles(masterPlaylistPath, subtitles);
      
      const updatedContent = await readFile(masterPlaylistPath, 'utf-8');
      expect(updatedContent).toContain('#EXT-X-MEDIA:TYPE=SUBTITLES');
      expect(updatedContent).toContain('LANGUAGE="es"');
      expect(updatedContent).toContain('LANGUAGE="en"');
      expect(updatedContent).toContain('SUBTITLES="subs"');
    });
  });

  describe('Funciones de conveniencia', () => {
    it('addSubtitleToVideo debería funcionar igual que el método de clase', async () => {
      const subtitleInfo: Omit<SubtitleTrack, 'path'> = {
        id: 'sub_convenience',
        language: 'es',
        label: 'Convenience Test',
        format: 'srt',
        isDefault: true
      };

      const outputPath = await addSubtitleToVideo(
        testVideoPath,
        testSubtitleEsPath,
        testOutputDir,
        testVideoId,
        subtitleInfo
      );

      expect(typeof outputPath).toBe('string');
      expect(fs.existsSync(outputPath)).toBe(true);
    }, 30000);

    it('extractSubtitlesFromVideo debería funcionar igual que el método de clase', async () => {
      const subtitles = await extractSubtitlesFromVideo(
        testVideoPath,
        testOutputDir,
        testVideoId
      );

      expect(Array.isArray(subtitles)).toBe(true);
    });

    it('removeSubtitlesFromVideo debería funcionar igual que el método de clase', async () => {
      // Primero crear un video con subtítulos
      const subtitleInfo: Omit<SubtitleTrack, 'path'> = {
        id: 'sub_remove_test',
        language: 'es',
        label: 'Remove Test',
        format: 'srt',
        isDefault: true
      };

      const videoWithSubs = await addSubtitleToVideo(
        testVideoPath,
        testSubtitleEsPath,
        testOutputDir,
        testVideoId,
        subtitleInfo
      );

      // Luego eliminar subtítulos
      const videoWithoutSubs = await removeSubtitlesFromVideo(
        videoWithSubs,
        testOutputDir,
        testVideoId
      );

      expect(typeof videoWithoutSubs).toBe('string');
      expect(fs.existsSync(videoWithoutSubs)).toBe(true);
    }, 45000);
  });
});