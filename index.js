const axios = require('axios');
const WSClient = require('websocket').client;

function tap(fn) {
    return function (value) {
        fn(value);

        return value;
    }
}

function requestFactory({token, apiUrl}) {
    return function (method, apiPath, data = undefined) {
        function printResponse(res) {
            const {status, data} = res;

            console.log(status, apiPath, JSON.stringify(data));
        }

        return axios({
            method,
            data,
            url: apiUrl + apiPath,
            headers: {
                Authorization: `Bearer ${token}`
            },
        })
            .then(tap(printResponse))
            .then(({data}) => data)
            .catch(err => {
                console.error(err);

                throw err;
            });
    };
}

const makeRequest = requestFactory({token: process.env.TOKEN, apiUrl: process.env.API_URL});

function register() {
    return makeRequest('POST', '/sandbox/register');
}

function loadPortfolio() {
    return makeRequest('GET', '/portfolio');
}

function clearPortfolio() {
    return makeRequest('POST', '/sandbox/clear');
}

function loadPortfolioCurrencies() {
    return makeRequest('GET', '/portfolio/currencies');
}

function setCurrency(currency, balance) {
    return makeRequest('POST', '/sandbox/currencies/balance', {currency, balance});
}

function loadOrders() {
    return makeRequest('GET', '/orders');
}

function findStockByTicker(ticker) {
    return makeRequest('GET', `/market/search/by-ticker?ticker=${ticker}`);
}


function createOrder(operation, figi, lots, price) {
    return makeRequest('POST', `/orders/limit-order?figi=${figi}`, {operation, lots, price});
}

register()
    .then(async () => {
        await clearPortfolio();

        await setCurrency('RUB', 100000);
        await setCurrency('USD', 10000);
        await loadPortfolio();
        await loadPortfolioCurrencies();
        await loadOrders();

        const result = await findStockByTicker('BABA');
        const alibaba = result.payload.instruments[0];
        const {figi} = alibaba;

        await createOrder('Buy', figi, 10, 1);

        await loadPortfolio();
        await loadPortfolioCurrencies();
        await loadOrders();

        const wsClient = new WSClient();

        wsClient.on('connectFailed', function(error) {
            console.log('Connect Error: ' + error.toString());
        });

        wsClient.on('connect', function (connection) {
            console.log('WebSocket Client Connected');
            connection.on('error', function (error) {
                console.log("Connection Error: " + error.toString());
            });
            connection.on('close', function () {
                console.log('echo-protocol Connection Closed');
            });
            connection.on('message', function (message) {
                console.log(JSON.stringify(message));
            });

            connection.sendUTF(JSON.stringify({
                figi,
                event: "candle:subscribe",
                interval: "1min"
            }));
        });

        wsClient.connect('wss://api-invest.tinkoff.ru/openapi/md/v1/md-openapi/ws', undefined, undefined, {Authorization: `Bearer ${process.env.TOKEN}`});
    });
