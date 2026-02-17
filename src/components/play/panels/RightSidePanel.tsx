import type { Card } from "../../../db";
import { DeckArea } from "../areas/DeckArea";
import { FileArea } from "../areas/FileArea";
import { PartnerArea } from "../areas/PartnerArea";
import { IncidentArea } from "../areas/IncidentArea";

interface RightSidePanelProps {
  isOpen: boolean;
  deckCount: number;
  playFile: Card[];
  partnerCard: Card | null;
  incidentCard: Card | null;
  onDrawCard: () => void;
  onStartTurn: () => void;
  onFileCardClick: (card: Card, index: number) => void;
  onPartnerClick: (card: Card) => void;
  onIncidentClick: (card: Card) => void;
  onClose: () => void;
}

export function RightSidePanel({
  isOpen,
  deckCount,
  playFile,
  partnerCard,
  incidentCard,
  onDrawCard,
  onStartTurn,
  onFileCardClick,
  onPartnerClick,
  onIncidentClick,
  onClose
}: RightSidePanelProps) {
  return (
    <>
      {/* オーバーレイ */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: 100
          }}
        />
      )}
      
      {/* パネル本体 */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "300px",
          background: "white",
          boxShadow: "-2px 0 8px rgba(0,0,0,0.2)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s ease",
          zIndex: 101,
          display: "flex",
          flexDirection: "column",
          padding: "1rem",
          gap: "1rem",
          overflowY: "auto"
        }}
      >
        {/* ヘッダー */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.5rem"
        }}>
          <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "bold" }}>エリア</h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              color: "#666"
            }}
          >
            ✕
          </button>
        </div>

        {/* 山札エリア */}
        <DeckArea
          deckCount={deckCount}
          onDrawCard={onDrawCard}
          onStartTurn={onStartTurn}
        />

        {/* FILEエリア */}
        <FileArea
          playFile={playFile}
          onCardClick={onFileCardClick}
        />

        {/* パートナーエリア */}
        <PartnerArea
          partnerCard={partnerCard}
          onCardClick={onPartnerClick}
        />

        {/* 事件エリア */}
        <IncidentArea
          incidentCard={incidentCard}
          onCardClick={onIncidentClick}
        />
      </div>
    </>
  );
}
