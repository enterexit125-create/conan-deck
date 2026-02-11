// db.tsから再エクスポート
export type { Card, Deck, DeckCard } from '../db';

// タブの種類
export type TabType = "cards" | "decks" | "play" | "sync";

// カードの場所
export type CardLocation = "hand" | "field" | "remove" | "evidence";

// 選択中のカード情報
export interface SelectedCardInfo {
  card: Card;
  index: number;
  location: CardLocation;
}

// カラーマップの型
export type ColorMap = {
  [key: string]: string;
};
