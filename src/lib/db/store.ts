import type { TableName, Tables } from "./types";

export type Row<T extends TableName> = Tables[T];
export type Filter<T extends TableName> = Partial<{ [K in keyof Row<T>]: Row<T>[K] }>;
export type NewRow<T extends TableName> = Partial<Row<T>>;

export class DbError extends Error {
  constructor(
    public code: "unique" | "reference" | "check" | "not_found" | "forbidden" | "unknown",
    message: string,
  ) {
    super(message);
  }
}

export interface FileStore {
  upload(path: string, bytes: Uint8Array, mime: string): Promise<void>;
  download(path: string): Promise<{ bytes: Uint8Array; mime: string } | null>;
  remove(path: string): Promise<void>;
}

/**
 * Jednotné rozhraní k datům – implementace pro Supabase (RLS)
 * a pro lokální vývojový režim (soubor JSON).
 */
export interface Store {
  readonly mode: "supabase" | "local";
  select<T extends TableName>(table: T, filter?: Filter<T>): Promise<Row<T>[]>;
  insert<T extends TableName>(table: T, rows: NewRow<T>[]): Promise<Row<T>[]>;
  update<T extends TableName>(table: T, filter: Filter<T> & { id?: string }, patch: NewRow<T>): Promise<Row<T>[]>;
  remove<T extends TableName>(table: T, filter: Filter<T>): Promise<number>;
  acceptInvite(code: string, memberName?: string | null): Promise<string>;
  /** Zajistí, že přihlášený uživatel má v domácnosti svého člena (vrací jeho id). */
  ensureOwnMember(householdId: string, memberName?: string | null): Promise<string>;
  /** Má domácnost Premium (kterýkoli člen s aktivním předplatným, nebo ukázková domácnost)? */
  householdPremium(householdId: string): Promise<boolean>;
  /** Má přihlášený uživatel aktivní Premium? */
  userPremium(): Promise<boolean>;
  /** Započítá dotaz na AI v tomto měsíci a vrátí nový počet. */
  bumpAiUsage(): Promise<number>;
  files: FileStore;
}
