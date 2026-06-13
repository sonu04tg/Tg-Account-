const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();

const API_KEY = "API_key";
const API_SECRET = "secrect";
const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;

async function getServerTime() {
    try {
        const { data } = await axios.get("https://api.binance.com/api/v3/time");
        return data.serverTime;
    } catch {
        return Date.now();
    }
}

async function getDepositByTxHash(txHash, serverTime) {
//	console.log("ok")
    const recvWindow = 60000;
    const query = `txId=${txHash}&timestamp=${serverTime}&recvWindow=${recvWindow}`;
    const signature = crypto
        .createHmac("sha256", API_SECRET)
        .update(query)
        .digest("hex");

    const url = `https://api.binance.com/sapi/v1/capital/deposit/hisrec?${query}&signature=${signature}`;

    const { data } = await axios.get(url, {
        headers: { "X-MBX-APIKEY": API_KEY }
    });

    return Array.isArray(data) ? data[0] : null;
}

async function getPayTransaction(startTime, serverTime, id) {
    const recvWindow = 60000;
    const query = `timestamp=${serverTime}&recvWindow=${recvWindow}&startTime=${startTime}&endTime=${serverTime}`;
    const signature = crypto
        .createHmac("sha256", API_SECRET)
        .update(query)
        .digest("hex");

    const url = `https://api.binance.com/sapi/v1/pay/transactions?${query}&signature=${signature}`;

    const { data } = await axios.get(url, {
        headers: { "X-MBX-APIKEY": API_KEY }
    });

    return data?.data?.find(tx => String(tx.orderId) === String(id)) || null;
}

app.get("/transaction", async (req, res) => {
    const { id, startTime } = req.query;

    if (!id) {
        return res.json({ success: false, message: "Missing id" });
    }

    const isTxHash = /^[a-zA-Z0-9]{40,}$/.test(id);

    try {
        const serverTime = await getServerTime();
        const finalStartTime = startTime
            ? Number(startTime)
            : serverTime - DEFAULT_WINDOW_MS;

        let transaction;

        if (isTxHash) {
            transaction = await getDepositByTxHash(id, serverTime);
        } else {
            transaction = await getPayTransaction(
                finalStartTime,
                serverTime,
                id
            );
        }

        if (!transaction) {
            return res.json({
                success: false,
                message: "Transaction not found"
            });
        }

        res.json({ success: true, transaction });

    } catch {
        res.json({
            success: false,
            message: "Unable to fetch transaction"
        });
    }
});

app.listen(3000, () => {
    console.log("Transaction service running on port 3000");
});
