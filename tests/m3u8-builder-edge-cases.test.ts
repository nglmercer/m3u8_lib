/**
 * Tests adicionales para casos edge y cobertura completa de M3U8Builder
 */

import {
  M3U8Builder,
  createM3U8Builder,
  validateM3U8Content,
  M3U8MediaTrack,
  M3U8StreamInfo,
  M3U8PlaylistOptions
} from '../src/lib/utils/m3u8-builder';

describe('M3U8Builder - Casos Edge', () => {
  let builder: M3U8Builder;

  beforeEach(() => {
    builder = new M3U8Builder();
  });

  describe('Validaciones estrictas', () => {
    test('debe rechazar bandwidth cero', () => {
      expect(() => {
        builder.addStreamInfo({
          bandwidth: 0,
          uri: 'stream.m3u8'
        });
      }).toThrow('Los campos bandwidth y uri son requeridos para un stream');
    });

    test('debe rechazar bandwidth negativo', () => {
      expect(() => {
        builder.addStreamInfo({
          bandwidth: -500000,
          uri: 'stream.m3u8'
        });
      }).toThrow('El bandwidth debe ser un número positivo');
    });

    test('debe rechazar URI vacía', () => {
      expect(() => {
        builder.addStreamInfo({
          bandwidth: 1000000,
          uri: ''
        });
      }).toThrow('Los campos bandwidth y uri son requeridos para un stream');
    });

    test('debe rechazar URI undefined', () => {
      expect(() => {
        builder.addStreamInfo({
          bandwidth: 1000000,
          uri: undefined as any
        });
      }).toThrow('Los campos bandwidth y uri son requeridos para un stream');
    });

    test('debe rechazar resolución con formato inválido', () => {
      const invalidResolutions = [
        'invalid',
        '1920',
        'x720',
        '1920x',
        '1920x720x30',
        '1920-720',
        '1920*720',
        'abc x def'
      ];

      invalidResolutions.forEach(resolution => {
        expect(() => {
          builder.addStreamInfo({
            bandwidth: 1000000,
            resolution,
            uri: 'stream.m3u8'
          });
        }).toThrow('Formato de resolución inválido');
      });
    });

    test('debe aceptar resoluciones válidas', () => {
      const validResolutions = [
        '1920x1080',
        '1280x720',
        '854x480',
        '640x360',
        '426x240',
        '3840x2160',
        '7680x4320'
      ];

      validResolutions.forEach((resolution, index) => {
        expect(() => {
          builder.addStreamInfo({
            bandwidth: 1000000 + index * 100000,
            resolution,
            uri: `stream_${index}.m3u8`
          });
        }).not.toThrow();
      });

      expect(builder.getStats().streamInfos).toBe(validResolutions.length);
    });
  });

  describe('Validación de MediaTrack', () => {
    test('debe rechazar type vacío', () => {
      expect(() => {
        builder.addMediaTrack({
          type: '' as any,
          groupId: 'audio',
          name: 'Test'
        });
      }).toThrow('Tipo de media inválido: . Debe ser uno de: AUDIO, VIDEO, SUBTITLES, CLOSED-CAPTIONS');
    });

    test('debe rechazar groupId vacío', () => {
      expect(() => {
        builder.addMediaTrack({
          type: 'AUDIO',
          groupId: '',
          name: 'Test'
        });
      }).toThrow('Los campos type, groupId y name son requeridos');
    });

    test('debe rechazar name vacío', () => {
      expect(() => {
        builder.addMediaTrack({
          type: 'AUDIO',
          groupId: 'audio',
          name: ''
        });
      }).toThrow('Los campos type, groupId y name son requeridos');
    });

    test('debe rechazar tipos de media inválidos', () => {
      const invalidTypes = ['INVALID', 'TEXT', 'IMAGE', 'DATA', ''];
      
      invalidTypes.forEach(type => {
        expect(() => {
          builder.addMediaTrack({
            type: type as any,
            groupId: 'test',
            name: 'Test'
          });
        }).toThrow(`Tipo de media inválido: ${type}. Debe ser uno de: AUDIO, VIDEO, SUBTITLES, CLOSED-CAPTIONS`);
      });
    });

    test('debe aceptar todos los tipos válidos', () => {
      const validTypes: Array<'AUDIO' | 'VIDEO' | 'SUBTITLES' | 'CLOSED-CAPTIONS'> = [
        'AUDIO',
        'VIDEO', 
        'SUBTITLES',
        'CLOSED-CAPTIONS'
      ];

      validTypes.forEach((type, index) => {
        expect(() => {
          builder.addMediaTrack({
            type,
            groupId: `group_${index}`,
            name: `Track ${index}`
          });
        }).not.toThrow();
      });

      expect(builder.getStats().mediaTracks).toBe(validTypes.length);
    });
  });

  describe('Escape de caracteres complejos', () => {
    test('debe escapar múltiples tipos de caracteres especiales', () => {
      const complexName = 'Track "with\\quotes" and\nnewlines\rand\ttabs';
      
      builder.addSubtitles({
        name: complexName,
        language: 'en',
        uri: 'complex.vtt'
      });

      const playlist = builder.build();
      expect(playlist).toContain('NAME="Track \\"with\\\\quotes\\" and\\nnewlines\\rand\\ttabs"');
    });

    test('debe manejar caracteres Unicode complejos', () => {
      const unicodeNames = [
        'Subtítulos en español: áéíóúñü',
        'Français: àâäéèêëïîôöùûüÿç',
        'Deutsch: äöüß',
        'Русский: абвгдеёжзийклмнопрстуфхцчшщъыьэюя',
        '中文字幕',
        '日本語字幕',
        '한국어 자막',
        'العربية',
        'עברית',
        'हिन्दी'
      ];

      unicodeNames.forEach((name, index) => {
        builder.addSubtitles({
          name,
          language: 'multi',
          uri: `unicode_${index}.vtt`
        });
      });

      const playlist = builder.build();
      unicodeNames.forEach(name => {
        expect(playlist).toContain(name);
      });
    });

    test('debe manejar caracteres de control', () => {
      const controlChars = 'Test\u0000\u0001\u0002\u0003\u0004\u0005';
      
      builder.addSubtitles({
        name: controlChars,
        language: 'en',
        uri: 'control.vtt'
      });

      const playlist = builder.build();
      // Los caracteres de control deben estar presentes en el playlist
      expect(playlist).toContain('NAME="Test');
    });
  });

  describe('Configuraciones extremas', () => {
    test('debe manejar playlist con muchas pistas', () => {
      // Agregar 50 pistas de audio
      for (let i = 0; i < 50; i++) {
        builder.addAudio({
          name: `Audio Track ${i}`,
          language: `lang${i}`,
          uri: `audio_${i}.m3u8`
        });
      }

      // Agregar 100 pistas de subtítulos
      for (let i = 0; i < 100; i++) {
        builder.addSubtitles({
          name: `Subtitle Track ${i}`,
          language: `sub${i}`,
          uri: `sub_${i}.vtt`
        });
      }

      // Agregar 20 streams
      for (let i = 0; i < 20; i++) {
        builder.addStreamInfo({
          bandwidth: 100000 + (i * 50000),
          resolution: `${640 + i * 64}x${360 + i * 36}`,
          uri: `stream_${i}.m3u8`
        });
      }

      const stats = builder.getStats();
      expect(stats.audioTracks).toBe(50);
      expect(stats.subtitleTracks).toBe(100);
      expect(stats.streamInfos).toBe(20);
      expect(stats.mediaTracks).toBe(150);

      const playlist = builder.build();
      expect(playlist).toContain('#EXTM3U');
      expect(playlist.split('\n').length).toBeGreaterThan(150); // Muchas líneas
    });

    test('debe manejar bandwidth extremadamente alto', () => {
      builder.addStreamInfo({
        bandwidth: 999999999999, // ~1TB/s
        resolution: '7680x4320',
        uri: 'ultra_high.m3u8'
      });

      const playlist = builder.build();
      expect(playlist).toContain('BANDWIDTH=999999999999');
    });

    test('debe manejar resoluciones extremas', () => {
      const extremeResolutions = [
        '1x1',
        '32768x32768',
        '99999x99999'
      ];

      extremeResolutions.forEach((resolution, index) => {
        builder.addStreamInfo({
          bandwidth: 1000000 + index,
          resolution,
          uri: `extreme_${index}.m3u8`
        });
      });

      const playlist = builder.build();
      extremeResolutions.forEach(resolution => {
        expect(playlist).toContain(`RESOLUTION=${resolution}`);
      });
    });
  });

  describe('Opciones de playlist avanzadas', () => {
    test('debe manejar todas las opciones simultáneamente', () => {
      const options: M3U8PlaylistOptions = {
        version: 7,
        targetDuration: 60,
        playlistType: 'EVENT',
        independentSegments: true
      };

      const advancedBuilder = new M3U8Builder(options);
      const playlist = advancedBuilder.build();

      expect(playlist).toContain('#EXT-X-VERSION:7');
      expect(playlist).toContain('#EXT-X-TARGETDURATION:60');
      expect(playlist).toContain('#EXT-X-PLAYLIST-TYPE:EVENT');
      expect(playlist).toContain('#EXT-X-INDEPENDENT-SEGMENTS');
    });

    test('debe manejar versiones extremas', () => {
      const versions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      
      versions.forEach(version => {
        const builder = new M3U8Builder({ version });
        const playlist = builder.build();
        expect(playlist).toContain(`#EXT-X-VERSION:${version}`);
      });
    });
  });

  describe('Casos de reutilización', () => {
    test('debe permitir múltiples builds sin interferencia', () => {
      builder.addAudio({ name: 'Audio', uri: 'audio.m3u8' });
      
      const playlist1 = builder.build();
      const playlist2 = builder.build();
      const playlist3 = builder.build();
      
      expect(playlist1).toBe(playlist2);
      expect(playlist2).toBe(playlist3);
      expect(playlist1).toContain('Audio');
    });

    test('debe mantener estado después de múltiples clears', () => {
      for (let i = 0; i < 10; i++) {
        builder
          .addAudio({ name: `Audio ${i}`, uri: `audio_${i}.m3u8` })
          .addSubtitles({ name: `Sub ${i}`, language: 'en', uri: `sub_${i}.vtt` });
        
        expect(builder.getStats().mediaTracks).toBe(2);
        
        builder.clear();
        
        expect(builder.getStats().mediaTracks).toBe(0);
      }
    });

    test('debe permitir reconstrucción después de clear', () => {
      // Primera construcción
      builder
        .addAudio({ name: 'Audio 1', uri: 'audio1.m3u8' })
        .addStreamInfo({ bandwidth: 1000000, uri: 'stream1.m3u8' });
      
      const playlist1 = builder.build();
      expect(playlist1).toContain('Audio 1');
      expect(playlist1).toContain('stream1.m3u8');
      
      // Clear y segunda construcción
      builder.clear()
        .addAudio({ name: 'Audio 2', uri: 'audio2.m3u8' })
        .addStreamInfo({ bandwidth: 2000000, uri: 'stream2.m3u8' });
      
      const playlist2 = builder.build();
      expect(playlist2).toContain('Audio 2');
      expect(playlist2).toContain('stream2.m3u8');
      expect(playlist2).not.toContain('Audio 1');
      expect(playlist2).not.toContain('stream1.m3u8');
    });
  });
});

