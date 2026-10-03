"use client";
import { useState } from "react";
import type { AiSettingsView } from "@marketpilot/ai/contracts";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useApiResource } from "@/hooks/use-api-resource";
import { ResourceState } from "../../_components/resource-state";
import { AiMemorySettings } from "./ai-memory-settings";
import { AiProviderSettings } from "./ai-provider-settings";
import { ConversationActions } from "./conversation-actions";
export function AiSettings({
  currentId,
  disabled,
  changed,
  conversationsChanged,
}: {
  currentId: string | null;
  disabled: boolean;
  changed: () => void;
  conversationsChanged: (ids?: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const resource = useApiResource<AiSettingsView>(open ? "/ai/settings" : null);
  function saved() {
    resource.reload();
    changed();
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="AI settings" disabled={disabled}>
              <Settings />
            </Button>
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent>AI settings</TooltipContent>
      </Tooltip>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="pr-12">
          <SheetTitle>AI settings</SheetTitle>
          <SheetDescription>
            Your memory, provider and conversations. Research tools and confirmation rules stay consistent.
          </SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="memory" className="min-h-0 flex-1 px-4 pb-4">
          <TabsList className="w-full">
            <TabsTrigger value="memory">Memory</TabsTrigger>
            <TabsTrigger value="provider">Provider</TabsTrigger>
            <TabsTrigger value="chats">Chats</TabsTrigger>
          </TabsList>
          <div className="min-h-0 flex-1 overflow-y-auto pt-3">
            <TabsContent value="memory">
              <ResourceState {...resource} retry={resource.reload} />
              {resource.data ? <AiMemorySettings initial={resource.data} changed={saved} /> : null}
            </TabsContent>
            <TabsContent value="provider">
              <ResourceState {...resource} retry={resource.reload} />
              {resource.data ? (
                <AiProviderSettings
                  key={resource.data.source + (resource.data.keyLast4 ?? "")}
                  initial={resource.data}
                  changed={saved}
                />
              ) : null}
            </TabsContent>
            <TabsContent value="chats">
              <ConversationActions currentId={currentId} disabled={disabled} changed={conversationsChanged} />
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
