import React from "react";
import "./NoteCard.css";

export interface NoteCardProps {
  title: string;
  content: string;
  color?: "bae0ff" | "d9f7be" | "ffd6e7" | "d6e4ff" | "ffd666" | "ffffff";
  onClick?: () => void;
  actions?: React.ReactNode; // 右上角操作区（如删除、固定等）
}

const NoteCard: React.FC<NoteCardProps> = ({
  title,
  content,
  color = "ffffff",
  onClick,
  actions,
}) => {
  const colorClass = `note-card note-card-color-${color}`;
  return (
    <div className={colorClass} onClick={onClick}>
      <div className="note-card-title">{title}</div>
      <div className="note-card-content">{content}</div>
      {actions && <div className="note-card-actions">{actions}</div>}
    </div>
  );
};

export default NoteCard;