describe('validateM3U8Content - Casos Edge', () => {
  test('debe manejar playlist vacío', () => {
    const result = validateM3U8Content('');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('El playlist debe comenzar con #EXTM3U');
  });

  test('debe manejar playlist solo con espacios', () => {
    const result = validateM3U8Content('   \n\t  ');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('El playlist debe comenzar con #EXTM3U');
  });

  test('debe manejar playlist con solo header', () => {
    const result = validateM3U8Content('#EXTM3U');
    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain('Se recomienda especificar la versión con #EXT-X-VERSION');
    expect(result.warnings).toContain('El playlist no contiene streams de video');
  });

  test('debe detectar múltiples STREAM-INF sin URI', () => {
    const playlist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=1000000
#EXT-X-STREAM-INF:BANDWIDTH=2000000
#EXT-X-ENDLIST`;
    
    const result = validateM3U8Content(playlist);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Línea 4: #EXT-X-STREAM-INF debe ser seguida por una URI');
    expect(result.errors).toContain('Línea 5: #EXT-X-STREAM-INF debe ser seguida por una URI');
  });

  test('debe manejar playlist con caracteres Unicode', () => {
    const playlist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Español",LANGUAGE="es",URI="español.vtt"
#EXT-X-STREAM-INF:BANDWIDTH=1000000,SUBTITLES="subs"
stream.m3u8`;
    
    const result = validateM3U8Content(playlist);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('debe manejar playlist muy largo', () => {
    let playlist = '#EXTM3U\n#EXT-X-VERSION:3\n\n';
    
    // Agregar 1000 streams
    for (let i = 0; i < 1000; i++) {
      playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${100000 + i * 1000}\nstream_${i}.m3u8\n`;
    }
    
    const result = validateM3U8Content(playlist);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('Integración y casos reales complejos', () => {
  test('debe generar playlist para streaming en vivo', () => {
    const builder = new M3U8Builder({
      version: 6,
      playlistType: 'EVENT',
      independentSegments: true
    });

    // Audio en múltiples idiomas
    ['en', 'es', 'fr', 'de', 'ja'].forEach(lang => {
      builder.addAudio({
        name: `Audio ${lang.toUpperCase()}`,
        language: lang,
        uri: `audio_${lang}.m3u8`,
        isDefault: lang === 'en',
        channels: '2'
      });
    });

    // Subtítulos en múltiples idiomas
    ['en', 'es', 'fr', 'de', 'ja', 'zh', 'ar'].forEach(lang => {
      builder.addSubtitles({
        name: `Subtitles ${lang.toUpperCase()}`,
        language: lang,
        uri: `subs_${lang}.vtt`,
        isDefault: lang === 'en'
      });
    });

    // Múltiples calidades con diferentes codecs
    const qualities = [
      { bandwidth: 400000, resolution: '640x360', codecs: 'avc1.42001e,mp4a.40.2' },
      { bandwidth: 800000, resolution: '854x480', codecs: 'avc1.42001f,mp4a.40.2' },
      { bandwidth: 1200000, resolution: '1280x720', codecs: 'avc1.64001f,mp4a.40.2' },
      { bandwidth: 2500000, resolution: '1920x1080', codecs: 'avc1.640028,mp4a.40.2' },
      { bandwidth: 6000000, resolution: '3840x2160', codecs: 'hvc1.1.6.L93.90,mp4a.40.2' }
    ];

    qualities.forEach((quality, index) => {
      builder.addStreamInfo({
        bandwidth: quality.bandwidth,
        resolution: quality.resolution,
        codecs: quality.codecs,
        frameRate: 30,
        audio: 'audio',
        subtitles: 'subs',
        uri: `stream_${index}.m3u8`
      });
    });

    const playlist = builder.build();
    const stats = builder.getStats();

    // Verificar estructura
    expect(playlist).toContain('#EXT-X-VERSION:6');
    expect(playlist).toContain('#EXT-X-PLAYLIST-TYPE:EVENT');
    expect(playlist).toContain('#EXT-X-INDEPENDENT-SEGMENTS');
    
    // Verificar contenido
    expect(stats.audioTracks).toBe(5);
    expect(stats.subtitleTracks).toBe(7);
    expect(stats.streamInfos).toBe(5);
    
    // Verificar codecs
    expect(playlist).toContain('hvc1.1.6.L93.90'); // HEVC para 4K
    expect(playlist).toContain('avc1.640028'); // H.264 High Profile
    
    // Verificar que es un playlist válido
    const validation = validateM3U8Content(playlist);
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('debe manejar playlist con características avanzadas', () => {
    const builder = new M3U8Builder({ version: 7 });

    // Audio con características específicas
    builder.addAudio({
      name: 'Surround 5.1',
      language: 'en',
      uri: 'audio_surround.m3u8',
      channels: '6',
      isDefault: true
    });

    builder.addAudio({
      name: 'Stereo',
      language: 'en', 
      uri: 'audio_stereo.m3u8',
      channels: '2',
      isDefault: false
    });

    // Subtítulos con características
    builder.addSubtitles({
      name: 'SDH English',
      language: 'en',
      uri: 'subs_sdh.vtt',
      isDefault: true,
      autoSelect: true
    });

    // Stream con frame rate variable
    builder.addStreamInfo({
      bandwidth: 5000000,
      resolution: '1920x1080',
      codecs: 'avc1.640028,mp4a.40.2',
      frameRate: 59.94,
      audio: 'audio',
      subtitles: 'subs',
      uri: 'stream_60fps.m3u8'
    });

    const playlist = builder.build();
    
    expect(playlist).toContain('CHANNELS="6"');
    expect(playlist).toContain('CHANNELS="2"');
    expect(playlist).toContain('FRAME-RATE=59.94');
    expect(playlist).toContain('SDH English');
  });
});