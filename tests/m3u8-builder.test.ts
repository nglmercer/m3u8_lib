/**
 * Tests para la utilidad M3U8Builder
 * Cubre todas las funcionalidades, validaciones y casos de error
 */

import {
  M3U8Builder,
  createM3U8Builder,
  validateM3U8Content,
  M3U8MediaTrack,
  M3U8StreamInfo,
  M3U8PlaylistOptions
} from '../src/lib/utils/m3u8-builder';

describe('M3U8Builder', () => {
  let builder: M3U8Builder;

  beforeEach(() => {
    builder = new M3U8Builder();
  });

  describe('Constructor y configuración inicial', () => {
    test('debe crear una instancia con configuración por defecto', () => {
      const defaultBuilder = new M3U8Builder();
      expect(defaultBuilder).toBeInstanceOf(M3U8Builder);
      
      const stats = defaultBuilder.getStats();
      expect(stats.mediaTracks).toBe(0);
      expect(stats.streamInfos).toBe(0);
    });

    test('debe aceptar opciones personalizadas', () => {
      const options: M3U8PlaylistOptions = {
        version: 4,
        targetDuration: 10,
        playlistType: 'VOD',
        independentSegments: true
      };
      
      const customBuilder = new M3U8Builder(options);
      const playlist = customBuilder.build();
      
      expect(playlist).toContain('#EXT-X-VERSION:4');
      expect(playlist).toContain('#EXT-X-TARGETDURATION:10');
      expect(playlist).toContain('#EXT-X-PLAYLIST-TYPE:VOD');
      expect(playlist).toContain('#EXT-X-INDEPENDENT-SEGMENTS');
    });

    test('debe usar valores por defecto cuando no se proporcionan opciones', () => {
      const playlist = builder.build();
      expect(playlist).toContain('#EXT-X-VERSION:3');
      expect(playlist).not.toContain('#EXT-X-TARGETDURATION');
      expect(playlist).not.toContain('#EXT-X-PLAYLIST-TYPE');
      expect(playlist).not.toContain('#EXT-X-INDEPENDENT-SEGMENTS');
    });
  });

  describe('addMediaTrack', () => {
    test('debe agregar una pista de media válida', () => {
      const track: M3U8MediaTrack = {
        type: 'AUDIO',
        groupId: 'audio',
        name: 'Main Audio',
        language: 'en',
        isDefault: true,
        uri: 'audio.m3u8'
      };
      
      builder.addMediaTrack(track);
      const stats = builder.getStats();
      
      expect(stats.mediaTracks).toBe(1);
      expect(stats.audioTracks).toBe(1);
    });

    test('debe validar campos requeridos', () => {
      expect(() => {
        builder.addMediaTrack({
          type: 'AUDIO',
          groupId: '',
          name: 'Test'
        } as M3U8MediaTrack);
      }).toThrow('Los campos type, groupId y name son requeridos');

      expect(() => {
        builder.addMediaTrack({
          type: 'AUDIO',
          groupId: 'audio',
          name: ''
        } as M3U8MediaTrack);
      }).toThrow('Los campos type, groupId y name son requeridos');
    });

    test('debe validar tipos de media válidos', () => {
      expect(() => {
        builder.addMediaTrack({
          type: 'INVALID' as any,
          groupId: 'test',
          name: 'Test'
        });
      }).toThrow('Tipo de media inválido: INVALID');
    });

    test('debe advertir sobre formatos de idioma inválidos', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      builder.addMediaTrack({
        type: 'AUDIO',
        groupId: 'audio',
        name: 'Test',
        language: 'invalid-format'
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Formato de idioma posiblemente inválido')
      );
      
      consoleSpy.mockRestore();
    });

    test('debe aceptar códigos de idioma válidos', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Códigos válidos
      const validLanguages = ['en', 'es', 'fr', 'en-US', 'es-MX', 'zh-CN'];
      
      validLanguages.forEach(lang => {
        builder.addMediaTrack({
          type: 'AUDIO',
          groupId: 'audio',
          name: `Test ${lang}`,
          language: lang
        });
      });
      
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('addStreamInfo', () => {
    test('debe agregar información de stream válida', () => {
      const streamInfo: M3U8StreamInfo = {
        bandwidth: 1000000,
        resolution: '1280x720',
        uri: 'stream.m3u8'
      };
      
      builder.addStreamInfo(streamInfo);
      const stats = builder.getStats();
      
      expect(stats.streamInfos).toBe(1);
    });

    test('debe validar campos requeridos', () => {
      expect(() => {
        builder.addStreamInfo({
          bandwidth: 0,
          uri: 'test.m3u8'
        });
      }).toThrow('Los campos bandwidth y uri son requeridos para un stream');

      expect(() => {
        builder.addStreamInfo({
          bandwidth: 1000000,
          uri: ''
        });
      }).toThrow('Los campos bandwidth y uri son requeridos para un stream');
    });

    test('debe validar bandwidth positivo', () => {
      expect(() => {
        builder.addStreamInfo({
          bandwidth: -1000,
          uri: 'test.m3u8'
        });
      }).toThrow('El bandwidth debe ser un número positivo');
    });

    test('debe validar formato de resolución', () => {
      expect(() => {
        builder.addStreamInfo({
          bandwidth: 1000000,
          resolution: 'invalid',
          uri: 'test.m3u8'
        });
      }).toThrow('Formato de resolución inválido');

      expect(() => {
        builder.addStreamInfo({
          bandwidth: 1000000,
          resolution: '1280x720x30',
          uri: 'test.m3u8'
        });
      }).toThrow('Formato de resolución inválido');
    });

    test('debe aceptar resoluciones válidas', () => {
      const validResolutions = ['1920x1080', '1280x720', '854x480', '640x360'];
      
      validResolutions.forEach((resolution, index) => {
        builder.addStreamInfo({
          bandwidth: 1000000 + index * 100000,
          resolution,
          uri: `stream_${index}.m3u8`
        });
      });
      
      const stats = builder.getStats();
      expect(stats.streamInfos).toBe(validResolutions.length);
    });
  });

  describe('addSubtitles', () => {
    test('debe agregar subtítulos con configuración básica', () => {
      builder.addSubtitles({
        name: 'English',
        language: 'en',
        uri: 'subs_en.vtt'
      });
      
      const stats = builder.getStats();
      expect(stats.subtitleTracks).toBe(1);
    });

    test('debe usar groupId por defecto', () => {
      builder.addSubtitles({
        name: 'English',
        language: 'en',
        uri: 'subs_en.vtt'
      });
      
      const playlist = builder.build();
      expect(playlist).toContain('GROUP-ID="subs"');
    });

    test('debe permitir groupId personalizado', () => {
      builder.addSubtitles({
        groupId: 'custom-subs',
        name: 'English',
        language: 'en',
        uri: 'subs_en.vtt'
      });
      
      const playlist = builder.build();
      expect(playlist).toContain('GROUP-ID="custom-subs"');
    });

    test('debe manejar opciones adicionales', () => {
      builder.addSubtitles({
        name: 'English',
        language: 'en',
        uri: 'subs_en.vtt',
        isDefault: true,
        autoSelect: false
      });
      
      const playlist = builder.build();
      expect(playlist).toContain('DEFAULT=YES');
      expect(playlist).toContain('AUTOSELECT=NO');
    });
  });

  describe('addAudio', () => {
    test('debe agregar audio con configuración básica', () => {
      builder.addAudio({
        name: 'Main Audio',
        uri: 'audio.m3u8'
      });
      
      const stats = builder.getStats();
      expect(stats.audioTracks).toBe(1);
    });

    test('debe usar groupId por defecto', () => {
      builder.addAudio({
        name: 'Main Audio',
        uri: 'audio.m3u8'
      });
      
      const playlist = builder.build();
      expect(playlist).toContain('GROUP-ID="audio"');
    });

    test('debe manejar todas las opciones', () => {
      builder.addAudio({
        groupId: 'custom-audio',
        name: 'Stereo Audio',
        language: 'en',
        uri: 'audio_en.m3u8',
        isDefault: true,
        autoSelect: true,
        channels: '2'
      });
      
      const playlist = builder.build();
      expect(playlist).toContain('GROUP-ID="custom-audio"');
      expect(playlist).toContain('LANGUAGE="en"');
      expect(playlist).toContain('CHANNELS="2"');
    });
  });

  describe('Escape de caracteres especiales', () => {
    test('debe escapar comillas dobles', () => {
      builder.addSubtitles({
        name: 'Subtítulos "especiales"',
        language: 'es',
        uri: 'subs.vtt'
      });
      
      const playlist = builder.build();
      expect(playlist).toContain('NAME="Subtítulos \\"especiales\\""');
    });

    test('debe escapar barras invertidas', () => {
      builder.addSubtitles({
        name: 'Path\\with\\backslashes',
        language: 'en',
        uri: 'subs.vtt'
      });
      
      const playlist = builder.build();
      expect(playlist).toContain('NAME="Path\\\\with\\\\backslashes"');
    });

    test('debe escapar saltos de línea', () => {
      builder.addSubtitles({
        name: 'Multi\nline\rname',
        language: 'en',
        uri: 'subs.vtt'
      });
      
      const playlist = builder.build();
      expect(playlist).toContain('NAME="Multi\\nline\\rname"');
    });

    test('debe manejar caracteres Unicode', () => {
      builder.addSubtitles({
        name: 'Subtítulos en español: áéíóú ñ',
        language: 'es',
        uri: 'subs_es.vtt'
      });
      
      const playlist = builder.build();
      expect(playlist).toContain('Subtítulos en español: áéíóú ñ');
    });
  });

  describe('build', () => {
    test('debe generar playlist básico válido', () => {
      const playlist = builder.build();
      
      expect(playlist).toMatch(/^#EXTM3U/);
      expect(playlist).toContain('#EXT-X-VERSION:3');
    });

    test('debe generar playlist completo con media y streams', () => {
      builder
        .addSubtitles({
          name: 'English',
          language: 'en',
          uri: 'subs_en.vtt',
          isDefault: true
        })
        .addAudio({
          name: 'Main Audio',
          language: 'en',
          uri: 'audio.m3u8',
          isDefault: true
        })
        .addStreamInfo({
          bandwidth: 1000000,
          resolution: '1280x720',
          audio: 'audio',
          subtitles: 'subs',
          uri: 'stream_720p.m3u8'
        });
      
      const playlist = builder.build();
      
      expect(playlist).toContain('#EXT-X-MEDIA:TYPE=SUBTITLES');
      expect(playlist).toContain('#EXT-X-MEDIA:TYPE=AUDIO');
      expect(playlist).toContain('#EXT-X-STREAM-INF:BANDWIDTH=1000000');
      expect(playlist).toContain('stream_720p.m3u8');
    });

    test('debe ordenar streams por bandwidth', () => {
      builder
        .addStreamInfo({
          bandwidth: 2000000,
          resolution: '1920x1080',
          uri: 'stream_1080p.m3u8'
        })
        .addStreamInfo({
          bandwidth: 500000,
          resolution: '640x360',
          uri: 'stream_360p.m3u8'
        })
        .addStreamInfo({
          bandwidth: 1000000,
          resolution: '1280x720',
          uri: 'stream_720p.m3u8'
        });
      
      const playlist = builder.build();
      const lines = playlist.split('\n');
      
      // Encontrar índices de las líneas de bandwidth
      const bandwidth500Index = lines.findIndex(line => line.includes('BANDWIDTH=500000'));
      const bandwidth1000Index = lines.findIndex(line => line.includes('BANDWIDTH=1000000'));
      const bandwidth2000Index = lines.findIndex(line => line.includes('BANDWIDTH=2000000'));
      
      expect(bandwidth500Index).toBeLessThan(bandwidth1000Index);
      expect(bandwidth1000Index).toBeLessThan(bandwidth2000Index);
    });

    test('debe incluir líneas vacías apropiadas', () => {
      builder
        .addAudio({ name: 'Audio', uri: 'audio.m3u8' })
        .addStreamInfo({ bandwidth: 1000000, uri: 'stream.m3u8' });
      
      const playlist = builder.build();
      const lines = playlist.split('\n');
      
      // Debe haber línea vacía después del header
      expect(lines[2]).toBe('');
      
      // Debe haber línea vacía entre media tracks y streams
      const audioLineIndex = lines.findIndex(line => line.includes('#EXT-X-MEDIA:TYPE=AUDIO'));
      const streamLineIndex = lines.findIndex(line => line.includes('#EXT-X-STREAM-INF'));
      expect(lines[audioLineIndex + 1]).toBe('');
    });
  });

  describe('clear', () => {
    test('debe limpiar todas las pistas y streams', () => {
      builder
        .addAudio({ name: 'Audio', uri: 'audio.m3u8' })
        .addSubtitles({ name: 'Subs', language: 'en', uri: 'subs.vtt' })
        .addStreamInfo({ bandwidth: 1000000, uri: 'stream.m3u8' });
      
      let stats = builder.getStats();
      expect(stats.mediaTracks).toBe(2);
      expect(stats.streamInfos).toBe(1);
      
      builder.clear();
      
      stats = builder.getStats();
      expect(stats.mediaTracks).toBe(0);
      expect(stats.streamInfos).toBe(0);
      expect(stats.audioTracks).toBe(0);
      expect(stats.subtitleTracks).toBe(0);
    });

    test('debe permitir reutilización después de clear', () => {
      builder.addAudio({ name: 'Audio 1', uri: 'audio1.m3u8' });
      builder.clear();
      builder.addAudio({ name: 'Audio 2', uri: 'audio2.m3u8' });
      
      const playlist = builder.build();
      expect(playlist).toContain('Audio 2');
      expect(playlist).not.toContain('Audio 1');
    });
  });

  describe('getStats', () => {
    test('debe retornar estadísticas correctas', () => {
      builder
        .addAudio({ name: 'Audio 1', uri: 'audio1.m3u8' })
        .addAudio({ name: 'Audio 2', uri: 'audio2.m3u8' })
        .addSubtitles({ name: 'Subs 1', language: 'en', uri: 'subs1.vtt' })
        .addSubtitles({ name: 'Subs 2', language: 'es', uri: 'subs2.vtt' })
        .addSubtitles({ name: 'Subs 3', language: 'fr', uri: 'subs3.vtt' })
        .addStreamInfo({ bandwidth: 1000000, uri: 'stream1.m3u8' })
        .addStreamInfo({ bandwidth: 2000000, uri: 'stream2.m3u8' });
      
      const stats = builder.getStats();
      
      expect(stats.mediaTracks).toBe(5);
      expect(stats.audioTracks).toBe(2);
      expect(stats.subtitleTracks).toBe(3);
      expect(stats.videoTracks).toBe(0);
      expect(stats.streamInfos).toBe(2);
    });

    test('debe retornar ceros para builder vacío', () => {
      const stats = builder.getStats();
      
      expect(stats.mediaTracks).toBe(0);
      expect(stats.audioTracks).toBe(0);
      expect(stats.subtitleTracks).toBe(0);
      expect(stats.videoTracks).toBe(0);
      expect(stats.streamInfos).toBe(0);
    });
  });

  describe('Encadenamiento de métodos', () => {
    test('debe permitir encadenamiento fluido', () => {
      const result = builder
        .addSubtitles({ name: 'English', language: 'en', uri: 'en.vtt' })
        .addSubtitles({ name: 'Spanish', language: 'es', uri: 'es.vtt' })
        .addAudio({ name: 'Main Audio', uri: 'audio.m3u8' })
        .addStreamInfo({ bandwidth: 1000000, uri: 'stream.m3u8' })
        .clear()
        .addAudio({ name: 'New Audio', uri: 'new_audio.m3u8' });
      
      expect(result).toBe(builder);
      
      const stats = builder.getStats();
      expect(stats.audioTracks).toBe(1);
      expect(stats.subtitleTracks).toBe(0);
    });
  });
});

describe('createM3U8Builder', () => {
  test('debe crear una instancia de M3U8Builder', () => {
    const builder = createM3U8Builder();
    expect(builder).toBeInstanceOf(M3U8Builder);
  });

  test('debe pasar opciones al constructor', () => {
    const options: M3U8PlaylistOptions = {
      version: 4,
      playlistType: 'EVENT'
    };
    
    const builder = createM3U8Builder(options);
    const playlist = builder.build();
    
    expect(playlist).toContain('#EXT-X-VERSION:4');
    expect(playlist).toContain('#EXT-X-PLAYLIST-TYPE:EVENT');
  });
});

describe('validateM3U8Content', () => {
  test('debe validar playlist válido', () => {
    const validPlaylist = `#EXTM3U
#EXT-X-VERSION:3

#EXT-X-STREAM-INF:BANDWIDTH=1000000
stream.m3u8`;
    
    const result = validateM3U8Content(validPlaylist);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('debe detectar header faltante', () => {
    const invalidPlaylist = `#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=1000000
stream.m3u8`;
    
    const result = validateM3U8Content(invalidPlaylist);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('El playlist debe comenzar con #EXTM3U');
  });

  test('debe advertir sobre versión faltante', () => {
    const playlistWithoutVersion = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1000000
stream.m3u8`;
    
    const result = validateM3U8Content(playlistWithoutVersion);
    
    expect(result.warnings).toContain('Se recomienda especificar la versión con #EXT-X-VERSION');
  });

  test('debe detectar STREAM-INF sin URI', () => {
    const invalidPlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=1000000
#EXT-X-ENDLIST`;
    
    const result = validateM3U8Content(invalidPlaylist);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Línea 4: #EXT-X-STREAM-INF debe ser seguida por una URI');
  });

  test('debe advertir sobre playlist sin streams', () => {
    const playlistWithoutStreams = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Audio",URI="audio.m3u8"`;
    
    const result = validateM3U8Content(playlistWithoutStreams);
    
    expect(result.warnings).toContain('El playlist no contiene streams de video');
  });

  test('debe manejar playlist complejo válido', () => {
    const complexPlaylist = `#EXTM3U
#EXT-X-VERSION:3

#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Audio",URI="audio.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",URI="subs.vtt"

#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=1280x720,AUDIO="audio",SUBTITLES="subs"
stream_720p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=500000,RESOLUTION=640x360,AUDIO="audio",SUBTITLES="subs"
stream_360p.m3u8`;
    
    const result = validateM3U8Content(complexPlaylist);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('Casos de uso reales', () => {
  test('debe generar playlist maestro para streaming adaptativo', () => {
    const builder = new M3U8Builder({ version: 3 });
    
    // Agregar audio
    builder.addAudio({
      name: 'Main Audio',
      language: 'en',
      uri: 'audio.m3u8',
      isDefault: true,
      channels: '2'
    });
    
    // Agregar subtítulos
    builder
      .addSubtitles({
        name: 'English',
        language: 'en',
        uri: 'subs_en.vtt',
        isDefault: true
      })
      .addSubtitles({
        name: 'Español',
        language: 'es',
        uri: 'subs_es.vtt',
        isDefault: false
      });
    
    // Agregar múltiples calidades
    const qualities = [
      { bandwidth: 300000, resolution: '640x360', name: '360p' },
      { bandwidth: 600000, resolution: '854x480', name: '480p' },
      { bandwidth: 1000000, resolution: '1280x720', name: '720p' },
      { bandwidth: 2000000, resolution: '1920x1080', name: '1080p' }
    ];
    
    qualities.forEach(quality => {
      builder.addStreamInfo({
        bandwidth: quality.bandwidth,
        resolution: quality.resolution,
        codecs: 'avc1.64001f,mp4a.40.2',
        audio: 'audio',
        subtitles: 'subs',
        uri: `stream_${quality.name}.m3u8`
      });
    });
    
    const playlist = builder.build();
    
    // Verificar estructura
    expect(playlist).toMatch(/^#EXTM3U/);
    expect(playlist).toContain('#EXT-X-VERSION:3');
    expect(playlist).toContain('TYPE=AUDIO');
    expect(playlist).toContain('TYPE=SUBTITLES');
    expect(playlist).toContain('BANDWIDTH=300000');
    expect(playlist).toContain('BANDWIDTH=2000000');
    
    // Verificar orden por bandwidth
    const lines = playlist.split('\n');
    const bandwidth300Index = lines.findIndex(line => line.includes('BANDWIDTH=300000'));
    const bandwidth2000Index = lines.findIndex(line => line.includes('BANDWIDTH=2000000'));
    expect(bandwidth300Index).toBeLessThan(bandwidth2000Index);
    
    // Verificar estadísticas
    const stats = builder.getStats();
    expect(stats.audioTracks).toBe(1);
    expect(stats.subtitleTracks).toBe(2);
    expect(stats.streamInfos).toBe(4);
  });

  test('debe manejar playlist multiidioma complejo', () => {
    const builder = new M3U8Builder({ version: 4 });
    
    // Audio en múltiples idiomas
    const audioLanguages = [
      { lang: 'en', name: 'English', isDefault: true },
      { lang: 'es', name: 'Español', isDefault: false },
      { lang: 'fr', name: 'Français', isDefault: false },
      { lang: 'de', name: 'Deutsch', isDefault: false }
    ];
    
    audioLanguages.forEach(audio => {
      builder.addAudio({
        name: audio.name,
        language: audio.lang,
        uri: `audio_${audio.lang}.m3u8`,
        isDefault: audio.isDefault,
        channels: '2'
      });
    });
    
    // Subtítulos en múltiples idiomas
    const subtitleLanguages = [
      { lang: 'en', name: 'English', isDefault: true },
      { lang: 'es', name: 'Español', isDefault: false },
      { lang: 'fr', name: 'Français', isDefault: false },
      { lang: 'de', name: 'Deutsch', isDefault: false },
      { lang: 'ja', name: '日本語', isDefault: false }
    ];
    
    subtitleLanguages.forEach(subtitle => {
      builder.addSubtitles({
        name: subtitle.name,
        language: subtitle.lang,
        uri: `subs_${subtitle.lang}.vtt`,
        isDefault: subtitle.isDefault
      });
    });
    
    // Stream de video
    builder.addStreamInfo({
      bandwidth: 1500000,
      resolution: '1920x1080',
      codecs: 'avc1.640028,mp4a.40.2',
      frameRate: 30,
      audio: 'audio',
      subtitles: 'subs',
      uri: 'stream_1080p.m3u8'
    });
    
    const playlist = builder.build();
    
    // Verificar que todos los idiomas están presentes
    expect(playlist).toContain('LANGUAGE="en"');
    expect(playlist).toContain('LANGUAGE="es"');
    expect(playlist).toContain('LANGUAGE="fr"');
    expect(playlist).toContain('LANGUAGE="de"');
    expect(playlist).toContain('LANGUAGE="ja"');
    
    // Verificar caracteres Unicode
    expect(playlist).toContain('日本語');
    
    const stats = builder.getStats();
    expect(stats.audioTracks).toBe(4);
    expect(stats.subtitleTracks).toBe(5);
    expect(stats.streamInfos).toBe(1);
  });

  test('debe validar playlist generado', () => {
    const builder = new M3U8Builder()
      .addAudio({ name: 'Audio', uri: 'audio.m3u8' })
      .addStreamInfo({ bandwidth: 1000000, uri: 'stream.m3u8' });
    
    const playlist = builder.build();
    const validation = validateM3U8Content(playlist);
    
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
});