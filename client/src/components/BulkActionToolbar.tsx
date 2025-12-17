import { Button } from "@/components/ui/button";
import { X, RefreshCw, Bell, CheckSquare, Square } from "lucide-react";

export interface BulkActionToolbarProps {
  selectedCount: number;
  totalCount: number;
  onCancelSelected: () => void;
  onRepostSelected: () => void;
  onNotifySelected: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  isLoading?: boolean;
}

export function BulkActionToolbar({
  selectedCount,
  totalCount,
  onCancelSelected,
  onRepostSelected,
  onNotifySelected,
  onSelectAll,
  onDeselectAll,
  isLoading = false,
}: BulkActionToolbarProps) {
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div 
      className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/95 backdrop-blur-sm rounded-lg border"
      data-testid="bulk-action-toolbar"
    >
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium" data-testid="text-selected-count">
          {selectedCount} shift{selectedCount !== 1 ? "s" : ""} selected
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={allSelected ? onDeselectAll : onSelectAll}
          data-testid={allSelected ? "button-deselect-all" : "button-select-all"}
        >
          {allSelected ? (
            <>
              <Square className="h-4 w-4 mr-1" />
              Deselect All
            </>
          ) : (
            <>
              <CheckSquare className="h-4 w-4 mr-1" />
              Select All
            </>
          )}
        </Button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          onClick={onNotifySelected}
          disabled={isLoading}
          data-testid="button-notify-selected"
        >
          <Bell className="h-4 w-4 mr-1" />
          Notify Selected
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onRepostSelected}
          disabled={isLoading}
          data-testid="button-repost-selected"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Repost Selected
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={onCancelSelected}
          disabled={isLoading}
          data-testid="button-cancel-selected"
        >
          <X className="h-4 w-4 mr-1" />
          Cancel Selected
        </Button>
      </div>
    </div>
  );
}
