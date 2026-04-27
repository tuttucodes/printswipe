"use client";
import { ThermalBill, type ThermalBillData } from "@/components/ThermalBill";

export function BillClient({ data, jobId }: { data: ThermalBillData; jobId: string }) {
  function downloadPdf() {
    window.location.href = `/api/receipts/${jobId}`;
  }

  return <ThermalBill data={data} showActions onDownloadPdf={downloadPdf} />;
}
