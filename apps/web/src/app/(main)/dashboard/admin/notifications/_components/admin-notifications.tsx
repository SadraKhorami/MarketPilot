"use client";
import { useEffect, useState } from "react";

import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApiResource } from "@/hooks/use-api-resource";
import { ApiError, apiRequest } from "@/lib/api/client";

import { CollectionSearch, FilterSelect } from "../../../_components/collection-filters";
import { ResourceState } from "../../../_components/resource-state";
import { useNotifications } from "../../../notifications/_components/notification-provider";
import { AdminCollectionCard, useAdminCollection } from "../../_components/admin-collection";
import { AnnouncementDetail } from "./announcement-detail";
import { AnnouncementEditor, type AnnouncementInput } from "./announcement-editor";
import { AnnouncementPublish } from "./announcement-publish";
import { AnnouncementTable } from "./announcement-table";
import type { AnnouncementRecord, AnnouncementSummary } from "./announcement-types";
export function AdminNotifications() {
  const resource = useAdminCollection<AnnouncementRecord>("notifications", {
    includePeriod: false,
    keepDataOnReload: true,
  });
  const summary = useApiResource<AnnouncementSummary>("/admin/notifications/summary", { keepDataOnReload: true });
  const { refresh, revision } = useNotifications();
  useEffect(() => {
    if (revision > 0) {
      resource.reload();
      summary.reload();
    }
  }, [revision, resource.reload, summary.reload]);
  const [editor, setEditor] = useState<{ draft: AnnouncementRecord | null } | null>(null);
  const [publish, setPublish] = useState<AnnouncementRecord | null>(null);
  const [cancel, setCancel] = useState<AnnouncementRecord | null>(null);
  const [detail, setDetail] = useState<AnnouncementRecord | null>(null);
  const [pending, setPending] = useState(false);
  const reload = () => {
    resource.reload();
    summary.reload();
    void refresh();
  };
  const save = async (input: AnnouncementInput) => {
    try {
      await apiRequest(`/admin/notifications${editor?.draft ? `/${editor.draft.id}` : ""}`, {
        method: editor?.draft ? "PATCH" : "POST",
        body: JSON.stringify({
          ...input,
          ...(editor?.draft ? { expectedUpdatedAt: editor.draft.updatedAt } : {}),
          actionPath: input.actionPath === "none" ? null : input.actionPath,
        }),
      });
      toast.success("Announcement draft saved. Nothing has been sent.");
      reload();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the draft.");
      return false;
    }
  };
  const act = async (item: AnnouncementRecord, action: "publish" | "cancel") => {
    setPending(true);
    try {
      await apiRequest(`/admin/notifications/${item.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ expectedUpdatedAt: item.updatedAt }),
      });
      toast.success(action === "publish" ? "Announcement delivered to eligible inboxes." : "Draft cancelled.");
      setPublish(null);
      setCancel(null);
      reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the announcement.");
      resource.reload();
      if (error instanceof ApiError && error.status === 409) {
        setPublish(null);
        setCancel(null);
      }
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Publish useful product updates. Security notices are generated automatically.
        </p>
        <Button onClick={() => setEditor({ draft: null })}>
          <Plus data-icon="inline-start" />
          Create announcement
        </Button>
      </div>
      <ResourceState loading={summary.loading} error={summary.error} retry={summary.reload} />
      {summary.data && !summary.error && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Drafts", summary.data.drafts, "Awaiting review"],
            ["Published", summary.data.published, "One delivery per account"],
            ["In inboxes", summary.data.delivered, "Stored recipient messages"],
            ["Currently read", summary.data.read, "Aggregate read state"],
          ].map(([label, value, description]) => (
            <Card key={label}>
              <CardHeader>
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{value.toLocaleString()}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-xs">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <AdminCollectionCard
        title="Announcements"
        description="Draft, review and deliver messages to active accounts. Optional announcements honor account preferences."
        resource={resource}
        toolbar={
          <>
            <CollectionSearch
              value={resource.search}
              onChange={resource.setSearch}
              placeholder="Search announcements"
            />
            <FilterSelect
              label="Announcement status"
              value={resource.filters.status ?? "all"}
              options={[
                ["all", "All statuses"],
                ["DRAFT", "Drafts"],
                ["PUBLISHED", "Published"],
                ["CANCELLED", "Cancelled"],
              ]}
              onChange={(value) => resource.setFilter("status", value)}
            />
          </>
        }
      >
        <AnnouncementTable
          items={resource.data?.items ?? []}
          onDetail={setDetail}
          onEdit={(draft) => setEditor({ draft })}
          onPublish={setPublish}
          onCancel={setCancel}
        />
      </AdminCollectionCard>
      {editor && (
        <AnnouncementEditor
          key={editor.draft?.id ?? "new"}
          draft={editor.draft}
          onClose={() => setEditor(null)}
          onSave={save}
        />
      )}
      {publish && (
        <AnnouncementPublish
          item={publish}
          pending={pending}
          onClose={() => setPublish(null)}
          onPublish={() => void act(publish, "publish")}
        />
      )}
      <Dialog
        open={!!cancel}
        onOpenChange={(open) => {
          if (!open && !pending) setCancel(null);
        }}
      >
        <DialogContent showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Cancel this draft?</DialogTitle>
            <DialogDescription>
              “{cancel?.title}” will remain in the cancelled history. No message will be sent.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setCancel(null)}>
              Keep draft
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (cancel) void act(cancel, "cancel");
              }}
            >
              {pending ? "Cancelling…" : "Cancel draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AnnouncementDetail
        item={resource.data?.items.find((item) => item.id === detail?.id) ?? detail}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}
