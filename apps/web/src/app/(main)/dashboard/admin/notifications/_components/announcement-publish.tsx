"use client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApiResource } from "@/hooks/use-api-resource";

import { ResourceState } from "../../../_components/resource-state";
import { AnnouncementPreview } from "./announcement-preview";
import { type AnnouncementRecord, audienceLabels } from "./announcement-types";
export function AnnouncementPublish({
  item,
  pending,
  onClose,
  onPublish,
}: {
  item: AnnouncementRecord;
  pending: boolean;
  onClose: () => void;
  onPublish: () => void;
}) {
  const audience = useApiResource<{ total: number; eligible: number; excluded: number }>(
    `/admin/notifications/audience?audience=${item.audience}`,
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-xl" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Publish announcement</DialogTitle>
          <DialogDescription>
            This delivers a notification to the selected accounts. Published messages cannot be edited or withdrawn.
          </DialogDescription>
        </DialogHeader>
        <AnnouncementPreview {...item} />
        <ResourceState {...audience} retry={audience.reload} />
        {audience.data && !audience.error && (
          <div className="flex flex-col gap-1">
            <p className="font-medium text-sm">
              {audienceLabels[item.audience]} · {audience.data.eligible} recipients
            </p>
            <p className="text-muted-foreground text-xs">
              {audience.data.excluded} opted out. Audience preview reflects current accounts; recipients are resolved
              when published.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose}>
            Keep draft
          </Button>
          <Button
            disabled={pending || audience.loading || !!audience.error || !audience.data?.eligible}
            onClick={onPublish}
          >
            {pending ? "Publishing…" : "Publish to inboxes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
