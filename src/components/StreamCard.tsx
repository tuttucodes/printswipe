"use client";
import { Card, CardBody, CardHeader, CardFooter } from "./ui/card";
import { Button } from "./ui/button";
import { CMYKBar } from "./CMYKBar";
import { humanStreamLabel, type StreamKey } from "@/lib/types";

export interface StreamCardProps {
  index: number;
  total: number;
  streamKey: StreamKey;
  printerLabel: string;
  pageCount: number;
  sheetCount: number;
  isDuplex: boolean;
  signedUrl: string;
  sent?: boolean;
  onMarkSent: () => void;
}

export function StreamCard(p: StreamCardProps) {
  return (
    <Card className="animate-feed-in">
      <CMYKBar height={4} />
      <CardHeader className="flex items-start justify-between">
        <div>
          <div className="smallcaps text-ink/60">
            Stream {p.index} / {p.total}
          </div>
          <div className="font-mono font-bold text-lg mt-1">{humanStreamLabel(p.streamKey)}</div>
        </div>
        <div className="font-mono text-xs text-ink/60 num text-right">
          {p.sheetCount} sheet{p.sheetCount === 1 ? "" : "s"} · {p.pageCount} side{p.pageCount === 1 ? "" : "s"}
        </div>
      </CardHeader>
      <CardBody className="space-y-2">
        <div className="text-sm">
          <span className="smallcaps text-ink/60 mr-2">Printer</span>
          <span className="font-mono">{p.printerLabel}</span>
        </div>
        <div className="text-sm">
          <span className="smallcaps text-ink/60 mr-2">Setting</span>
          <span className="font-mono">{p.isDuplex ? "Double-sided, long edge" : "Single-sided"}</span>
        </div>
      </CardBody>
      <CardFooter className="flex gap-2">
        <Button asChild>
          <a href={p.signedUrl} target="_blank" rel="noopener">
            Open & Print PDF
          </a>
        </Button>
        <Button variant={p.sent ? "ghost" : "secondary"} onClick={p.onMarkSent}>
          {p.sent ? "✓ Sent" : "Mark as Sent"}
        </Button>
      </CardFooter>
    </Card>
  );
}
