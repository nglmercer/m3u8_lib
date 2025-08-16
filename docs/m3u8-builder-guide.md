# Guía de M3U8Builder

## Introducción

La utilidad `M3U8Builder` proporciona una forma segura y estructurada de crear playlists M3U8 para HLS (HTTP Live Streaming). Esta herramienta reemplaza la construcción manual de strings, reduciendo errores y mejorando la mantenibilidad del código.

## ¿Por qué usar M3U8Builder?

### Problemas con la construcción manual

```typescript
// ❌ EVITAR: Construcción manual propensa a errores
let masterContent = '#EXTM3U\n#EXT-X-VERSION:3\n\n';
masterContent += '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",DEFAULT=YES,URI="english_subtitles.vtt"\n';
masterContent += '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Español",LANGUAGE="es",DEFAULT=NO,URI="spanish_subtitles.vtt"\n';
// Propenso a errores de sintaxis, caracteres especiales, etc.
```

### Ventajas de M3U8Builder

```typescript
// ✅ RECOMENDADO: Uso de M3U8Builder
import { M3U8Builder } from './src/lib/utils/m3u8-builder';

const builder = new M3U8Builder({ version: 3 })
  .addSubtitles({
    name: 'English',
    language: 'en',
    uri: 'english_subtitles.vtt',
    isDefault: true
  })
  .addSubtitles({
    name: 'Español',
    language: 'es',
    uri: 'spanish_subtitles.vtt',
    isDefault: false
  });

const playlist = builder.build();
```

## Características principales

- **Validación automática**: Verifica parámetros requeridos y formatos
- **Escape de caracteres**: Maneja automáticamente caracteres especiales
- **API fluida**: Permite encadenamiento de métodos
- **Tipado fuerte**: TypeScript proporciona autocompletado y verificación de tipos
- **Estadísticas**: Proporciona información sobre el playlist generado
- **Validación de playlists**: Puede validar playlists M3U8 existentes

## Uso básico

### 1. Importar la utilidad

```typescript
import { M3U8Builder, createM3U8Builder } from './src/lib/utils/m3u8-builder';
```

### 2. Crear un playlist maestro básico

```typescript
const builder = new M3U8Builder({ version: 3 });

// Agregar subtítulos
builder.addSubtitles({
  name: 'English',
  language: 'en',
  uri: 'subtitles_en.vtt',
  isDefault: true
});

// Agregar audio
builder.addAudio({
  name: 'Main Audio',
  language: 'en',
  uri: 'audio.m3u8',
  isDefault: true
});

// Agregar streams de video
builder.addStreamInfo({
  bandwidth: 800000,
  resolution: '1280x720',
  audio: 'audio',
  subtitles: 'subs',
  uri: 'stream_720p.m3u8'
});

// Generar el playlist
const playlist = builder.build();
```

### 3. Uso con encadenamiento de métodos

```typescript
const playlist = new M3U8Builder({ version: 3 })
  .addSubtitles({
    name: 'English',
    language: 'en',
    uri: 'subs_en.vtt',
    isDefault: true
  })
  .addAudio({
    name: 'Main Audio',
    uri: 'audio.m3u8',
    isDefault: true
  })
  .addStreamInfo({
    bandwidth: 1200000,
    resolution: '1920x1080',
    audio: 'audio',
    subtitles: 'subs',
    uri: 'stream_1080p.m3u8'
  })
  .build();
```

## Métodos principales

### `addSubtitles(options)`

Agrega pistas de subtítulos al playlist.

```typescript
builder.addSubtitles({
  name: 'Español',           // Nombre descriptivo
  language: 'es',           // Código de idioma ISO 639
  uri: 'subtitles_es.vtt',  // URI del archivo de subtítulos
  isDefault: false,         // Si es la pista por defecto
  autoSelect: true,         // Si se selecciona automáticamente
  groupId: 'subs'          // ID del grupo (opcional, por defecto 'subs')
});
```

### `addAudio(options)`

Agrega pistas de audio al playlist.

```typescript
builder.addAudio({
  name: 'Audio Principal',   // Nombre descriptivo
  language: 'es',           // Código de idioma
  uri: 'audio_es.m3u8',     // URI del playlist de audio
  isDefault: true,          // Si es la pista por defecto
  channels: '2',            // Número de canales
  groupId: 'audio'          // ID del grupo (opcional, por defecto 'audio')
});
```

### `addStreamInfo(options)`

Agrega información de streams de video.

```typescript
builder.addStreamInfo({
  bandwidth: 1200000,                    // Bandwidth en bits por segundo
  resolution: '1920x1080',              // Resolución WIDTHxHEIGHT
  codecs: 'avc1.640028,mp4a.40.2',     // Códecs utilizados
  frameRate: 30,                        // Frame rate (opcional)
  audio: 'audio',                       // Grupo de audio
  subtitles: 'subs',                    // Grupo de subtítulos
  uri: 'stream_1080p.m3u8'             // URI del playlist del stream
});
```

### `addMediaTrack(track)`

Método genérico para agregar cualquier tipo de pista de media.

```typescript
builder.addMediaTrack({
  type: 'AUDIO',              // 'AUDIO', 'VIDEO', 'SUBTITLES', 'CLOSED-CAPTIONS'
  groupId: 'audio',
  name: 'Audio Principal',
  language: 'es',
  isDefault: true,
  uri: 'audio.m3u8'
});
```

## Validación y manejo de errores

### Validación automática

M3U8Builder valida automáticamente los parámetros:

```typescript
try {
  builder.addStreamInfo({
    bandwidth: -1000,  // ❌ Error: bandwidth debe ser positivo
    resolution: 'invalid',  // ❌ Error: formato de resolución inválido
    uri: ''  // ❌ Error: URI no puede estar vacía
  });
} catch (error) {
  console.error('Error de validación:', error.message);
}
```

