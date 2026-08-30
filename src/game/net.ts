// Сетевой мультиплеер без сервера: WebRTC DataChannel (PeerJS).
// Хост создаёт комнату и получает код, гость подключается по коду.

import Peer from "peerjs";
import type { DataConnection } from "peerjs";

export type NetRole = "host" | "guest";

const PREFIX = "kbg-rebirth-v1-";

export function randomCode(len = 4): string {
  const abc = "ABCDEFGHKMNPRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

export interface NetCallbacks {
  onRoomReady?: (code: string) => void; // хост: комната создана
  onConnected: () => void; // соединение установлено (обе стороны)
  onData: (msg: NetMsg) => void;
  onClose: (reason: string) => void;
  onError: (text: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NetMsg = any;

export class NetLink {
  role: NetRole;
  code = "";
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private cb: NetCallbacks;
  private opened = false;
  private closed = false;
  private queue: NetMsg[] = [];

  constructor(role: NetRole, cb: NetCallbacks) {
    this.role = role;
    this.cb = cb;
  }

  host() {
    this.code = randomCode();
    const peer = new Peer(PREFIX + this.code);
    this.peer = peer;
    peer.on("open", () => this.cb.onRoomReady?.(this.code));
    peer.on("connection", (conn) => this.wire(conn));
    peer.on("error", (err) => this.onError(err));
  }

  join(code: string) {
    this.code = code.trim().toUpperCase();
    if (this.code.length < 4) {
      this.cb.onError("Код комнаты слишком короткий");
      return;
    }
    const peer = new Peer();
    this.peer = peer;
    peer.on("open", () => {
      const conn = peer.connect(PREFIX + this.code, { reliable: true });
      this.wire(conn);
    });
    peer.on("error", (err) => this.onError(err));
  }

  private wire(conn: DataConnection) {
    if (this.closed) return;
    this.conn = conn;
    conn.on("open", () => {
      this.opened = true;
      this.cb.onConnected();
      for (const m of this.queue) conn.send(m);
      this.queue = [];
    });
    conn.on("data", (data) => {
      try {
        this.cb.onData(data as NetMsg);
      } catch {
        /* noop */
      }
    });
    conn.on("close", () => {
      if (!this.closed) {
        this.closed = true;
        this.cb.onClose(this.role === "host" ? "Гость покинул комнату" : "Хост закрыл комнату");
      }
    });
    conn.on("error", () => {
      if (!this.closed) {
        this.closed = true;
        this.cb.onClose("Соединение разорвано");
      }
    });
  }

  private onError(err: unknown) {
    const e = err as { type?: string };
    if (e?.type === "peer-unavailable") {
      this.cb.onError("Комната не найдена — проверьте код");
    } else if (e?.type === "unavailable-id") {
      this.cb.onError("Код уже занят, попробуйте создать комнату снова");
    } else if (!this.opened && e?.type === "network") {
      this.cb.onError("Нет связи с сервером знакомств — проверьте интернет и попробуйте снова");
    }
  }

  send(msg: NetMsg) {
    if (this.closed) return;
    if (this.opened && this.conn) this.conn.send(msg);
    else this.queue.push(msg);
  }

  // переназначение обработчика входящих сообщений (после подключения движка)
  setDataHandler(fn: (msg: NetMsg) => void) {
    this.cb.onData = fn;
  }

  setCloseHandler(fn: (reason: string) => void) {
    this.cb.onClose = fn;
  }

  close() {
    this.closed = true;
    try {
      this.conn?.close();
      this.peer?.destroy();
    } catch {
      /* noop */
    }
  }
}
