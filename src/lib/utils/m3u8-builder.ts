/**
 * Utilidad para construir playlists M3U8 de manera segura y estructurada
 * Evita la concatenación manual de strings y proporciona validación
 */

export interface M3U8MediaTrack {
  type: 'AUDIO' | 'VIDEO' | 'SUBTITLES' | 'CLOSED-CAPTIONS';
  groupId: string;
  name: string;
  language?: string;
  isDefault?: boolean;
  autoSelect?: boolean;
  uri?: string;
  characteristics?: string;
  channels?: string;
}

export interface M3U8StreamInfo {
  bandwidth: number;
  resolution?: string;
  codecs?: string;
  frameRate?: number;
  audio?: string;
  video?: string;
  subtitles?: string;
  closedCaptions?: string;
  uri: string;
}

export interface M3U8PlaylistOptions {
  version?: number;
  targetDuration?: number;
  playlistType?: 'VOD' | 'EVENT';
  independentSegments?: boolean;
}

export class M3U8Builder {
  private version: number;
  private targetDuration?: number;
  private playlistType?: 'VOD' | 'EVENT';
  private independentSegments: boolean;
  private mediaTracks: M3U8MediaTrack[];
  private streamInfos: M3U8StreamInfo[];

  constructor(options: M3U8PlaylistOptions = {}) {
    this.version = options.version || 3;
    this.targetDuration = options.targetDuration;
    this.playlistType = options.playlistType;
    this.independentSegments = options.independentSegments || false;
    this.mediaTracks = [];
    this.streamInfos = [];
  }

  /**
   * Agregar una pista de media (audio, video, subtítulos)
   */
  addMediaTrack(track: M3U8MediaTrack): this {
    // Validar tipo de media primero
    const validTypes = ['AUDIO', 'VIDEO', 'SUBTITLES', 'CLOSED-CAPTIONS'];
    if (!track.type || !validTypes.includes(track.type)) {
      throw new Error(`Tipo de media inválido: ${track.type}. Debe ser uno de: ${validTypes.join(', ')}`);
    }

    // Validar otros parámetros requeridos
    if (!track.groupId || !track.name) {
      throw new Error('Los campos type, groupId y name son requeridos para una pista de media');
    }

    // Validar idioma si se proporciona
    if (track.language && !/^[a-z]{2,3}(-[A-Z]{2})?$/.test(track.language)) {
      console.warn(`Formato de idioma posiblemente inválido: ${track.language}. Se recomienda usar códigos ISO 639`);
    }

    this.mediaTracks.push({ ...track });
    return this;
  }

  /**
   * Agregar información de stream
   */
  addStreamInfo(streamInfo: M3U8StreamInfo): this {
    // Validar parámetros requeridos
    if (!streamInfo.bandwidth || !streamInfo.uri) {
      throw new Error('Los campos bandwidth y uri son requeridos para un stream');
    }

    // Validar bandwidth
    if (streamInfo.bandwidth <= 0) {
      throw new Error('El bandwidth debe ser un número positivo');
    }

    // Validar resolución si se proporciona
    if (streamInfo.resolution && !/^\d+x\d+$/.test(streamInfo.resolution)) {
      throw new Error(`Formato de resolución inválido: ${streamInfo.resolution}. Debe ser formato WIDTHxHEIGHT (ej: 1920x1080)`);
    }

    // Validar URI
    if (!streamInfo.uri.trim()) {
      throw new Error('La URI no puede estar vacía');
    }

    this.streamInfos.push({ ...streamInfo });
    return this;
  }

  /**
   * Agregar subtítulos de manera conveniente
   */
  addSubtitles(options: {
    groupId?: string;
    name: string;
    language: string;
    uri: string;
    isDefault?: boolean;
    autoSelect?: boolean;
  }): this {
    return this.addMediaTrack({
      type: 'SUBTITLES',
      groupId: options.groupId || 'subs',
      name: options.name,
      language: options.language,
      uri: options.uri,
      isDefault: options.isDefault,
      autoSelect: options.autoSelect
    });
  }

  /**
   * Agregar audio de manera conveniente
   */
  addAudio(options: {
    groupId?: string;
    name: string;
    language?: string;
    uri?: string;
    isDefault?: boolean;
    autoSelect?: boolean;
    channels?: string;
  }): this {
    return this.addMediaTrack({
      type: 'AUDIO',
      groupId: options.groupId || 'audio',
      name: options.name,
      language: options.language,
      uri: options.uri,
      isDefault: options.isDefault,
      autoSelect: options.autoSelect,
      channels: options.channels
    });
  }

