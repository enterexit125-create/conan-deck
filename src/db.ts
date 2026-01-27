import Dexie from "dexie";
import type { Table } from "dexie";
import { supabase, getUserId } from "./supabase";

export type Card = {
  id?: number;
  name: string;
  number?: string;
  color?: string;
  type?: string;
  memo?: string;
  image?: Blob;
  imageUrl?: string;
  updatedAt: number;
  userId?: string;
  synced?: boolean;
};

export type Deck = {
  id?: number;
  name: string;
  createdAt: number;
  userId?: string;
  synced?: boolean;
};

export type DeckCard = {
  id?: number;
  deckId: number;
  cardId: number;
  count: number;
  synced?: boolean;
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
    
    this.version(2).stores({
      cards: "++id, name, number, updatedAt, userId, synced",
      decks: "++id, name, createdAt, userId, synced",
      deckCards: "++id, deckId, cardId, [deckId+cardId], synced",
    }).upgrade(async (trans) => {
      await trans.table("cards").toCollection().modify(card => {
        card.synced = false;
        card.userId = getUserId();
      });
      await trans.table("decks").toCollection().modify(deck => {
        deck.synced = false;
        deck.userId = getUserId();
      });
      await trans.table("deckCards").toCollection().modify(dc => {
        dc.synced = false;
      });
    });
  }
}

export const db = new AppDB();

// ========================================
// Supabase同期機能
// ========================================

export async function syncFromSupabase() {
  const userId = getUserId();

  try {
    const { data: cardsData, error: cardsError } = await supabase
      .from("cards")
      .select("*")
      .eq("user_id", userId);

    if (cardsError) throw cardsError;

    const { data: decksData, error: decksError } = await supabase
      .from("decks")
      .select("*")
      .eq("user_id", userId);

    if (decksError) throw decksError;

    const { data: deckCardsData, error: deckCardsError } = await supabase
      .from("deck_cards")
      .select("*");

    if (deckCardsError) throw deckCardsError;

    if (cardsData && cardsData.length > 0) {
      await db.cards.clear();
      await db.cards.bulkAdd(
        cardsData.map((c: any) => ({
          id: c.id,
          name: c.name || "",
          number: c.number || undefined,
          color: c.color || undefined,
          type: c.type || undefined,
          memo: c.memo || undefined,
          imageUrl: c.image_url || undefined,
          updatedAt: c.updated_at ? new Date(c.updated_at).getTime() : Date.now(),
          userId: c.user_id || userId,
          synced: true,
        }))
      );
    }

    if (decksData && decksData.length > 0) {
      await db.decks.clear();
      await db.decks.bulkAdd(
        decksData.map((d: any) => ({
          id: d.id,
          name: d.name || "",
          createdAt: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
          userId: d.user_id || userId,
          synced: true,
        }))
      );
    }

    if (deckCardsData && deckCardsData.length > 0) {
      await db.deckCards.clear();
      await db.deckCards.bulkAdd(
        deckCardsData.map((dc: any) => ({
          id: dc.id,
          deckId: Number(dc.deck_id),
          cardId: Number(dc.card_id),
          count: Number(dc.count) || 1,
          synced: true,
        }))
      );
    }

    console.log("✅ Supabaseから同期完了");
    return { success: true };
  } catch (error) {
    console.error("❌ Supabase同期エラー:", error);
    return { success: false, error };
  }
}

export async function syncToSupabase() {
  const userId = getUserId();

  try {
    // 未同期のカードを取得（syncedがfalseまたは存在しない）
    const allCards = await db.cards.toArray();
    const unsyncedCards = allCards.filter(c => c.synced === false || c.synced === undefined);
    
    console.log(`📤 アップロード: ${unsyncedCards.length}枚のカード`);
    
    for (const card of unsyncedCards) {
      // 必須フィールドのチェック
      if (!card.name) {
        console.warn("⚠️ カード名が空のためスキップ:", card);
        continue;
      }

      const { data, error } = await supabase
        .from("cards")
        .insert({
          name: card.name,
          number: card.number || null,
          color: card.color || null,
          type: card.type || null,
          memo: card.memo || null,
          image_url: card.imageUrl || null,
          updated_at: new Date(card.updatedAt).toISOString(),
          user_id: userId,
        })
        .select()
        .single();

      if (error) {
        console.error("カード保存エラー:", error);
        throw error;
      }

      if (card.id && data) {
        await db.cards.update(card.id, { synced: true });
      }
    }

    // 未同期のデッキを取得
    const allDecks = await db.decks.toArray();
    const unsyncedDecks = allDecks.filter(d => d.synced === false || d.synced === undefined);
    
    console.log(`📤 アップロード: ${unsyncedDecks.length}個のデッキ`);
    
    for (const deck of unsyncedDecks) {
      if (!deck.name) {
        console.warn("⚠️ デッキ名が空のためスキップ:", deck);
        continue;
      }

      const { data, error } = await supabase
        .from("decks")
        .insert({
          name: deck.name,
          created_at: new Date(deck.createdAt).toISOString(),
          user_id: userId,
        })
        .select()
        .single();

      if (error) {
        console.error("デッキ保存エラー:", error);
        throw error;
      }

      if (deck.id && data) {
        await db.decks.update(deck.id, { synced: true });
      }
    }

    // 未同期のデッキカードを取得
    const allDeckCards = await db.deckCards.toArray();
    const unsyncedDeckCards = allDeckCards.filter(dc => dc.synced === false || dc.synced === undefined);
    
    console.log(`📤 アップロード: ${unsyncedDeckCards.length}個のデッキカード`);
    
    for (const dc of unsyncedDeckCards) {
      // データ型の検証
      if (!Number.isInteger(dc.deckId) || !Number.isInteger(dc.cardId)) {
        console.warn("⚠️ 無効なIDのためスキップ:", dc);
        continue;
      }

      const { data, error } = await supabase
        .from("deck_cards")
        .insert({
          deck_id: dc.deckId,
          card_id: dc.cardId,
          count: dc.count || 1,
        })
        .select()
        .single();

      if (error) {
        console.error("デッキカード保存エラー:", error);
        throw error;
      }

      if (dc.id && data) {
        await db.deckCards.update(dc.id, { synced: true });
      }
    }

    console.log("✅ Supabaseへの同期完了");
    return { success: true };
  } catch (error) {
    console.error("❌ Supabaseアップロードエラー:", error);
    return { success: false, error };
  }
}

export async function fullSync() {
  console.log("🔄 完全同期開始...");
  
  // まずアップロード（ローカルの変更を先に保存）
  const uploadResult = await syncToSupabase();
  if (!uploadResult.success) {
    console.error("アップロード失敗");
    return uploadResult;
  }

  // 次にダウンロード（最新データを取得）
  const downloadResult = await syncFromSupabase();
  
  if (downloadResult.success) {
    console.log("✅ 完全同期完了");
  }
  
  return downloadResult;
}
