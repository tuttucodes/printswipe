import { humanStreamLabel, type StreamKey } from "@/lib/types";

export interface BinRow {
  token: string;
  studentName: string;
  binNumber: number;
  streamContributions: Record<string, { pageCount: number; sheetCount: number }>;
}

export function BinAssignmentTable({ rows }: { rows: BinRow[] }) {
  return (
    <div className="hairline overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-ink text-paper">
          <tr>
            <th className="text-left px-4 py-2 smallcaps">Token</th>
            <th className="text-left px-4 py-2 smallcaps">Student</th>
            <th className="text-right px-4 py-2 smallcaps">Bin</th>
            <th className="text-left px-4 py-2 smallcaps">Streams</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.token} className={i % 2 === 0 ? "bg-paper" : "bg-ink/[0.02]"}>
              <td className="px-4 py-3 font-mono font-bold">{r.token}</td>
              <td className="px-4 py-3">{r.studentName}</td>
              <td className="px-4 py-3 text-right font-mono">
                <span className="inline-block bg-accent text-paper font-bold px-2 py-0.5 num">{r.binNumber}</span>
              </td>
              <td className="px-4 py-3 text-xs">
                {Object.entries(r.streamContributions).map(([k, v]) => (
                  <div key={k} className="font-mono">
                    {humanStreamLabel(k as StreamKey)} <span className="text-ink/60 num">({v.pageCount}p)</span>
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
