import React, { useEffect, useState } from "react";
import { Box, Typography, Paper, Button, Divider } from "@mui/material";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import InvoiceService from "../services/invoice.service";
import dayjs from "dayjs";

const formatMoney = (value: number | null | undefined, symbol = "$") => {
    if (value == null) return "-";
    return `${symbol}${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function PrintInvoicePage() {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [invoice, setInvoice] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const currencySymbol = "$"; 

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            try {
                const res = await InvoiceService.getById(Number(id));
                const data = res?.data ?? null;
                let dto = null;
                if (Array.isArray(data)) {
                    dto = data[0] ?? null;
                } else if (typeof data === "object") {
                    dto = data;
                }

                if (dto && mounted) {
                    const lines = dto.lines ?? dto.Lines ?? dto.invoiceLines ?? dto.items ?? [];
                    setInvoice({
                        invoiceID: dto.invoiceID ?? dto.InvoiceID ?? dto.primaryKeyID ?? Number(id),
                        invoiceNo: dto.invoiceNo ?? dto.InvoiceNo ?? dto.invoiceNumber ?? "",
                        invoiceDate: dto.invoiceDate ?? dto.InvoiceDate ?? null,
                        customerName: dto.customerName ?? dto.CustomerName ?? "",
                        address: dto.address ?? dto.Address ?? "",
                        city: dto.city ?? dto.City ?? "",
                        notes: dto.notes ?? dto.Notes ?? "",
                        taxPercentage: Number(dto.taxPercentage ?? dto.TaxPercentage ?? 0),
                        taxAmount: Number(dto.taxAmount ?? dto.TaxAmount ?? 0),
                        subTotal: Number(dto.subTotal ?? dto.SubTotal ?? 0),
                        invoiceAmount: Number(dto.invoiceAmount ?? dto.InvoiceAmount ?? 0),
                        lines: (Array.isArray(lines) ? lines : []).map((ln: any, i: number) => ({
                            rowNo: ln.rowNo ?? ln.RowNo ?? ln.RowNumber ?? (i + 1),
                            description: ln.description ?? ln.Description ?? "",
                            itemID: ln.itemID ?? ln.ItemID ?? null,
                            quantity: Number(ln.quantity ?? ln.Quantity ?? ln.qty ?? 0),
                            rate: Number(ln.rate ?? ln.Rate ?? ln.saleRate ?? 0),
                            discountPct: Number(ln.discountPct ?? ln.DiscountPct ?? 0),
                            amount: Number(ln.amount ?? ln.Amount ?? ((Number(ln.quantity ?? 0) * Number(ln.rate ?? 0)) - ((Number(ln.quantity ?? 0) * Number(ln.rate ?? 0) * Number(ln.discountPct ?? 0)) / 100)))
                        }))
                    });
                }
            } catch (err) {
                console.error("Failed loading invoice for print", err);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        if (id) load();
        else setLoading(false);

        return () => { mounted = false; };
    }, [id]);

    useEffect(() => {
        if (!loading && invoice) {
            const auto = searchParams.get("autoprint");
            if (auto === "1") {
                // ensure DOM painted before print
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => window.print());
                });
            }
        }
    }, [loading, invoice, searchParams]);


    if (loading) return <Box sx={{ p: 3 }}><Typography>Loading...</Typography></Box>;
    if (!invoice) return <Box sx={{ p: 3 }}><Typography>Invoice not found.</Typography></Box>;

    return (
        <Box sx={{ p: { xs: 1, md: 3 }, bgcolor: "background.paper" }}>
            <Paper className="print-root" sx={{ p: 2, maxWidth: 900, margin: "0 auto" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: "bold" }}>Invoice</Typography>
                        <Typography variant="subtitle2">Invoice No: <strong>{invoice.invoiceNo}</strong></Typography>
                        <Typography variant="body2">Date: {invoice.invoiceDate ? dayjs(invoice.invoiceDate).format("DD-MMM-YYYY") : "-"}</Typography>
                    </Box>
                    <Box sx={{ textAlign: "right" }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{invoice.customerName}</Typography>
                        <Typography variant="body2">{invoice.address}</Typography>
                        <Typography variant="body2">{invoice.city}</Typography>
                    </Box>
                </Box>

                <Divider sx={{ my: 1 }} />

                <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", mb: 2 }}>
                    <Box component="thead">
                        <Box component="tr">
                            <Box component="th" sx={{ textAlign: "left", p: 1, borderBottom: "1px solid", borderColor: "divider" }}>#</Box>
                            <Box component="th" sx={{ textAlign: "left", p: 1, borderBottom: "1px solid", borderColor: "divider" }}>Description</Box>
                            <Box component="th" sx={{ textAlign: "right", p: 1, borderBottom: "1px solid", borderColor: "divider" }}>Qty</Box>
                            <Box component="th" sx={{ textAlign: "right", p: 1, borderBottom: "1px solid", borderColor: "divider" }}>Rate</Box>
                            <Box component="th" sx={{ textAlign: "right", p: 1, borderBottom: "1px solid", borderColor: "divider" }}>Disc %</Box>
                            <Box component="th" sx={{ textAlign: "right", p: 1, borderBottom: "1px solid", borderColor: "divider" }}>Amount</Box>
                        </Box>
                    </Box>
                    <Box component="tbody">
                        {invoice.lines.map((ln: any, i: number) => (
                            <Box component="tr" key={i}>
                                <Box component="td" sx={{ p: 1, verticalAlign: "top" }}>{ln.rowNo}</Box>
                                <Box component="td" sx={{ p: 1, verticalAlign: "top" }}>{ln.description || `Item ${ln.itemID ?? ""}`}</Box>
                                <Box component="td" sx={{ p: 1, textAlign: "right", verticalAlign: "top" }}>{Number(ln.quantity || 0).toFixed(2)}</Box>
                                <Box component="td" sx={{ p: 1, textAlign: "right", verticalAlign: "top" }}>{formatMoney(Number(ln.rate || 0), currencySymbol)}</Box>
                                <Box component="td" sx={{ p: 1, textAlign: "right", verticalAlign: "top" }}>{Number(ln.discountPct || 0).toFixed(2)}</Box>
                                <Box component="td" sx={{ p: 1, textAlign: "right", verticalAlign: "top" }}>{formatMoney(Number(ln.amount || 0), currencySymbol)}</Box>
                            </Box>
                        ))}
                    </Box>
                </Box>

                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                    <Box sx={{ width: 360 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
                            <Typography variant="body2">Sub Total</Typography>
                            <Typography variant="body2">{formatMoney(invoice.subTotal ?? 0, currencySymbol)}</Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
                            <Typography variant="body2">Tax ({Number(invoice.taxPercentage ?? 0).toFixed(2)}%)</Typography>
                            <Typography variant="body2">{formatMoney(invoice.taxAmount ?? 0, currencySymbol)}</Typography>
                        </Box>
                        <Divider sx={{ my: 1 }} />
                        <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>Total</Typography>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>{formatMoney(invoice.invoiceAmount ?? 0, currencySymbol)}</Typography>
                        </Box>
                    </Box>
                </Box>

                {invoice.notes && (
                    <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2">Notes</Typography>
                        <Typography variant="body2">{invoice.notes}</Typography>
                    </>
                )}

                <Box sx={{ display: "flex", gap: 1, mt: 3 }}>
                    <Button variant="contained" onClick={() => window.print()}>Print</Button>
                    <Button variant="outlined" onClick={() => navigate(-1)}>Close</Button>
                </Box>
            </Paper>

            <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-root, .print-root * { visibility: visible; }
          .print-root { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
        </Box>
    );
}
