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
// 共通型
// ========================================

export type SyncProgress = {
  phase: string;
  current: number;
  total: number;
  message: string;
};

// ========================================
// syncedフラグをリセット（強制再アップロード用）
// ========================================

export async function resetSyncedFlags() {
  await db.cards.toCollection().modify({ synced: false });
  await db.decks.toCollection().modify({ synced: false });
  await db.deckCards.toCollection().modify({ synced: false });
  console.log("🔁 syncedフラグをリセットしました");
}

// ========================================
// Supabaseへアップロード（insert/update分岐版）
// ========================================

// Supabaseに既存のIDを一括取得して insert/update を分ける
async function getExistingIds(table: string, ids: number[]): Promise<Set<number>> {
  const existing = new Set<number>();
  const CHUNK = 500;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { data } = await supabase.from(table).select("id").in("id", chunk);
    if (data) data.forEach((r: any) => existing.add(Number(r.id)));
  }
  return existing;
}

export async function syncToSupabase(
  onProgress?: (p: SyncProgress) => void
) {
  const userId = getUserId();
  const BATCH_SIZE = 50;

  const report = (phase: string, current: number, total: number, message: string) => {
    console.log(`[upload][${phase}] ${current}/${total} ${message}`);
    onProgress?.({ phase, current, total, message });
  };

  try {
    // 1. デッキをinsert/update
    const allDecks = await db.decks.toArray();
    const unsyncedDecks = allDecks.filter(d => d.synced === false || d.synced === undefined);
    report("decks", 0, unsyncedDecks.length, `デッキアップロード: ${unsyncedDecks.length}個`);

    if (unsyncedDecks.length > 0) {
      const deckIds = unsyncedDecks.map(d => d.id!).filter(Boolean);
      const existingDeckIds = await getExistingIds("decks", deckIds);

      const toInsert = unsyncedDecks.filter(d => d.name && !existingDeckIds.has(d.id!));
      const toUpdate = unsyncedDecks.filter(d => d.name && existingDeckIds.has(d.id!));

      if (toInsert.length > 0) {
        const rows = toInsert.map(d => ({ id: d.id, name: d.name, created_at: new Date(d.createdAt).toISOString(), user_id: userId }));
        const { error } = await supabase.from("decks").insert(rows);
        if (error) throw error;
      }
      for (const d of toUpdate) {
        await supabase.from("decks").update({ name: d.name, created_at: new Date(d.createdAt).toISOString() }).eq("id", String(d.id!));
      }
      for (const d of unsyncedDecks) {
        await db.decks.update(d.id!, { synced: true });
      }
    }
    report("decks", unsyncedDecks.length, unsyncedDecks.length, "デッキ完了");

    // 2. カードをアップロード
    const allCards = await db.cards.toArray();
    const unsyncedCards = allCards.filter(c => c.synced === false || c.synced === undefined);
    const totalCards = unsyncedCards.length;
    report("cards", 0, totalCards, `カードアップロード: ${totalCards}枚`);

    // 画像アップロード（URLがないものだけ）
    const imageUrlMap = new Map<number, string>();
    const needsImageUpload = unsyncedCards.filter(c => c.image && c.id && !c.imageUrl);
    if (needsImageUpload.length > 0) {
      report("card-images", 0, needsImageUpload.length, `画像アップロード: ${needsImageUpload.length}枚`);
      let imgDone = 0;
      for (const card of needsImageUpload) {
        const url = await uploadImage(card.image!, card.id!);
        if (url) imageUrlMap.set(card.id!, url);
        imgDone++;
        if (imgDone % 10 === 0 || imgDone === needsImageUpload.length) {
          report("card-images", imgDone, needsImageUpload.length, `画像アップロード: ${imgDone}/${needsImageUpload.length}枚`);
        }
      }
    }

    // 全カードの既存IDをSupabaseから一括取得
    const cardIds = unsyncedCards.map(c => c.id!).filter(Boolean);
    const existingCardIds = cardIds.length > 0 ? await getExistingIds("cards", cardIds) : new Set<number>();

    let cardsDone = 0;
    for (let i = 0; i < unsyncedCards.length; i += BATCH_SIZE) {
      const batch = unsyncedCards.slice(i, i + BATCH_SIZE).filter(c => c.name);

      const toInsert = batch.filter(c => !existingCardIds.has(c.id!));
      const toUpdate = batch.filter(c => existingCardIds.has(c.id!));

      const makeRow = (c: typeof batch[0]) => ({
        name: c.name,
        number: c.number || null,
        color: c.color || null,
        type: c.type || null,
        level: c.level || null,
        traits: c.traits || null,
        memo: c.memo || null,
        image_url: imageUrlMap.get(c.id!) || c.imageUrl || null,
        updated_at: new Date(c.updatedAt).toISOString(),
        user_id: userId,
      });

      if (toInsert.length > 0) {
        // insertはidを含める（auto-incrementに任せず固定IDで）
        const rows = toInsert.map(c => ({ id: c.id, ...makeRow(c) }));
        const { error } = await supabase.from("cards").insert(rows);
        if (error) throw error;
      }
      for (const c of toUpdate) {
        const { error } = await supabase.from("cards").update(makeRow(c)).eq("id", String(c.id!));
        if (error) throw error;
      }
      for (const c of batch) {
        await db.cards.update(c.id!, { synced: true, imageUrl: imageUrlMap.get(c.id!) || c.imageUrl });
      }

      cardsDone += batch.length;
      report("cards", cardsDone, totalCards, `カードアップロード: ${cardsDone}/${totalCards}枚`);
    }

    // 3. デッキカードをinsert/update
    const allDeckCards = await db.deckCards.toArray();
    const unsyncedDeckCards = allDeckCards.filter(dc => dc.synced === false || dc.synced === undefined);
    const totalDC = unsyncedDeckCards.length;
    report("deckCards", 0, totalDC, `デッキカードアップロード: ${totalDC}個`);

    // deck_cardsが参照するdeck_idがSupabaseに存在するか確認し、なければ強制insert
    if (unsyncedDeckCards.length > 0) {
      const referencedDeckIds = [...new Set(unsyncedDeckCards.map(dc => dc.deckId).filter(Boolean))];
      if (referencedDeckIds.length > 0) {
        const existingDeckIdsInSupabase = await getExistingIds("decks", referencedDeckIds);
        const missingDeckIds = referencedDeckIds.filter(id => !existingDeckIdsInSupabase.has(id));
        if (missingDeckIds.length > 0) {
          const missingDecks = (await db.decks.toArray()).filter(d => missingDeckIds.includes(d.id!));
          if (missingDecks.length > 0) {
            const rows = missingDecks.map(d => ({ id: d.id, name: d.name, created_at: new Date(d.createdAt).toISOString(), user_id: userId }));
            const { error } = await supabase.from("decks").insert(rows);
            if (error) throw error;
            for (const d of missingDecks) await db.decks.update(d.id!, { synced: true });
            report("deckCards", 0, totalDC, `不足デッキを補完: ${missingDecks.length}個`);
          }
        }
      }

      // deck_cardsが参照するcard_idがSupabaseに存在するか確認し、なければ強制insert
      const referencedCardIds = [...new Set(unsyncedDeckCards.map(dc => dc.cardId).filter(Boolean))];
      if (referencedCardIds.length > 0) {
        const existingCardIdsInSupabase = await getExistingIds("cards", referencedCardIds);
        const missingCardIds = referencedCardIds.filter(id => !existingCardIdsInSupabase.has(id));
        if (missingCardIds.length > 0) {
          const missingCards = (await db.cards.toArray()).filter(c => missingCardIds.includes(c.id!));
          if (missingCards.length > 0) {
            const rows = missingCards.map(c => ({
              id: c.id,
              name: c.name,
              number: c.number || null,
              color: c.color || null,
              type: c.type || null,
              level: c.level || null,
              traits: c.traits || null,
              memo: c.memo || null,
              image_url: c.imageUrl || null,
              updated_at: new Date(c.updatedAt).toISOString(),
              user_id: userId,
            }));
            const { error } = await supabase.from("cards").insert(rows);
            if (error) throw error;
            for (const c of missingCards) await db.cards.update(c.id!, { synced: true });
            report("deckCards", 0, totalDC, `不足カードを補完: ${missingCards.length}枚`);
          }
        }
      }
    }

    const dcIds = unsyncedDeckCards.map(dc => dc.id!).filter(Boolean);
    const existingDcIds = dcIds.length > 0 ? await getExistingIds("deck_cards", dcIds) : new Set<number>();

    let dcDone = 0;
    for (let i = 0; i < unsyncedDeckCards.length; i += BATCH_SIZE) {
      const batch = unsyncedDeckCards.slice(i, i + BATCH_SIZE)
        .filter(dc => Number.isInteger(dc.deckId) && Number.isInteger(dc.cardId));

      const toInsert = batch.filter(dc => !existingDcIds.has(dc.id!));
      const toUpdate = batch.filter(dc => existingDcIds.has(dc.id!));

      if (toInsert.length > 0) {
        const rows = toInsert.map(dc => ({ id: dc.id, deck_id: dc.deckId, card_id: dc.cardId, count: dc.count || 1 }));
        const { error } = await supabase.from("deck_cards").upsert(rows, {
          onConflict: 'deck_id,card_id'
        });
        if (error) throw error;
      }
      for (const dc of toUpdate) {
        await supabase.from("deck_cards").update({ deck_id: dc.deckId, card_id: dc.cardId, count: dc.count || 1 }).eq("id", String(dc.id!));
      }
      for (const dc of batch) {
        await db.deckCards.update(dc.id!, { synced: true });
      }

      dcDone += batch.length;
      report("deckCards", dcDone, totalDC, `デッキカード: ${dcDone}/${totalDC}個`);
    }

    console.log("✅ Supabaseへの同期完了");
    return { success: true };
  } catch (error) {
    console.error("❌ Supabaseアップロードエラー:", error);
    return { success: false, error };
  }
}

