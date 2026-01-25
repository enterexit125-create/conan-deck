import Dexie from "dexie";
import type { Table } from "dexie";


export type Card = {
  id?: number;
  name: string;
  number?: string;
  color?: string;
  type?: string;
  memo?: string;
  image?: Blob;   // ← 名前を image に統一
  updatedAt: number;
};


export type Deck = {
  id?: number;     // auto
  name: string;
  createdAt: number;
};

export type DeckCard = {
  id?: number;     // auto
  deckId: number;
  cardId: number;
  count: number;   // 1..3
};

class AppDB extends Dexie {
  cards!: Table<Card, number>;
  decks!: Table<Deck, number>;
  deckCards!: Table<DeckCard, number>;

  constructor() {
    super("conan_deck_db");
    this.version(1).stores({
      cards: "++id, name, number, updatedAt",
      decks: "++id, name, createdAt",
      deckCards: "++id, deckId, cardId, [deckId+cardId]",
    });
  }
}

export const db = new AppDB();

