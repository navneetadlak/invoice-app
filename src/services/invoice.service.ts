import api from "../api";

const InvoiceService = {
    getList: (from?: string, to?: string) =>
        api.get("/invoice/getlist", { params: { from, to } }),

    getMetrics: (from?: string, to?: string) =>
        api.get("/invoice/getmetrics", { params: { from, to } }),

    getTrend12M: () =>
        api.get("/invoice/gettrend12m"),

    getTopItems: (from?: string, to?: string, topN = 5) =>
        api.get("/invoice/topitems", { params: { from, to, topN } }),

    delete: (invoiceID: number) =>
        api.post("/invoice/delete", { invoiceID }),
};

export default InvoiceService;