// ========================================
// Supabaseからダウンロード（スマホ最適化版）
// ========================================

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

    async function fetchAll(table: string, filters: Record<string, string> = {}) {
      const PAGE_SIZE = 500;
      let from = 0;
      const allData: any[] = [];

      while (true) {
        let query = (supabase.from(table) as any)
          .select("*")
          .range(from, from + PAGE_SIZE - 1)
          .order("id", { ascending: true });
        for (const [key, value] of Object.entries(filters)) {
          query = query.eq(key, value);
        }
        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData.push(...data);
        console.log(`[fetchAll] ${table}: ${allData.length} 件取得済み (このページ: ${data.length})`);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      console.log(`[fetchAll] ${table} 合計: ${allData.length} 件`);
      return allData;
    }

    const cardsData = await fetchAll("cards", { user_id: userId });
    const decksData = await fetchAll("decks", { user_id: userId });

    const myDeckIds = decksData.map((d: any) => String(d.id));
    const deckCardsData: any[] = [];
    if (myDeckIds.length > 0) {
      const PAGE_SIZE = 500;
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from("deck_cards")
          .select("*")
          .in("deck_id", myDeckIds)
          .order("id", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        deckCardsData.push(...data);
        console.log(`[fetchAll] deck_cards: ${deckCardsData.length} 件取得済み`);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      console.log(`[fetchAll] deck_cards 合計: ${deckCardsData.length} 件`);
    }

    // デッキをバッチ同期
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

    // デッキカードをバッチ同期
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

    // カード: メタデータを先に一括書き込み
    if (cardsData.length > 0) {
      const totalCards = cardsData.length;
      report("cards-meta", 0, totalCards, `カード情報を保存中... (${totalCards}枚)`);

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

      // 画像: ローカルに未取得のものだけ並列ダウンロード
      const needsImage = cardsData.filter((c: any) => {
        if (!c.image_url) return false;
        const local = localCardMap.get(c.id);
        return !local?.image;
      });

      const totalImages = needsImage.length;
      let downloadedImages = 0;
      let failedImages = 0;

      report("images", 0, totalImages, `画像ダウンロード中... (0/${totalImages}枚)`);

      await runWithConcurrency(needsImage, 3, async (c: any) => {
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

      report("images", totalImages, totalImages,
        `画像完了: ${downloadedImages}枚取得, ${failedImages}枚スキップ`);
    }

    console.log("✅ Supabaseから同期完了");
    return { success: true };
  } catch (error) {
    console.error("❌ Supabase同期エラー:", error);
    return { success: false, error };
  }
}

// ========================================
// 完全同期
// ========================================

export async function fullSync(onProgress?: (p: SyncProgress) => void) {
  console.log("🔄 完全同期開始...");

  const uploadResult = await syncToSupabase(onProgress);
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
