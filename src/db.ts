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
// 画像アップロード機能
// ========================================

/**
 * 画像をSupabase Storageにアップロード
 */
export async function uploadImage(blob: Blob, cardId: number): Promise<string | null> {
  try {
    const fileName = `${getUserId()}/card_${cardId}_${Date.now()}.${blob.type.split('/')[1]}`;
    
    const { error } = await supabase.storage
      .from('card-images')
      .upload(fileName, blob, {
        contentType: blob.type,
        upsert: true
      });

    if (error) {
      console.error("画像アップロードエラー:", error);
      return null;
    }

    // 公開URLを取得
    const { data: urlData } = supabase.storage
      .from('card-images')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error("画像アップロード失敗:", error);
    return null;
  }
}

/**
 * 画像URLから画像をダウンロード
 */
export async function downloadImage(url: string): Promise<Blob | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.blob();
  } catch (error) {
    console.error("画像ダウンロード失敗:", error);
    return null;
  }
}

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

    // カードを同期（重複を避ける）
    if (cardsData && cardsData.length > 0) {
      for (const c of cardsData) {
        let imageBlob: Blob | undefined = undefined;
        
        if (c.image_url) {
          const blob = await downloadImage(c.image_url);
          if (blob) imageBlob = blob;
        }
        
        // ローカルに既に同じIDのカードがあるかチェック
        const existingLocal = await db.cards.get(c.id);
        
        if (existingLocal) {
          // 既存カードを更新（IDを保持）
          await db.cards.update(c.id, {
            name: c.name || "",
            number: c.number || undefined,
            color: c.color || undefined,
            type: c.type || undefined,
            memo: c.memo || undefined,
            image: imageBlob,
            imageUrl: c.image_url || undefined,
            updatedAt: c.updated_at ? new Date(c.updated_at).getTime() : Date.now(),
            userId: c.user_id || userId,
            synced: true,
          });
        } else {
          // 新規カードを追加（IDを明示的に指定）
          await db.cards.add({
            id: c.id,
            name: c.name || "",
            number: c.number || undefined,
            color: c.color || undefined,
            type: c.type || undefined,
            memo: c.memo || undefined,
            image: imageBlob,
            imageUrl: c.image_url || undefined,
            updatedAt: c.updated_at ? new Date(c.updated_at).getTime() : Date.now(),
            userId: c.user_id || userId,
            synced: true,
          });
        }
      }
    }

    // デッキを同期
    if (decksData && decksData.length > 0) {
      for (const d of decksData) {
        const existingLocal = await db.decks.get(d.id);
        
        if (existingLocal) {
          await db.decks.update(d.id, {
            name: d.name || "",
            createdAt: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
            userId: d.user_id || userId,
            synced: true,
          });
        } else {
          await db.decks.add({
            id: d.id,
            name: d.name || "",
            createdAt: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
            userId: d.user_id || userId,
            synced: true,
          });
        }
      }
    }

    // デッキカードを同期
    if (deckCardsData && deckCardsData.length > 0) {
      for (const dc of deckCardsData) {
        const existingLocal = await db.deckCards.get(dc.id);
        
        if (existingLocal) {
          await db.deckCards.update(dc.id, {
            deckId: Number(dc.deck_id),
            cardId: Number(dc.card_id),
            count: Number(dc.count) || 1,
            synced: true,
          });
        } else {
          await db.deckCards.add({
            id: dc.id,
            deckId: Number(dc.deck_id),
            cardId: Number(dc.card_id),
            count: Number(dc.count) || 1,
            synced: true,
          });
        }
      }
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
    // ========================================
    // 1. まずデッキをアップロード（外部キー制約のため）
    // ========================================
    const allDecks = await db.decks.toArray();
    const unsyncedDecks = allDecks.filter(d => d.synced === false || d.synced === undefined);
    
    console.log(`📤 アップロード: ${unsyncedDecks.length}個のデッキ`);
    
    for (const deck of unsyncedDecks) {
      if (!deck.name) {
        console.warn("⚠️ デッキ名が空のためスキップ:", deck);
        continue;
      }

      // Supabaseに同じIDが存在するかチェック
      const { data: existingDeck, error: checkError } = await supabase
        .from("decks")
        .select("id")
        .eq("id", deck.id)
        .eq("user_id", userId)
        .single();

      // チェックエラーを処理（PGRST116 = 結果なし は正常）
      if (checkError && checkError.code !== 'PGRST116') {
        console.error("デッキチェックエラー:", checkError);
        throw checkError;
      }

      if (existingDeck) {
        // 既存デッキを更新
        console.log(`🔄 デッキ更新: ${deck.name} (ID: ${deck.id})`);
        const { error } = await supabase
          .from("decks")
          .update({
            name: deck.name,
            created_at: new Date(deck.createdAt).toISOString(),
          })
          .eq("id", deck.id)
          .eq("user_id", userId);

        if (error) {
          console.error("デッキ更新エラー:", error);
          throw error;
        }

        if (deck.id) {
          await db.decks.update(deck.id, { synced: true });
        }
      } else {
        // 新規デッキを挿入
        console.log(`➕ デッキ追加: ${deck.name}`);
        
        const { data, error } = await supabase
          .from("decks")
          .insert({
            id: deck.id, // IDを明示的に指定
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
    }

    // ========================================
    // 2. 次にカードをアップロード
    // ========================================
    const allCards = await db.cards.toArray();
    const unsyncedCards = allCards.filter(c => c.synced === false || c.synced === undefined);
    
    console.log(`📤 アップロード: ${unsyncedCards.length}枚のカード`);
    
    for (const card of unsyncedCards) {
      if (!card.name) {
        console.warn("⚠️ カード名が空のためスキップ:", card);
        continue;
      }

      let imageUrl: string | null = null;
      
      // 画像があればアップロード
      if (card.image && card.id) {
        console.log(`📸 画像アップロード中: ${card.name}`);
        imageUrl = await uploadImage(card.image, card.id);
        if (imageUrl) {
          console.log(`✅ 画像アップロード成功: ${imageUrl}`);
        }
      }

      // Supabaseに同じIDが存在するかチェック
      const { data: existingCard } = await supabase
        .from("cards")
        .select("id")
        .eq("id", card.id)
        .eq("user_id", userId)
        .single();

      if (existingCard) {
        // 既存カードを更新
        console.log(`🔄 カード更新: ${card.name} (ID: ${card.id})`);
        const { error } = await supabase
          .from("cards")
          .update({
            name: card.name,
            number: card.number || null,
            color: card.color || null,
            type: card.type || null,
            memo: card.memo || null,
            image_url: imageUrl || card.imageUrl || null,
            updated_at: new Date(card.updatedAt).toISOString(),
          })
          .eq("id", card.id)
          .eq("user_id", userId);

        if (error) {
          console.error("カード更新エラー:", error);
          throw error;
        }

        if (card.id) {
          await db.cards.update(card.id, { synced: true, imageUrl: imageUrl || card.imageUrl });
        }
      } else {
        // 新規カードを挿入
        console.log(`➕ カード追加: ${card.name}`);
        const { data, error } = await supabase
          .from("cards")
          .insert({
            name: card.name,
            number: card.number || null,
            color: card.color || null,
            type: card.type || null,
            memo: card.memo || null,
            image_url: imageUrl || card.imageUrl || null,
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
          await db.cards.update(card.id, { synced: true, imageUrl: imageUrl || undefined });
        }
      }
    }

    // ========================================
    // 3. 最後にデッキカードをアップロード
    // ========================================
    const allDeckCards = await db.deckCards.toArray();
    const unsyncedDeckCards = allDeckCards.filter(dc => dc.synced === false || dc.synced === undefined);
    
    console.log(`📤 アップロード: ${unsyncedDeckCards.length}個のデッキカード`);
    
    for (const dc of unsyncedDeckCards) {
      if (!Number.isInteger(dc.deckId) || !Number.isInteger(dc.cardId)) {
        console.warn("⚠️ 無効なIDのためスキップ:", dc);
        continue;
      }

      // Supabaseに同じIDが存在するかチェック
      const { data: existingDeckCard } = await supabase
        .from("deck_cards")
        .select("id")
        .eq("id", dc.id)
        .single();

      if (existingDeckCard) {
        // 既存デッキカードを更新
        console.log(`🔄 デッキカード更新: Deck${dc.deckId}-Card${dc.cardId} (ID: ${dc.id})`);
        const { error } = await supabase
          .from("deck_cards")
          .update({
            deck_id: dc.deckId,
            card_id: dc.cardId,
            count: dc.count || 1,
          })
          .eq("id", dc.id);

        if (error) {
          console.error("デッキカード更新エラー:", error);
          throw error;
        }

        if (dc.id) {
          await db.deckCards.update(dc.id, { synced: true });
        }
      } else {
        // 新規デッキカードを挿入
        console.log(`➕ デッキカード追加: Deck${dc.deckId}-Card${dc.cardId}`);
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
  
  // まずアップロード
  const uploadResult = await syncToSupabase();
  if (!uploadResult.success) {
    console.error("アップロード失敗");
    return uploadResult;
  }

  // 次にダウンロード
  const downloadResult = await syncFromSupabase();
  
  if (downloadResult.success) {
    console.log("✅ 完全同期完了");
  }
  
  return downloadResult;
}
