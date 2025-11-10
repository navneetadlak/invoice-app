// src/services/invoice.service.ts
import api from "../api";

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const toFiniteNumber = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const toServerModel = (p: any) => {
  const model: any = {
    InvoiceID: toFiniteNumber(p.invoiceID, 0),
    ...(p.invoiceNo !== undefined && p.invoiceNo !== null && toFiniteNumber(p.invoiceNo, 0) > 0 ? { InvoiceNo: toFiniteNumber(p.invoiceNo, 0) } : {}),
    InvoiceDate: p.invoiceDate ?? null,
    CustomerName: (p.customerName ?? "").trim(),
    Address: (p.address ?? "").trim(),
    City: (p.city ?? "").trim(),
    Notes: (p.notes ?? "").trim(),
    TaxPercentage: toFiniteNumber(p.taxPercentage, 0),
    TaxAmount: toFiniteNumber(p.taxAmount, 0),
    SubTotal: toFiniteNumber(p.subTotal, 0),
    InvoiceAmount: toFiniteNumber(p.invoiceAmount, 0),
    UpdatedOnPrev: p.updatedOnPrev ?? null,
    Lines: Array.isArray(p.lines)
      ? p.lines.map((ln: any, i: number) => {
          const qtyRaw = ln.qty ?? ln.Qty ?? ln.quantity ?? ln.Quantity ?? 0;
          const rateRaw = ln.rate ?? ln.Rate ?? ln.saleRate ?? 0;
          const discRaw = ln.discountPct ?? ln.DiscountPct ?? 0;
          return {
            RowNo: toFiniteNumber(ln.lineNo ?? ln.rowNo ?? ln.RowNo ?? (i + 1), i + 1),
            ItemID: toFiniteNumber(ln.itemID ?? ln.ItemID ?? 0, 0),
            Quantity: toFiniteNumber(qtyRaw, 0), // server expects Quantity column
            Rate: toFiniteNumber(rateRaw, 0),
            DiscountPct: toFiniteNumber(discRaw, 0),
            Description: String((ln.description ?? ln.Description ?? "").trim()),
          };
        })
      : [],
  };

  return model;
};

const InvoiceService = {
  // NOTE: use lowercase paths that match the PRD specification
  getList: (from?: string, to?: string, invoiceID?: number) =>
    api.get("/invoice/getlist", { params: { from, to, invoiceID } }),

  getById: (invoiceID: number) =>
    api.get("/invoice/getlist", { params: { invoiceID } }),

  getMetrics: (from?: string, to?: string) =>
    api.get("/invoice/getmetrics", { params: { from, to } }),

  getTrend12M: () => api.get("/invoice/gettrend12m"),

  getTopItems: (from?: string, to?: string, topN = 5) =>
    api.get("/invoice/topitems", { params: { from, to, topN } }),

insertUpdate: (payload: any) => {
  const body = toServerModel(payload); // your existing model builder

  const id = Number(payload?.invoiceID ?? 0);

  if (!id) {
    // IMPORTANT: remove InvoiceNo so server will auto-generate a fresh one
    if ("InvoiceNo" in body) delete body.InvoiceNo;
    return api.post("/Invoice", body);
  } else {
    return api.put(`/Invoice/${id}`, body);
  }
},


  delete: (invoiceID: number) => api.post("/invoice/delete", { invoiceID }),
};

export default InvoiceService;



  // keep the working normalization (server wants model), using the /invoice endpoints
  // insertUpdate: (payload: any) => {
  //   const body = toServerModel(payload);
  //   console.log("Sending to server (model):", JSON.stringify(body, null, 2));
  //   const id = Number(payload?.invoiceID ?? 0);

  //   // the PRD describes POST /invoice/insertupdate — some backends also accept POST /invoice
  //   // Use POST /invoice/insertupdate if your server requires it; many servers expose both.
  //   // Try POST /invoice/insertupdate first, fallback to POST /invoice
  //   if (!id) {
  //     // create
  //     return api.post("/invoice/insertupdate", { model: body })
  //       .catch((err) => {
  //         // fallback: some deployments accept POST /invoice with model body
  //         if (err?.response?.status === 405 || err?.response?.status === 404) {
  //           return api.post("/invoice", body);
  //         }
  //         throw err;
  //       });
  //   } else {
  //     // update
  //     return api.put(`/invoice/${id}`, { model: body });
  //   }
  // },
  //   insertUpdate: (payload: any) => {
  //   const body = toServerModel(payload); // This now returns the model directly

  //   console.log("Sending to server:", JSON.stringify(body, null, 2));

  //   const id = Number(payload?.invoiceID ?? 0);

  //   if (!id) {
  //     return api.post("/Invoice", body);
  //   } else {
  //     return api.put(`/Invoice/${id}`, body);
  //   }
  // },

  // src/services/invoice.service.ts (inside insertUpdate)