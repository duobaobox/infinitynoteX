import React from "react";

interface ListPanelProps {
  flex: string | number;
}

const ListPanel: React.FC<ListPanelProps> = ({ flex }) => {
  return <div className="layout-panel list-container" style={{ flex }}></div>;
};

export default ListPanel;
