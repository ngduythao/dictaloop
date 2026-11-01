import Dexie, { type EntityTable } from 'dexie';
import type { Attempt, Lesson, Playlist, Session } from './model';

// Everything lives in this browser on this device; there is no account or server.

type StoredBlob = { path: string; blob: Blob };

class DictaloopDatabase extends Dexie {
  playlists!: EntityTable<Playlist, 'id'>;
  lessons!: EntityTable<Lesson, 'id'>;
  attempts!: EntityTable<Attempt, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  blobs!: EntityTable<StoredBlob, 'path'>;

  constructor() {
    super('dictaloop');
    this.version(1).stores({
      playlists: 'id, createdAt',
      lessons: 'id, playlistId, [playlistId+order], lastOpenedAt',
      attempts: '++id, lessonId, at, [lessonId+sentenceIndex]',
      sessions: '++id, lessonId, startedAt',
      blobs: 'path',
    });
  }
}

export const db = new DictaloopDatabase();
