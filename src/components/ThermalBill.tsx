"use client";

export interface ThermalBillItem {
  name: string;
  qty: number;
  rate: number; // paise per unit
  amount: number; // paise
}

export interface ThermalBillData {
  brand: string;
  shopName: string;
  shopLocation?: string | null;
  token: string;
  jobId: string;
  binNumber?: number | null;
  customerName: string;
  customerPhoneMasked?: string;
  customerEmail?: string;
  campusName?: string | null;
  slotTime: string;
  paidAt?: string | null;
  paymentRef?: string | null;
  items: ThermalBillItem[];
  basePaise: number;
  premiumPaise: number;
  gstPaise: number;
  totalPaise: number;
  status: string;
  footer?: string;
}

const money = (paise: number) => `₹${(paise / 100).toFixed(2)}`;
const moneyPlain = (paise: number) => (paise / 100).toFixed(2);

export function ThermalBill({
  data,
  showActions = false,
  onDownloadPdf,
}: {
  data: ThermalBillData;
  showActions?: boolean;
  onDownloadPdf?: () => void;
}) {
  return (
    <div className="bill-root">
      <header>
        <p className="bill-brand">{data.brand}</p>
        <p className="bill-sub">{data.shopName}</p>
        {data.shopLocation ? <p className="bill-sub">{data.shopLocation}</p> : null}
        <p className="bill-tag">— Print Receipt —</p>
      </header>

      <div className="bill-token">{data.token}</div>
      <div className="bill-tokenSub">Your token</div>
      {data.binNumber ? (
        <div className="bill-binWrap">
          <span className="bill-bin">BIN {data.binNumber}</span>
        </div>
      ) : null}

      <hr className="bill-dash" />
      <section>
        <p className="bill-meta">
          <span className="bill-metaLabel">Order</span> #{data.jobId.slice(0, 8)}
        </p>
        <p className="bill-meta">
          <span className="bill-metaLabel">Slot</span> {data.slotTime}
        </p>
        {data.paidAt ? (
          <p className="bill-meta">
            <span className="bill-metaLabel">Paid</span> {data.paidAt}
          </p>
        ) : null}
        {data.paymentRef ? (
          <p className="bill-meta">
            <span className="bill-metaLabel">Ref</span>{" "}
            <span className="bill-mono">{data.paymentRef}</span>
          </p>
        ) : null}
        <p className="bill-meta">
          <span className="bill-metaLabel">Status</span> {data.status}
        </p>
      </section>

      <hr className="bill-dash" />
      <section>
        <p className="bill-meta">
          <span className="bill-metaLabel">Customer</span> {data.customerName}
        </p>
        {data.customerPhoneMasked ? (
          <p className="bill-meta">
            <span className="bill-metaLabel">Phone</span>{" "}
            <span className="bill-mono">{data.customerPhoneMasked}</span>
          </p>
        ) : null}
        {data.customerEmail ? (
          <p className="bill-meta">
            <span className="bill-metaLabel">Email</span>{" "}
            <span className="bill-mono">{data.customerEmail}</span>
          </p>
        ) : null}
        {data.campusName ? (
          <p className="bill-meta">
            <span className="bill-metaLabel">Campus</span> {data.campusName}
          </p>
        ) : null}
      </section>

      <hr className="bill-dash" />
      <p className="bill-section">Print Items</p>
      <div aria-label="Line items">
        <div className="bill-grid bill-thead">
          <div className="bill-th">Item</div>
          <div className="bill-th bill-thRight">Qty</div>
          <div className="bill-th bill-thRight">Rate</div>
          <div className="bill-th bill-thRight">Amt</div>
        </div>
        {data.items.length === 0 ? (
          <p className="bill-meta" style={{ fontStyle: "italic", color: "#9ca3af" }}>—</p>
        ) : (
          data.items.map((item, idx) => (
            <div className="bill-grid bill-row" key={idx}>
              <div className="bill-itemName" title={item.name}>
                {item.name}
              </div>
              <div className="bill-qty">{item.qty}</div>
              <div className="bill-rate">{moneyPlain(item.rate)}</div>
              <div className="bill-amt">{moneyPlain(item.amount)}</div>
            </div>
          ))
        )}
      </div>

      <hr className="bill-dash" />
      <section className="bill-summary">
        <div className="bill-sumRow">
          <span>Subtotal</span>
          <span className="bill-mono">{money(data.basePaise)}</span>
        </div>
        {data.premiumPaise > 0 ? (
          <div className="bill-sumRow">
            <span>Convenience fee</span>
            <span className="bill-mono">{money(data.premiumPaise)}</span>
          </div>
        ) : null}
        {data.gstPaise > 0 ? (
          <div className="bill-sumRow">
            <span>GST</span>
            <span className="bill-mono">{money(data.gstPaise)}</span>
          </div>
        ) : null}
        <div className="bill-sumRow bill-total">
          <span>TOTAL</span>
          <span className="bill-mono">{money(data.totalPaise)}</span>
        </div>
      </section>

      <p className="bill-foot">{data.footer ?? "Thank you for using Printswipe."}</p>
      <p className="bill-foot">printswipe.in</p>

      {showActions ? (
        <div className="bill-actions bill-noPrint">
          <button
            type="button"
            onClick={() => window.print()}
            className="bill-actionBtn"
          >
            Print
          </button>
          {onDownloadPdf ? (
            <button
              type="button"
              onClick={onDownloadPdf}
              className="bill-actionBtn bill-actionPrimary"
            >
              Save as PDF
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
