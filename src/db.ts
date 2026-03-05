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
// 並列処理ユーティリティ
// ========================================

/**
 * 並列数を制限しながら非同期タスクを並行処理する
 */
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
}

// ========================================
// Supabase同期機能（スマホ最適化版）
// ========================================

export type SyncProgress = {
  phase: string;
  current: number;
  total: number;
  message: string;
};

export async function syncFromSupabase(
  onProgress?: (p: SyncProgress) => void
) {
  const userId = getUserId();

  const report = (phase: string, current: number, total: number, message: string) => {
    console.log(`[${phase}] ${current}/${total} ${message}`);
    onProgress?.({ phase, current, total, message });
  };

  try {
    report("fetch", 0, 1, "クラウドからデータを取得中...");

    // ページネーションで全件取得するヘルパー
    async function fetchAll(table: string, filters: Record<string, string> = {}) {
      const PAGE_SIZE = 1000;
      let from = 0;
      const allData: any[] = [];
      while (true) {
        let query = (supabase.from(table) as any).select("*").range(from, from + PAGE_SIZE - 1);
        for (const [key, value] of Object.entries(filters)) {
          query = query.eq(key, value);
        }
        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return allData;
    }

    const cardsData = await fetchAll("cards", { user_id: userId });
    const decksData = await fetchAll("decks", { user_id: userId });

    // deck_cardsは自分のデッキIDで絞り込みページネーション
    const myDeckIds = decksData.map((d: any) => String(d.id));
    const deckCardsData: any[] = [];
    if (myDeckIds.length > 0) {
      const PAGE_SIZE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("deck_cards")
          .select("*")
          .in("deck_id", myDeckIds)
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        deckCardsData.push(...data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
    }

    // ========================================
    // デッキをバッチ同期
    // ========================================
    if (decksData.length > 0) {
      report("decks", 0, decksData.length, `デッキ同期中... (${decksData.length}個)`);
      const localDeckIds = new Set((await db.decks.toArray()).map(d => d.id));
      const toAdd: Deck[] = [];
      const toUpdate: [number, Partial<Deck>][] = [];

      for (const d of decksData) {
        const record: Deck = {
          id: d.id,
          name: d.name || "",
          createdAt: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
          userId: d.user_id || userId,
          synced: true,
        };
        if (localDeckIds.has(d.id)) {
          toUpdate.push([d.id, record]);
        } else {
          toAdd.push(record);
        }
      }

      if (toAdd.length > 0) await db.decks.bulkAdd(toAdd);
      for (const [id, record] of toUpdate) {
        await db.decks.update(id, record);
      }
      report("decks", decksData.length, decksData.length, "デッキ完了");
    }

    // ========================================
    // デッキカードをバッチ同期
    // ========================================
    if (deckCardsData.length > 0) {
      report("deckCards", 0, deckCardsData.length, `デッキカード同期中... (${deckCardsData.length}個)`);
      const localDeckCardIds = new Set((await db.deckCards.toArray()).map(dc => dc.id));
      const toAdd: DeckCard[] = [];
      const toUpdate: [number, Partial<DeckCard>][] = [];

      for (const dc of deckCardsData) {
        const record: DeckCard = {
          id: dc.id,
          deckId: Number(dc.deck_id),
          cardId: Number(dc.card_id),
          count: Number(dc.count) || 1,
          synced: true,
        };
        if (localDeckCardIds.has(dc.id)) {
          toUpdate.push([dc.id, record]);
        } else {
          toAdd.push(record);
        }
      }

      if (toAdd.length > 0) await db.deckCards.bulkAdd(toAdd);
      for (const [id, record] of toUpdate) {
        await db.deckCards.update(id, record);
      }
      report("deckCards", deckCardsData.length, deckCardsData.length, "デッキカード完了");
    }

    // ========================================
    // カード: まずメタデータだけ一括書き込み（画像なし）
    // ========================================
    if (cardsData.length > 0) {
      const totalCards = cardsData.length;
      report("cards-meta", 0, totalCards, `カード情報を保存中... (${totalCards}枚)`);

      // ローカルのカードIDと画像の有無を一度に取得
      const localCards = await db.cards.toArray();
      const localCardMap = new Map(localCards.map(c => [c.id!, c]));

      const toAdd: Card[] = [];
      const toUpdate: [number, Partial<Card>][] = [];

      for (const c of cardsData) {
        const existing = localCardMap.get(c.id);
        const record: Card = {
          id: c.id,
          name: c.name || "",
          number: c.number || undefined,
          color: c.color || undefined,
          type: c.type || undefined,
          level: c.level || undefined,
          traits: c.traits || undefined,
          memo: c.memo || undefined,
          // 画像はこの段階ではローカルにあるものを保持するだけ
          image: existing?.image,
          imageUrl: c.image_url || undefined,
          updatedAt: c.updated_at ? new Date(c.updated_at).getTime() : Date.now(),
          userId: c.user_id || userId,
          synced: true,
        };
        if (existing) {
          toUpdate.push([c.id, record]);
        } else {
          toAdd.push(record);
        }
      }

      // バッチ書き込み（一括なのでスマホでも高速）
      const WRITE_BATCH = 200;
      let written = 0;
      for (let i = 0; i < toAdd.length; i += WRITE_BATCH) {
        await db.cards.bulkAdd(toAdd.slice(i, i + WRITE_BATCH));
        written += Math.min(WRITE_BATCH, toAdd.length - i);
        report("cards-meta", written, totalCards, `カード情報保存中... (${written}/${totalCards})`);
      }
      for (let i = 0; i < toUpdate.length; i += WRITE_BATCH) {
        const batch = toUpdate.slice(i, i + WRITE_BATCH);
        await db.transaction("rw", db.cards, async () => {
          for (const [id, record] of batch) {
            await db.cards.update(id, record);
          }
        });
        written += Math.min(WRITE_BATCH, toUpdate.length - i);
        report("cards-meta", written, totalCards, `カード情報保存中... (${written}/${totalCards})`);
      }

      report("cards-meta", totalCards, totalCards, "カード情報完了 — 画像をダウンロード中...");

      // ========================================
      // 画像: ローカルに未取得のものだけ並列ダウンロード
      // ========================================
      const needsImage = cardsData.filter((c: any) => {
        if (!c.image_url) return false;
        const local = localCardMap.get(c.id);
        // ローカルに画像があればスキップ
        return !local?.image;
      });

      const totalImages = needsImage.length;
      let downloadedImages = 0;
      let failedImages = 0;

      report("images", 0, totalImages, `画像ダウンロード中... (0/${totalImages}枚)`);

      // スマホを考慮して並列数は 3 に制限
      // (PC では体感差なし、スマホでは安定性が大幅向上)
      const IMAGE_CONCURRENCY = 3;

      await runWithConcurrency(needsImage, IMAGE_CONCURRENCY, async (c: any) => {
        const blob = await downloadImage(c.image_url);
        if (blob) {
          try {
            await db.cards.update(c.id, { image: blob });
            downloadedImages++;
          } catch (e) {
            console.warn("画像保存失敗 card_id=" + c.id, e);
            failedImages++;
          }
        } else {
          failedImages++;
        }
        const done = downloadedImages + failedImages;
        if (done % 10 === 0 || done === totalImages) {
          report("images", done, totalImages, `画像ダウンロード中... (${done}/${totalImages}枚)`);
        }
      });

      report(
        "images",
        totalImages,
        totalImages,
        `画像完了: ${downloadedImages}枚取得, ${failedImages}枚スキップ`
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

export async function fullSync(onProgress?: (p: SyncProgress) => void) {
  console.log("🔄 完全同期開始...");
  
  const uploadResult = await syncToSupabase();
  if (!uploadResult.success) {
    console.error("アップロード失敗");
    return uploadResult;
  }

  const downloadResult = await syncFromSupabase(onProgress);
  
  if (downloadResult.success) {
    console.log("✅ 完全同期完了");
  }
  
  return downloadResult;
}