### Validación de playlists existentes

```typescript
import { validateM3U8Content } from './src/lib/utils/m3u8-builder';

const validation = validateM3U8Content(playlistContent);

if (!validation.isValid) {
  console.log('Errores encontrados:');
  validation.errors.forEach(error => console.log(`- ${error}`));
}

if (validation.warnings.length > 0) {
  console.log('Advertencias:');
  validation.warnings.forEach(warning => console.log(`- ${warning}`));
}
```

## Manejo de caracteres especiales

M3U8Builder maneja automáticamente el escape de caracteres especiales:

```typescript
builder.addSubtitles({
  name: 'Subtítulos en "Español" con caracteres especiales: áéíóú',
  language: 'es',
  uri: 'subtitles_special.vtt'
});

// Resultado:
// #EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Subtítulos en \"Español\" con caracteres especiales: áéíóú",LANGUAGE="es",URI="subtitles_special.vtt"
```

## Estadísticas del playlist

```typescript
const stats = builder.getStats();
console.log(`Pistas de audio: ${stats.audioTracks}`);
console.log(`Pistas de subtítulos: ${stats.subtitleTracks}`);
console.log(`Streams de video: ${stats.streamInfos}`);
console.log(`Total de pistas de media: ${stats.mediaTracks}`);
```

## Mejores prácticas

### 1. Usar validación de parámetros

```typescript
// ✅ Validar parámetros antes de usar
if (bandwidth > 0 && resolution.match(/^\d+x\d+$/)) {
  builder.addStreamInfo({ bandwidth, resolution, uri });
}
```

### 2. Ordenar streams por bandwidth

```typescript
// ✅ Agregar streams en orden ascendente de bandwidth
const qualities = [
  { bandwidth: 300000, resolution: '640x360', uri: 'stream_360p.m3u8' },
  { bandwidth: 600000, resolution: '854x480', uri: 'stream_480p.m3u8' },
  { bandwidth: 1000000, resolution: '1280x720', uri: 'stream_720p.m3u8' }
];

qualities.forEach(quality => {
  builder.addStreamInfo(quality);
});
```

### 3. Usar códigos de idioma estándar

```typescript
// ✅ Usar códigos ISO 639
builder.addSubtitles({
  name: 'English',
  language: 'en',  // ISO 639-1
  uri: 'subs_en.vtt'
});

builder.addSubtitles({
  name: 'Español (México)',
  language: 'es-MX',  // ISO 639-1 con región
  uri: 'subs_es_mx.vtt'
});
```

### 4. Manejar errores apropiadamente

```typescript
try {
  const playlist = builder.build();
  await fs.promises.writeFile('master.m3u8', playlist);
  console.log('Playlist generado exitosamente');
} catch (error) {
  console.error('Error al generar playlist:', error);
  // Manejar el error apropiadamente
}
```

### 5. Limpiar el builder para reutilización

```typescript
// Limpiar el builder para crear un nuevo playlist
builder.clear();

// Ahora se puede usar para crear un playlist diferente
builder.addAudio({ name: 'New Audio', uri: 'new_audio.m3u8' });
```

## Migración desde construcción manual

### Antes (construcción manual)

```typescript
let masterContent = '#EXTM3U\n#EXT-X-VERSION:3\n\n';
masterContent += '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",DEFAULT=YES,URI="english_subtitles.vtt"\n';
masterContent += '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Audio Principal",LANGUAGE="und",DEFAULT=YES,URI="audio.m3u8"\n';
masterContent += '\n';

for (const output of hlsOutputs) {
  const quality = qualityLevels.find(q => q.resolution.name === output.resolution);
  if (quality) {
    masterContent += `#EXT-X-STREAM-INF:BANDWIDTH=${quality.bandwidth},RESOLUTION=${quality.resolution.size},AUDIO="audio",SUBTITLES="subs"\n`;
    masterContent += `${playlistUrl}\n`;
  }
}

await fs.promises.writeFile(masterPlaylistPath, masterContent);
```

### Después (usando M3U8Builder)

```typescript
const builder = new M3U8Builder({ version: 3 })
  .addSubtitles({
    name: 'English',
    language: 'en',
    uri: 'english_subtitles.vtt',
    isDefault: true
  })
  .addAudio({
    name: 'Audio Principal',
    language: 'und',
    uri: 'audio.m3u8',
    isDefault: true
  });

for (const output of hlsOutputs) {
  const quality = qualityLevels.find(q => q.resolution.name === output.resolution);
  if (quality) {
    builder.addStreamInfo({
      bandwidth: quality.bandwidth,
      resolution: quality.resolution.size,
      audio: 'audio',
      subtitles: 'subs',
      uri: playlistUrl
    });
  }
}

const masterContent = builder.build();
await fs.promises.writeFile(masterPlaylistPath, masterContent);

// Mostrar estadísticas
const stats = builder.getStats();
console.log(`Playlist generado con ${stats.streamInfos} streams`);
```

## Conclusión

La utilidad M3U8Builder proporciona una forma robusta, segura y mantenible de crear playlists M3U8. Al usar esta herramienta en lugar de la construcción manual de strings, se reduce significativamente la posibilidad de errores y se mejora la legibilidad del código.

### Beneficios clave:

- ✅ **Seguridad**: Validación automática y escape de caracteres
- ✅ **Mantenibilidad**: Código más limpio y estructurado
- ✅ **Confiabilidad**: Menos propenso a errores de sintaxis
- ✅ **Productividad**: API intuitiva con autocompletado
- ✅ **Escalabilidad**: Fácil de extender y modificar

Para más ejemplos, consulta el archivo `examples/m3u8-builder-usage.ts`.