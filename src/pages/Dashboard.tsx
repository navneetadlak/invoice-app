import React, { useEffect, useState } from "react";
import { Box, Grid, Paper, Typography } from "@mui/material";
import InvoiceService from "../services/invoice.service";

export default function Dashboard() {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(()=> {
    (async () => {
      try {
        const res = await InvoiceService.getMetrices();
        setMetrics(res.data);
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Dashboard</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2">Total Invoices</Typography>
            <Typography variant="h5">{metrics?.totalInvoices ?? "-"}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2">Total Revenue</Typography>
            <Typography variant="h5">{metrics?.totalRevenue ?? "-"}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2">Avg Invoice</Typography>
            <Typography variant="h5">{metrics?.avgInvoice ?? "-"}</Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
