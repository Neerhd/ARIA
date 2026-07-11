import { useState } from "react";
import SidebarItem from "./SidebarItem";

/**
 * One item within a SidebarSection. Handles its own expand/collapse state
 * when it has children (e.g. a project with chats nested under it), so
 * SidebarSection itself only has to think in terms of a flat `items` tree.
 */
function SidebarTreeItem({ item }) {
  const [expanded, setExpanded] = useState(item.defaultExpanded ?? true);
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div className="flex flex-col gap-0.5">
      <SidebarItem
        label={item.label}
        icon={item.icon}
        selected={item.selected}
        actions={item.actions}
        expandable={hasChildren}
        expanded={expanded}
        onClick={hasChildren ? () => setExpanded((v) => !v) : item.onClick}
      />
      {hasChildren && expanded && (
        <div className="flex flex-col gap-0.5 pl-6">
          {item.children.map((child) => (
            <SidebarTreeItem key={child.id} item={child} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A titled, collapsible group of SidebarItems (e.g. "Recent Chats",
 * "Projects"). Items may nest one or more levels deep (project -> chats).
 * Only rendered in the Sidebar's expanded state — collapsed mode shows a
 * fixed icon toolbar instead (see Sidebar.jsx).
 */
export default function SidebarSection({ title, items = [], defaultExpanded = true, emptyLabel, actions }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="flex w-full flex-col gap-0.5">
      <SidebarItem
        variant="header"
        label={title}
        expandable
        expanded={expanded}
        actions={actions}
        onClick={() => setExpanded((v) => !v)}
      />

      {expanded && (
        <>
          {items.length === 0 && emptyLabel && (
            <SidebarItem label={emptyLabel} interactive={false} className="text-sidebar-muted-foreground" />
          )}
          {items.map((item) => (
            <SidebarTreeItem key={item.id} item={item} />
          ))}
        </>
      )}
    </div>
  );
}
