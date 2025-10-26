import React from "react";
import "./NoteCard.css";

export interface NoteCardProps {
  title: string;
  content: string;
  color?: "bae0ff" | "d9f7be" | "ffd6e7" | "d6e4ff" | "ffd666" | "ffffff";
  onClick?: () => void;
}

const NoteCard: React.FC<NoteCardProps> = ({
  title,
  content,
  color = "ffffff",
  onClick,
}) => {
  const colorClass = `note-card note-card-color-${color}`;
  return (
    <div className={colorClass} onClick={onClick}>
      <div className="note-card-title">{title}</div>
      <div className="note-card-content">{content}</div>
    </div>
  );
};

export default NoteCard;
