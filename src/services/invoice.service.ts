import api from "../api";

const toFiniteNumber = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const toServerModel = (p: any) => {
  const model: any = {
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
          Quantity: toFiniteNumber(qtyRaw, 0),
          Rate: toFiniteNumber(rateRaw, 0),
          DiscountPct: toFiniteNumber(discRaw, 0),
          Description: String((ln.description ?? ln.Description ?? "").trim()),
        };
      })
      : [],
  };

  if (toFiniteNumber(p.invoiceID, 0) > 0 && p.invoiceNo !== undefined && p.invoiceNo !== null && p.invoiceNo !== "") {
    model.InvoiceNo = toFiniteNumber(p.invoiceNo, 0);
  }

  console.debug("toServerModel result:", JSON.stringify(model));
  return model;
};

const InvoiceService = {
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
    const body = toServerModel(payload);

    const id = Number(payload?.invoiceID ?? 0);

    if (!id) {
      if ("InvoiceNo" in body) delete body.InvoiceNo;

      body.InvoiceID = 0;

      body.UpdatedOnPrev = null;
      console.debug("Creating invoice - POST /invoice body:", JSON.stringify(body));

      return api.post("/invoice", body);
    } else {
      console.debug("Updating invoice - POST /invoice/insertupdate body:", JSON.stringify(body));
      return api.post("/invoice/insertupdate", body);
    }
  },

  delete: (invoiceID: number) => api.delete(`/invoice/${invoiceID}`),
};

export default InvoiceService;
