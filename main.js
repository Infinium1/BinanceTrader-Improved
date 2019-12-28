console.clear();
const XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
const CryptoJS = require("crypto-js");
const fs = require("fs");
const config = require("./config.json");

if (config.backtestMode) {
    backtest();
    return;
} else {
    run();
    setInterval(() => {
        run();
    }, (config.repeatTime * 60 * 1000));
}

function run() {
    displayNewRun();
    const dataQueryString = `&symbol=${config.symbol}&interval=${config.interval}&limit=500`;
    const url = "https://api.binance.us/api/v3/klines?" + dataQueryString;

    const request = new XMLHttpRequest();
    request.open('GET', `${url}`, true);
    request.onload = function () {
        const data = JSON.parse(this.responseText);
        const MACDs = calcMACD(data);
        const Stochastic = calcStoch(data);
        const RSI = calcRSI(data);
        console.log(RSI);
    }
    request.send();
}

function backtest() {
    displayNewRun();
    const dataQueryString = `&symbol=${config.symbol}&interval=${config.interval}&limit=10`;
    const url = "https://api.binance.us/api/v3/klines?" + dataQueryString;

    const request = new XMLHttpRequest();
    request.open('GET', `${url}`, true);
    request.onload = function () {
        let data = JSON.parse(this.responseText);
        console.log(data);
        /*Open time
        Open
        High
        Low
        Close*
        Volume
        Close time
        Quote asset volume
        Number of trades
        Taker buy base asset volume
        Taker buy quote asset volume
        Ignore*/
    }
    request.send();
}

function displayNewRun() {
    console.log("-----------------------------------------------------------------");
    const runTime = new Date();
    console.log(`New run: ${runTime.getMonth() + 1}/${runTime.getDate()} ${runTime.getHours()}:${runTime.getMinutes()}:${runTime.getSeconds()}`);
}

function calcMACD(data) {
    const ema12 = calcEMA12(data);
    const ema26 = calcEMA26(data);
    /*let MACDs = [];

    for (let i = 0; i < ema26.length; i++) {
        MACDs.push(ema12[i] - ema26[i]);
    }*/

    return {
        ema12,
        ema26
    };
}

function calcStoch(data) {
    let closeVals = [],
        highVals = [];
    /* %K=(H14−L14 / C−L14​) × 100 */
    data.forEach(kline => {
        closeVals.push(kline[4]);
        highVals.push(kline[2]);
    });

    let pKs = [];
    let pDs = [];
    for (let i = 0; i < data.length - 13; i++) { // The dntire dataset
        let tempLowArr = [];
        let tempHighArr = [];
        for (let j = i; j < i + 14; j++) { // Groups of 14 (Repeats 14 times)
            const newKline = data[j];

            tempLowArr.push(newKline[3]);
            tempHighArr.push(newKline[2]);
        }

        let tempPk, tempPd, lowTrade, highTrade;
        let recentTradeClose = data[i + 13][4]; // Most recent trade in the group of 14
        lowTrade = Math.min(...tempLowArr);
        highTrade = Math.max(...tempHighArr);

        tempPk = ((recentTradeClose - lowTrade) / (highTrade - lowTrade)) * 100;
        pKs.push(tempPk);

        if (i < 2) {
            tempPd = pKs[0];
        } else {
            tempPd = (pKs[pKs.length - 1] + pKs[pKs.length - 2] + pKs[pKs.length - 3]) / 3;
        }
        pDs.push(tempPd);
    }
    return {pKs, pDs};
}

function calcRSI(data) {
    let gains = [];
    let losses = [];

    for (let i = 0; i < data.length; i++) { // Calculating losses and gains
        const kline = data[i];
        let prevKline;
        if (i > data.length - 15 && i < data.length) { // Most recent 14 period
            if (data[i - 1]) {
                prevKline = data[i - 1];
            } else {
                prevKline = data[i];
                prevKline[1] -= 100;
                prevKline[2] -= 100;
                prevKline[3] -= 100;
                prevKline[4] -= 100;
            }


            if (kline[4] - prevKline[4] > 0) {
                gains.push(kline[4] - prevKline[4]);
                losses.push(0);
            } else {
                losses.push(Math.abs(kline[4] - prevKline[4]));
                gains.push(0);
            }
        }
    }

    let totGains = 0;
    let totLosses = 0;

    gains.forEach(gain => {
        totGains += gain;
    });
    losses.forEach(loss => {
        totLosses += loss;
    });

    let uArr = [];
    let dArr = [];
    let a = 1 / 14;

    for (let i = 1; i < 11; i++) {
        uArr.push(gains[gains.length - i]);
        dArr.push(losses[losses.length - i]);        
    }

    let avgG;
    let avgL;

    for (let i = 1; i < 10; i++) {
        avgG = a * uArr[uArr.length - i] * avgG;
        avgL = a * dArr[dArr.length - i] * avgL;
    }

    avgG = totGains / 14;
    avgL = totLosses / 14;
    let rs = avgG / avgL;
    let rsi = 100 - (100 / (1 + rs));

    return rsi;
}

function calcEMA12(data) {
    let closeVals = [];
    data.forEach(kline => {
        // Pushing closing values (4th pos)
        closeVals.push(parseInt(kline[4]));
    });
    /*
        EMAToday ​=​ (ValueToday​ ∗ (Smoothing / (1 + Days)) + EMAYesterday * (1 - (Smoothing / (1 + Days))))
    */

    let firstTot = 0;
    let ema12s = [];
    for (let i = 0; i < 12; i++) {
        firstTot += closeVals[i];
    }

    ema12s.push(firstTot / 12);

    for (let i = 12; i < closeVals.length; i++) {
        let temp = closeVals[i] * (2 / (1 + 12)) + ema12s[ema12s.length - 1] * (1 - (2 / (12 + 1)));
        ema12s.push(temp);
    }
    return ema12s;
}

function calcEMA26(data) {
    let closeVals = [];
    data.forEach(kline => {
        // Pushing closing values (4th pos)
        closeVals.push(parseInt(kline[4]));
    });

    let firstTot = 0;
    let ema26s = [];
    for (let i = 0; i < 26; i++) {
        firstTot += closeVals[i];
    }

    ema26s.push(firstTot / 26);

    for (let i = 26; i < closeVals.length; i++) {
        let temp = closeVals[i] * (2 / (1 + 26)) + ema26s[ema26s.length - 1] * (1 - (2 / (26 + 1)));
        ema26s.push(temp);
    }
    return ema26s;
}