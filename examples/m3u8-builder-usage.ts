/**
 * Ejemplo de uso de la utilidad M3U8Builder
 * Demuestra cómo crear playlists M3U8 de manera segura y estructurada
 */

import { M3U8Builder, createM3U8Builder, validateM3U8Content } from '../src/lib/utils/m3u8-builder';
import path from 'path';
import fs from 'fs';

// Ejemplo 1: Playlist maestro básico
function createBasicMasterPlaylist(): string {
  const builder = new M3U8Builder({ version: 3 });
  
  return builder
    .addSubtitles({
      name: 'English',
      language: 'en',
      uri: 'subtitles_en.vtt',
      isDefault: true
    })
    .addSubtitles({
      name: 'Español',
      language: 'es',
      uri: 'subtitles_es.vtt',
      isDefault: false
    })
    .addAudio({
      name: 'Main Audio',
      language: 'en',
      uri: 'audio.m3u8',
      isDefault: true
    })
    .addStreamInfo({
      bandwidth: 800000,
      resolution: '1280x720',
      audio: 'audio',
      subtitles: 'subs',
      uri: 'stream_720p.m3u8'
    })
    .addStreamInfo({
      bandwidth: 400000,
      resolution: '854x480',
      audio: 'audio',
      subtitles: 'subs',
      uri: 'stream_480p.m3u8'
    })
    .build();
}

// Ejemplo 2: Playlist con múltiples idiomas de audio
function createMultiLanguagePlaylist(): string {
  const builder = createM3U8Builder({ version: 4 });
  
  return builder
    // Audio en múltiples idiomas
    .addAudio({
      groupId: 'audio',
      name: 'English',
      language: 'en',
      uri: 'audio_en.m3u8',
      isDefault: true
    })
    .addAudio({
      groupId: 'audio',
      name: 'Español',
      language: 'es',
      uri: 'audio_es.m3u8',
      isDefault: false
    })
    .addAudio({
      groupId: 'audio',
      name: 'Français',
      language: 'fr',
      uri: 'audio_fr.m3u8',
      isDefault: false
    })
    // Subtítulos
    .addSubtitles({
      name: 'English',
      language: 'en',
      uri: 'subs_en.vtt',
      isDefault: true
    })
    .addSubtitles({
      name: 'Español',
      language: 'es',
      uri: 'subs_es.vtt'
    })
    // Streams de video
    .addStreamInfo({
      bandwidth: 1200000,
      resolution: '1920x1080',
      codecs: 'avc1.640028,mp4a.40.2',
      audio: 'audio',
      subtitles: 'subs',
      uri: 'stream_1080p.m3u8'
    })
    .addStreamInfo({
      bandwidth: 800000,
      resolution: '1280x720',
      codecs: 'avc1.64001f,mp4a.40.2',
      audio: 'audio',
      subtitles: 'subs',
      uri: 'stream_720p.m3u8'
    })
    .build();
}

// Ejemplo 3: Validación de playlist existente
function validateExistingPlaylist(playlistContent: string): void {
  const validation = validateM3U8Content(playlistContent);
  
  console.log('Resultado de validación:');
  console.log(`  ✅ Válido: ${validation.isValid}`);
  
  if (validation.errors.length > 0) {
    console.log('  ❌ Errores:');
    validation.errors.forEach(error => console.log(`    - ${error}`));
  }
  
  if (validation.warnings.length > 0) {
    console.log('  ⚠️  Advertencias:');
    validation.warnings.forEach(warning => console.log(`    - ${warning}`));
  }
}

// Ejemplo 4: Manejo seguro de caracteres especiales
function createPlaylistWithSpecialCharacters(): string {
  const builder = new M3U8Builder();
  
  return builder
    .addSubtitles({
      name: 'Subtítulos en "Español" con caracteres especiales: áéíóú',
      language: 'es',
      uri: 'subtitles_special_chars.vtt',
      isDefault: true
    })
    .addAudio({
      name: 'Audio con comillas "dobles" y \'simples\'',
      language: 'es',
      uri: 'audio_special.m3u8',
      isDefault: true
    })
    .addStreamInfo({
      bandwidth: 500000,
      resolution: '854x480',
      audio: 'audio',
      subtitles: 'subs',
      uri: 'stream_with_special_chars.m3u8'
    })
    .build();
}

// Ejemplo 5: Construcción incremental con validación
function createPlaylistIncrementally(): string {
  const builder = new M3U8Builder({ version: 3 });
  
  // Agregar elementos uno por uno con validación
  try {
    builder.addAudio({
      name: 'Main Audio',
      language: 'en',
      uri: 'audio.m3u8',
      isDefault: true,
      channels: '2'
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
        audio: 'audio',
        uri: `stream_${quality.name}.m3u8`
      });
    });
    
    // Obtener estadísticas
    const stats = builder.getStats();
    console.log('Estadísticas del playlist:');
    console.log(`  - Pistas de audio: ${stats.audioTracks}`);
    console.log(`  - Streams de video: ${stats.streamInfos}`);
    console.log(`  - Total de pistas: ${stats.mediaTracks}`);
    
    return builder.build();
    
  } catch (error) {
    console.error('Error al construir el playlist:', error);
    throw error;
  }
}

// Función principal para demostrar todos los ejemplos
async function demonstrateM3U8Builder(): Promise<void> {
  console.log('🎬 Demostrando el uso de M3U8Builder\n');
  
  // Ejemplo 1: Playlist básico
  console.log('1️⃣ Playlist maestro básico:');
  const basicPlaylist = createBasicMasterPlaylist();
  console.log(basicPlaylist);
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Ejemplo 2: Playlist multiidioma
  console.log('2️⃣ Playlist con múltiples idiomas:');
  const multiLangPlaylist = createMultiLanguagePlaylist();
  console.log(multiLangPlaylist);
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Ejemplo 3: Validación
  console.log('3️⃣ Validación de playlist:');
  validateExistingPlaylist(basicPlaylist);
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Ejemplo 4: Caracteres especiales
  console.log('4️⃣ Playlist con caracteres especiales:');
  const specialCharsPlaylist = createPlaylistWithSpecialCharacters();
  console.log(specialCharsPlaylist);
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Ejemplo 5: Construcción incremental
  console.log('5️⃣ Construcción incremental:');
  const incrementalPlaylist = createPlaylistIncrementally();
  console.log(incrementalPlaylist);
  
  // Guardar ejemplos en archivos
  const examplesDir = path.join(__dirname, '..', 'example-output', 'playlist-examples');
  await fs.promises.mkdir(examplesDir, { recursive: true });
  
  await fs.promises.writeFile(
    path.join(examplesDir, 'basic-master.m3u8'),
    basicPlaylist
  );
  
  await fs.promises.writeFile(
    path.join(examplesDir, 'multi-language.m3u8'),
    multiLangPlaylist
  );
  
  await fs.promises.writeFile(
    path.join(examplesDir, 'special-chars.m3u8'),
    specialCharsPlaylist
  );
  
  await fs.promises.writeFile(
    path.join(examplesDir, 'incremental.m3u8'),
    incrementalPlaylist
  );
  
  console.log(`\n📁 Ejemplos guardados en: ${examplesDir}`);
}

// Ejecutar la demostración si este archivo se ejecuta directamente
if (require.main === module) {
  demonstrateM3U8Builder().catch(console.error);
}

export {
  createBasicMasterPlaylist,
  createMultiLanguagePlaylist,
  validateExistingPlaylist,
  createPlaylistWithSpecialCharacters,
  createPlaylistIncrementally,
  demonstrateM3U8Builder
};