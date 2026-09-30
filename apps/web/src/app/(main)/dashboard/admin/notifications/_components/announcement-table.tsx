"use client";
import { Megaphone, Pencil, Send, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { type AnnouncementRecord, audienceLabels } from "./announcement-types";

interface Props {
  items: AnnouncementRecord[];
  onDetail: (item: AnnouncementRecord) => void;
  onEdit: (item: AnnouncementRecord) => void;
  onPublish: (item: AnnouncementRecord) => void;
  onCancel: (item: AnnouncementRecord) => void;
}
export function AnnouncementTable({ items, onDetail, onEdit, onPublish, onCancel }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Message</TableHead>
          <TableHead>Audience</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Delivered / read</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="pr-6 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="max-w-sm py-4 pl-6">
              <button
                type="button"
                className="flex items-start gap-2 rounded-sm text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onDetail(item)}
              >
                <Megaphone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="line-clamp-2 break-words font-medium">{item.title}</span>
              </button>
              <p className="mt-1 text-muted-foreground text-xs">
                {item.author?.name ?? item.author?.email ?? "Former administrator"}
              </p>
            </TableCell>
            <TableCell>{audienceLabels[item.audience]}</TableCell>
            <TableCell>
              <Badge variant={item.status === "PUBLISHED" ? "secondary" : "outline"}>{item.status.toLowerCase()}</Badge>
            </TableCell>
            <TableCell className="tabular-nums">
              {item.status === "PUBLISHED" ? `${item.recipientCount} / ${item.readCount}` : "—"}
            </TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {new Date(item.createdAt).toLocaleDateString()}
            </TableCell>
            <TableCell className="pr-6">
              <div className="flex justify-end gap-1">
                {item.status === "DRAFT" ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${item.title}`}
                      onClick={() => onEdit(item)}
                    >
                      <Pencil />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onPublish(item)}>
                      <Send data-icon="inline-start" />
                      Publish
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Cancel ${item.title}`}
                      onClick={() => onCancel(item)}
                    >
                      <X />
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => onDetail(item)}>
                    Details
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
