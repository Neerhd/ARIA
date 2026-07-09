import { useState } from "react";
import { FolderKanban, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { createProject, updateProject, deleteProject } from "@/services/api";

export default function ProjectSwitcher({ open, onOpenChange, projects, activeProjectId, onSelect, onProjectsChange }) {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState(null);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      await createProject(name);
      setNewName("");
      await onProjectsChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (p) => { setEditingId(p.id); setEditName(p.name); };
  const cancelEdit = () => { setEditingId(null); setEditName(""); };

  const saveEdit = async (id) => {
    const name = editName.trim();
    if (!name) return;
    setError(null);
    try {
      await updateProject(id, { name });
      cancelEdit();
      await onProjectsChange();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    setError(null);
    try {
      await deleteProject(id);
      await onProjectsChange();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[360px] sm:max-w-[360px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FolderKanban className="size-4" /> Projects
          </SheetTitle>
        </SheetHeader>

        <div className="flex items-center gap-2 px-4">
          <Textarea
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleCreate(); }
            }}
            placeholder="New project name…"
            rows={1}
            className="min-h-0 flex-1 resize-none"
          />
          <Button size="icon" onClick={handleCreate} disabled={creating || !newName.trim()} title="Create project">
            <Plus />
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mx-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
          <div className="flex flex-col gap-1.5">
            {projects.map((p) => {
              const active = p.id === activeProjectId;
              const editing = editingId === p.id;
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-1.5 rounded-lg border p-2.5 ${
                    active ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  {editing ? (
                    <>
                      <Textarea
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(p.id); }
                          if (e.key === "Escape") cancelEdit();
                        }}
                        rows={1}
                        className="min-h-0 flex-1 resize-none"
                        autoFocus
                      />
                      <Button size="icon-sm" variant="ghost" onClick={() => saveEdit(p.id)} title="Save">
                        <Check />
                      </Button>
                      <Button size="icon-sm" variant="ghost" onClick={cancelEdit} title="Cancel">
                        <X />
                      </Button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => { onSelect(p.id); onOpenChange(false); }}
                        className="min-w-0 flex-1 cursor-pointer text-left"
                      >
                        <div className="truncate text-sm font-medium">{p.name}</div>
                        {p.description && (
                          <div className="truncate text-[11px] text-muted-foreground">{p.description}</div>
                        )}
                      </button>
                      <Button size="icon-sm" variant="ghost" onClick={() => startEdit(p)} title="Rename">
                        <Pencil />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger render={<Button size="icon-sm" variant="ghost" title="Delete" />}>
                          <Trash2 />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete "{p.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently deletes all conversations, messages, and memory
                              (episodes, embeddings) under this project. Concepts shared with
                              other projects are kept. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction variant="destructive" onClick={() => handleDelete(p.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
