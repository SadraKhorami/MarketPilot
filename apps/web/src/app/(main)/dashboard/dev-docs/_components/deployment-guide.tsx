"use client";

import { ArrowUpRight, BookOpen, Server, ShieldCheck } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

import { CommandBlock } from "./command-block";
import { deploymentChapters, deploymentReferences } from "./deployment-data";

export function DeploymentGuide() {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card className="min-w-0">
        <CardHeader className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0 space-y-2">
            <CardTitle className="flex items-center gap-2">
              <Server className="size-5 shrink-0" />
              From your laptop to Ubuntu
            </CardTitle>
            <CardDescription className="max-w-3xl">
              A deployment playbook for the repository’s production Docker stack, with Nginx at the origin and
              Cloudflare at the edge. Work through each chapter in order.
            </CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0">
            Ubuntu · Docker · HTTPS
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {[
            ["Public", "app.example.com + api.example.com"],
            ["Private", "PostgreSQL, Redis & Worker"],
            ["Release", "Pinned revision → migrate → start"],
          ].map(([label, detail]) => (
            <div key={label} className="min-w-0 rounded-lg border bg-muted/30 p-3">
              <p className="text-muted-foreground text-xs">{label}</p>
              <p className="mt-1 font-medium text-sm [overflow-wrap:anywhere]">{detail}</p>
            </div>
          ))}
        </CardContent>
        <CardFooter className="flex items-start gap-2 text-muted-foreground text-xs leading-relaxed">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          <p>
            Instructions only: copying a command does not execute it. Replace example domains and complete protected
            configuration first. These docs remain unavailable in production; billing is currently sandbox only.
          </p>
        </CardFooter>
      </Card>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Deployment checklist</CardTitle>
          <CardDescription>
            Six chapters, from host preparation to recovery. Open a chapter for its commands and decisions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" defaultValue={["prepare"]}>
            {deploymentChapters.map((chapter, index) => (
              <AccordionItem key={chapter.id} value={chapter.id}>
                <AccordionTrigger className="gap-3 text-left">
                  <div className="flex min-w-0 items-start gap-3">
                    <Badge variant="secondary" className="shrink-0 tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </Badge>
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">{chapter.title}</p>
                      <p className="font-normal text-muted-foreground text-xs">{chapter.description}</p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="min-w-0">
                  <div className="flex min-w-0 flex-col divide-y">
                    {chapter.steps.map((step) => (
                      <section key={step.title} className="min-w-0 space-y-3 py-4 first:pt-1 last:pb-1">
                        <h3 className="font-medium text-sm">{step.title}</h3>
                        <p className="max-w-4xl text-muted-foreground text-sm leading-relaxed [overflow-wrap:anywhere]">
                          {step.description}
                        </p>
                        {step.code && <CommandBlock code={step.code} label={step.title} />}
                      </section>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="size-4" />
            Keep the runbook close
          </CardTitle>
          <CardDescription>
            The repository’s docs/deployment.md and docker/ templates contain the full service, recovery and proxy
            details. Consult current provider references before configuring a server.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {deploymentReferences.map((reference) => (
            <Button key={reference.href} asChild size="sm" variant="outline">
              <a href={reference.href} target="_blank" rel="noopener noreferrer">
                {reference.label}
                <ArrowUpRight data-icon="inline-end" />
              </a>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