  /**
   * Escapar valores para M3U8 (manejar caracteres especiales)
   */
  private escapeValue(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * Construir línea EXT-X-MEDIA
   */
  private buildMediaLine(track: M3U8MediaTrack): string {
    const attributes: string[] = [];
    
    attributes.push(`TYPE=${track.type}`);
    attributes.push(`GROUP-ID="${this.escapeValue(track.groupId)}"`);
    attributes.push(`NAME="${this.escapeValue(track.name)}"`);
    
    if (track.language) {
      attributes.push(`LANGUAGE="${this.escapeValue(track.language)}"`);
    }
    
    if (track.isDefault !== undefined) {
      attributes.push(`DEFAULT=${track.isDefault ? 'YES' : 'NO'}`);
    }
    
    if (track.autoSelect !== undefined) {
      attributes.push(`AUTOSELECT=${track.autoSelect ? 'YES' : 'NO'}`);
    }
    
    if (track.uri) {
      attributes.push(`URI="${this.escapeValue(track.uri)}"`);
    }
    
    if (track.characteristics) {
      attributes.push(`CHARACTERISTICS="${this.escapeValue(track.characteristics)}"`);
    }
    
    if (track.channels) {
      attributes.push(`CHANNELS="${this.escapeValue(track.channels)}"`);
    }
    
    return `#EXT-X-MEDIA:${attributes.join(',')}`;
  }

  /**
   * Construir línea EXT-X-STREAM-INF
   */
  private buildStreamLine(streamInfo: M3U8StreamInfo): string {
    const attributes: string[] = [];
    
    attributes.push(`BANDWIDTH=${streamInfo.bandwidth}`);
    
    if (streamInfo.resolution) {
      attributes.push(`RESOLUTION=${streamInfo.resolution}`);
    }
    
    if (streamInfo.codecs) {
      attributes.push(`CODECS="${this.escapeValue(streamInfo.codecs)}"`);
    }
    
    if (streamInfo.frameRate) {
      attributes.push(`FRAME-RATE=${streamInfo.frameRate}`);
    }
    
    if (streamInfo.audio) {
      attributes.push(`AUDIO="${this.escapeValue(streamInfo.audio)}"`);
    }
    
    if (streamInfo.video) {
      attributes.push(`VIDEO="${this.escapeValue(streamInfo.video)}"`);
    }
    
    if (streamInfo.subtitles) {
      attributes.push(`SUBTITLES="${this.escapeValue(streamInfo.subtitles)}"`);
    }
    
    if (streamInfo.closedCaptions) {
      attributes.push(`CLOSED-CAPTIONS="${this.escapeValue(streamInfo.closedCaptions)}"`);
    }
    
    return `#EXT-X-STREAM-INF:${attributes.join(',')}`;
  }

  /**
   * Construir el playlist M3U8 completo
   */
  build(): string {
    const lines: string[] = [];
    
    // Header obligatorio
    lines.push('#EXTM3U');
    lines.push(`#EXT-X-VERSION:${this.version}`);
    
    // Opciones adicionales
    if (this.targetDuration !== undefined) {
      lines.push(`#EXT-X-TARGETDURATION:${this.targetDuration}`);
    }
    
    if (this.playlistType) {
      lines.push(`#EXT-X-PLAYLIST-TYPE:${this.playlistType}`);
    }
    
    if (this.independentSegments) {
      lines.push('#EXT-X-INDEPENDENT-SEGMENTS');
    }
    
    // Línea vacía después del header
    if (this.mediaTracks.length > 0 || this.streamInfos.length > 0) {
      lines.push('');
    }
    
    // Agregar pistas de media
    this.mediaTracks.forEach(track => {
      lines.push(this.buildMediaLine(track));
    });
    
    // Línea vacía entre media tracks y streams si ambos existen
    if (this.mediaTracks.length > 0 && this.streamInfos.length > 0) {
      lines.push('');
    }
    
    // Agregar streams (ordenados por bandwidth)
    const sortedStreams = [...this.streamInfos].sort((a, b) => a.bandwidth - b.bandwidth);
    sortedStreams.forEach(streamInfo => {
      lines.push(this.buildStreamLine(streamInfo));
      lines.push(streamInfo.uri);
    });
    
    return lines.join('\n');
  }

  /**
   * Limpiar todas las pistas y streams
   */
  clear(): this {
    this.mediaTracks = [];
    this.streamInfos = [];
    return this;
  }

  /**
   * Obtener estadísticas del playlist
   */
  getStats(): {
    mediaTracks: number;
    streamInfos: number;
    audioTracks: number;
    subtitleTracks: number;
    videoTracks: number;
  } {
    return {
      mediaTracks: this.mediaTracks.length,
      streamInfos: this.streamInfos.length,
      audioTracks: this.mediaTracks.filter(t => t.type === 'AUDIO').length,
      subtitleTracks: this.mediaTracks.filter(t => t.type === 'SUBTITLES').length,
      videoTracks: this.mediaTracks.filter(t => t.type === 'VIDEO').length
    };
  }
}

/**
 * Función de conveniencia para crear un builder M3U8
 */
export function createM3U8Builder(options?: M3U8PlaylistOptions): M3U8Builder {
  return new M3U8Builder(options);
}

/**
 * Validar un playlist M3U8 existente
 */
export function validateM3U8Content(content: string): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lines = content.split('\n');
  
  // Verificar header obligatorio
  if (lines[0] !== '#EXTM3U') {
    errors.push('El playlist debe comenzar con #EXTM3U');
  }
  
  // Verificar versión
  const versionLine = lines.find(line => line.startsWith('#EXT-X-VERSION:'));
  if (!versionLine) {
    warnings.push('Se recomienda especificar la versión con #EXT-X-VERSION');
  }
  
  // Verificar estructura básica
  let hasStreams = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      hasStreams = true;
      // Verificar que la siguiente línea sea una URI
      if (i + 1 >= lines.length || lines[i + 1].startsWith('#')) {
        errors.push(`Línea ${i + 2}: #EXT-X-STREAM-INF debe ser seguida por una URI`);
      }
    }
  }
  
  if (!hasStreams) {
    warnings.push('El playlist no contiene streams de video');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}