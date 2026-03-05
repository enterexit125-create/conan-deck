import Dexie from "dexie";
import type { Table } from "dexie";
import { supabase, getUserId } from "./supabase";

export type Card = {
  id?: number;
  name: string;
  number?: string;
  color?: string;
  type?: string;
  level?: number;
  traits?: string;
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

    const { data: urlData } = supabase.storage
      .from('card-images')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error("画像アップロード失敗:", error);
    return null;
  }
}

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
// Supabase同期機能（画像最適化版）
// ========================================

export async function syncFromSupabase() {
  const userId = getUserId();

  try {
    console.log("⬇️ クラウドからデータを取得中...");

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

    // カードを同期（★画像最適化版）
    if (cardsData && cardsData.length > 0) {
      let skippedImages = 0;
      let downloadedImages = 0;
      const totalCards = cardsData.length;

      console.log(`📥 カード同期中... (${totalCards}枚)`);

      for (let i = 0; i < cardsData.length; i++) {
        const c = cardsData[i];
        
        // 進捗表示（10枚ごと）
        if ((i + 1) % 10 === 0 || i === totalCards - 1) {
          console.log(`  ${i + 1}/${totalCards}枚処理中...`);
        }

        // ローカルに既に同じIDのカードがあるかチェック
        const existingLocal = await db.cards.get(c.id);
        
        let imageBlob: Blob | undefined = undefined;
        
        if (c.image_url) {
          // ★ 画像最適化: ローカルに画像があればスキップ
          if (existingLocal?.image) {
            imageBlob = existingLocal.image;
            skippedImages++;
          } else {
            const blob = await downloadImage(c.image_url);
            if (blob) {
              imageBlob = blob;
              downloadedImages++;
            }
          }
        }
        
        if (existingLocal) {
          await db.cards.update(c.id, {
            name: c.name || "",
            number: c.number || undefined,
            color: c.color || undefined,
            type: c.type || undefined,
            level: c.level || undefined,
            traits: c.traits || undefined,
            memo: c.memo || undefined,
            image: imageBlob,
            imageUrl: c.image_url || undefined,
            updatedAt: c.updated_at ? new Date(c.updated_at).getTime() : Date.now(),
            userId: c.user_id || userId,
            synced: true,
          });
        } else {
          await db.cards.add({
            id: c.id,
            name: c.name || "",
            number: c.number || undefined,
            color: c.color || undefined,
            type: c.type || undefined,
            level: c.level || undefined,
            traits: c.traits || undefined,
            memo: c.memo || undefined,
            image: imageBlob,
            imageUrl: c.image_url || undefined,
            updatedAt: c.updated_at ? new Date(c.updated_at).getTime() : Date.now(),
            userId: c.user_id || userId,
            synced: true,
          });
        }
      }

      console.log(`📊 画像: ${downloadedImages}枚ダウンロード, ${skippedImages}枚スキップ`);
    }

    // デッキを同期
    if (decksData && decksData.length > 0) {
      console.log(`📥 デッキ同期中... (${decksData.length}個)`);
      
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
      console.log(`📥 デッキカード同期中... (${deckCardsData.length}個)`);
      
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
    // 1. デッキをアップロード
    // ========================================
    const allDecks = await db.decks.toArray();
    const unsyncedDecks = allDecks.filter(d => d.synced === false || d.synced === undefined);
    
    console.log(`📤 デッキアップロード: ${unsyncedDecks.length}個`);
    
    const decksToUpdate: number[] = [];
    const decksToInsert: any[] = [];
    
    for (const deck of unsyncedDecks) {
      if (!deck.name) continue;

      const { data: existingDeck, error: checkError } = await supabase
        .from("decks")
        .select("id")
        .eq("id", deck.id)
        .eq("user_id", userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      const deckData = {
        id: deck.id,
        name: deck.name,
        created_at: new Date(deck.createdAt).toISOString(),
        user_id: userId,
      };

      if (existingDeck) {
        decksToUpdate.push(deck.id!);
      } else {
        decksToInsert.push(deckData);
      }
    }

    for (const deckId of decksToUpdate) {
      const deck = unsyncedDecks.find(d => d.id === deckId);
      if (!deck) continue;
      
      await supabase
        .from("decks")
        .update({
          name: deck.name,
          created_at: new Date(deck.createdAt).toISOString(),
        })
        .eq("id", deckId)
        .eq("user_id", userId);
      
      await db.decks.update(deckId, { synced: true });
    }

    if (decksToInsert.length > 0) {
      await supabase.from("decks").insert(decksToInsert);
      for (const deck of decksToInsert) {
        await db.decks.update(deck.id, { synced: true });
      }
    }

    // ========================================
    // 2. カードをアップロード
    // ========================================
    const allCards = await db.cards.toArray();
    const unsyncedCards = allCards.filter(c => c.synced === false || c.synced === undefined);
    
    console.log(`📤 カードアップロード: ${unsyncedCards.length}枚`);
    
    // ★ 画像アップロード（既にURLがあればスキップ）
    const cardsNeedingImageUpload = unsyncedCards.filter(c => c.image && c.id && !c.imageUrl);
    console.log(`📤 画像アップロード: ${cardsNeedingImageUpload.length}枚`);
    
    const imageUrlMap = new Map<number, string>();
    
    for (const card of cardsNeedingImageUpload) {
      const imageUrl = await uploadImage(card.image!, card.id!);
      if (imageUrl) {
        imageUrlMap.set(card.id!, imageUrl);
      }
    }

    const cardsToUpdate: any[] = [];
    const cardsToInsert: any[] = [];
    
    for (const card of unsyncedCards) {
      if (!card.name) continue;

      const imageUrl = imageUrlMap.get(card.id!) || card.imageUrl || null;

      const { data: existingCard, error: checkError } = await supabase
        .from("cards")
        .select("id")
        .eq("id", card.id)
        .eq("user_id", userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      const cardData = {
        id: card.id,
        name: card.name,
        number: card.number || null,
        color: card.color || null,
        type: card.type || null,
        level: card.level || null,
        traits: card.traits || null,
        memo: card.memo || null,
        image_url: imageUrl,
        updated_at: new Date(card.updatedAt).toISOString(),
        user_id: userId,
      };

      if (existingCard) {
        cardsToUpdate.push({ ...cardData, _id: card.id });
      } else {
        cardsToInsert.push(cardData);
      }
    }

    for (const card of cardsToUpdate) {
      await supabase
        .from("cards")
        .update({
          name: card.name,
          number: card.number,
          color: card.color,
          type: card.type,
          level: card.level,
          traits: card.traits,
          memo: card.memo,
          image_url: card.image_url,
          updated_at: card.updated_at,
        })
        .eq("id", card._id)
        .eq("user_id", userId);
      
      await db.cards.update(card._id, { synced: true, imageUrl: card.image_url });
    }

    const BATCH_SIZE = 50;
    for (let i = 0; i < cardsToInsert.length; i += BATCH_SIZE) {
      const batch = cardsToInsert.slice(i, i + BATCH_SIZE);
      await supabase.from("cards").insert(batch);
      
      for (const card of batch) {
        await db.cards.update(card.id, { synced: true, imageUrl: card.image_url });
      }
    }

    // ========================================
    // 3. デッキカードをアップロード
    // ========================================
    const allDeckCards = await db.deckCards.toArray();
    const unsyncedDeckCards = allDeckCards.filter(dc => dc.synced === false || dc.synced === undefined);
    
    console.log(`📤 デッキカードアップロード: ${unsyncedDeckCards.length}個`);
    
    const deckCardsToUpdate: any[] = [];
    const deckCardsToInsert: any[] = [];
    
    for (const dc of unsyncedDeckCards) {
      if (!Number.isInteger(dc.deckId) || !Number.isInteger(dc.cardId)) continue;

      const { data: existingDeckCard, error: checkError } = await supabase
        .from("deck_cards")
        .select("id")
        .eq("id", dc.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      const deckCardData = {
        id: dc.id,
        deck_id: dc.deckId,
        card_id: dc.cardId,
        count: dc.count || 1,
      };

      if (existingDeckCard) {
        deckCardsToUpdate.push({ ...deckCardData, _id: dc.id });
      } else {
        deckCardsToInsert.push(deckCardData);
      }
    }

    for (const dc of deckCardsToUpdate) {
      await supabase
        .from("deck_cards")
        .update({
          deck_id: dc.deck_id,
          card_id: dc.card_id,
          count: dc.count,
        })
        .eq("id", dc._id);
      
      await db.deckCards.update(dc._id, { synced: true });
    }

    if (deckCardsToInsert.length > 0) {
      for (let i = 0; i < deckCardsToInsert.length; i += BATCH_SIZE) {
        const batch = deckCardsToInsert.slice(i, i + BATCH_SIZE);
        await supabase.from("deck_cards").insert(batch);
        
        for (const dc of batch) {
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
  
  const uploadResult = await syncToSupabase();
  if (!uploadResult.success) {
    console.error("アップロード失敗");
    return uploadResult;
  }

  const downloadResult = await syncFromSupabase();
  
  if (downloadResult.success) {
    console.log("✅ 完全同期完了");
  }
  
  return downloadResult;
}
