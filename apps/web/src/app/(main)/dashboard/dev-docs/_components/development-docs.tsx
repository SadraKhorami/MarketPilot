"use client";

import Link from "next/link";

import { ArrowUpRight } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

import { ArchitectureOverview } from "./architecture-overview";
import { CommandBlock } from "./command-block";
import { DeploymentGuide } from "./deployment-guide";
import { LocalServiceStatus } from "./local-service-status";
import { type GuideStep, guides, troubleshooting } from "./guide-data";

type DocsSection = "architecture" | "daily" | "setup" | "bots" | "billing" | "deploy" | "troubleshooting";

export function DevelopmentDocs({ section }: { section: DocsSection }) {
  if (section === "architecture") return <ArchitectureOverview />;
  if (section === "deploy") return <DeploymentGuide />;
  if (section === "troubleshooting") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Find the cause, then recover</CardTitle>
          <CardDescription>Common local issues and the next useful check.</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            {troubleshooting.map(({ question, answer }) => (
              <AccordionItem key={question} value={question}>
                <AccordionTrigger>{question}</AccordionTrigger>
                <AccordionContent>
                  <p className="max-w-3xl text-muted-foreground leading-relaxed">{answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    );
  }
  const guide = guides.find((item) => item.id === section);
  if (!guide) return null;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-lg">{guide.title}</h2>
        <p className="max-w-3xl text-muted-foreground text-sm">{guide.description}</p>
      </div>
      {section === "daily" && <LocalServiceStatus />}
      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">
        {guide.steps.map((step, index) => (
          <StepCard key={step.title} step={step} index={index} />
        ))}
      </div>
    </div>
  );
}

function StepCard({ step, index }: { step: GuideStep; index: number }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex items-start gap-3">
          <Badge variant="secondary" className="shrink-0 tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </Badge>
          <div className="flex min-w-0 flex-col gap-2">
            <CardTitle>{step.title}</CardTitle>
            <CardDescription>{step.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-3">
        {step.code && <CommandBlock code={step.code} label={step.title} />}
        {step.note && (
          <p className="text-muted-foreground text-xs leading-relaxed [overflow-wrap:anywhere]">{step.note}</p>
        )}
      </CardContent>
      {step.link && (
        <CardFooter className="justify-end">
          <Button asChild size="sm" variant="outline">
            <Link href={step.link.href}>
              {step.link.label}
              <ArrowUpRight data-icon="inline-end" />
            </Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
