import type { Card, Deck } from "../../db";
import { IncidentArea } from "./areas/IncidentArea";
import { EvidenceArea } from "./areas/EvidenceArea";
import { FieldArea } from "./areas/FieldArea";
import { HandArea } from "./areas/HandArea";
import { PartnerArea } from "./areas/PartnerArea";
import { DeckArea } from "./areas/DeckArea";
import { RemoveArea } from "./areas/RemoveArea";
import { FileArea } from "./areas/FileArea";

interface PlayFieldProps {
  deck: Deck | undefined;
  partnerCard: Card | null;
  incidentCard: Card | null;
  playDeck: Card[];
  playHand: Card[];
  playField: Card[];
  playRemove: Card[];
  playEvidence: Card[];
  playFile: Card[];
  evidenceFaceUp: Set<number | undefined>;
  isEvidenceCollapsed: boolean;
  mulliganDone: boolean;
  onReset: () => void;
  onDrawCard: () => void;
  onStartTurn: () => void;
  onStartMulligan: () => void;
  onToggleEvidenceCollapse: () => void;
  onCardClick: (card: Card, index: number, location: "hand" | "field" | "remove" | "evidence" | "file") => void;
  onCardDetailClick: (card: Card) => void;
}

export function PlayField({
  deck,
  partnerCard,
  incidentCard,
  playDeck,
  playHand,
  playField,
  playRemove,
  playEvidence,
  playFile,
  evidenceFaceUp,
  isEvidenceCollapsed,
  mulliganDone,
  onReset,
  onDrawCard,
  onStartTurn,
  onStartMulligan,
  onToggleEvidenceCollapse,
  onCardClick,
  onCardDetailClick
}: PlayFieldProps) {
  return (
    <div className="section" style={{ 
      height: "calc(100vh - 130px)", 
      display: "flex", 
      flexDirection: "column",
      overflow: "hidden",
      padding: "0.5rem"
    }}>
      {/* ヘッダー */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "0.5rem",
        padding: "0.5rem",
        background: "white",
        borderRadius: "8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
      }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "bold" }}>
          🎮 {deck?.name ?? "一人回し"}
        </h2>
        <button className="btn-secondary" onClick={onReset} style={{ padding: "0.5rem 1rem" }}>
          🔙 戻る
        </button>
      </div>

      {/* メインフィールド */}
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "140px 1fr 120px",
        gridTemplateRows: "1fr auto auto",
        gap: "0.5rem",
        minHeight: 0
      }}>
        {/* 左列（事件・証拠エリア） */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <IncidentArea 
            incidentCard={incidentCard}
            onCardClick={onCardDetailClick}
          />
          <EvidenceArea
            playEvidence={playEvidence}
            evidenceFaceUp={evidenceFaceUp}
            isEvidenceCollapsed={isEvidenceCollapsed}
            onToggleCollapse={onToggleEvidenceCollapse}
            onCardClick={(card, index) => onCardClick(card, index, "evidence")}
          />
        </div>

        {/* 中央エリア */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <FieldArea
            playField={playField}
            onCardClick={(card, index) => onCardClick(card, index, "field")}
          />

          {/* パートナーと手札エリア */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 180px",
            gap: "0.5rem"
          }}>
            <HandArea
              playHand={playHand}
              mulliganDone={mulliganDone}
              onCardClick={(card, index) => onCardClick(card, index, "hand")}
              onStartMulligan={onStartMulligan}
            />
            <PartnerArea
              partnerCard={partnerCard}
              onCardClick={onCardDetailClick}
            />
          </div>
        </div>

        {/* 右列（山札・リムーブ・FILEエリア） */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <DeckArea
            deckCount={playDeck.length}
            onDrawCard={onDrawCard}
            onStartTurn={onStartTurn}
          />
          <RemoveArea
            playRemove={playRemove}
            onCardClick={(card, index) => onCardClick(card, index, "remove")}
          />
          <FileArea
            playFile={playFile}
            onCardClick={(card, index) => onCardClick(card, index, "file")}
          />
        </div>
      </div>
    </div>
  );
}
