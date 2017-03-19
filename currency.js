const request = require('request');

const currencyNames = {
    'EUR': 'Euro',
    'AUD': 'Australian Dollar',
    'BGN': 'Bulgarian Lev',
    'BRL': 'Brazilian Real',
    'CAD': 'Canadian Dollar',
    'CHF': 'Swiss Franc',
    'CNY': 'Chinese Yuan',
    'CZK': 'Czech Republic Koruna',
    'DKK': 'Danish Krone',
    'GBP': 'British Pound',
    'HKD': 'Hong Kong Dollar',
    'HRK': 'Croatian Kuna',
    'HUF': 'Hungarian Forint',
    'IDR': 'Indonesian Rupiah',
    'ILS': 'Israeli New Shekel ',
    'INR': 'Indian Rupee',
    'JPY': 'Japanese Yen',
    'KRW': 'South Korean Won',
    'MXN': 'Mexican Peso',
    'MYR': 'Malaysian Ringgit',
    'NOK': 'Norwegian Krone',
    'NZD': 'New Zealand Dollar',
    'PHP': 'Philippine Peso',
    'PLN': 'Polish Zloty',
    'RON': 'Romanian Leu',
    'RUB': 'Russian Ruble',
    'SEK': 'Swedish Krona',
    'SGD': 'Singapore Dollar',
    'THB': 'Thai Baht',
    'TRY': 'Turkish Lira',
    'USD': 'United States Dollar',
    'ZAR': 'South African Rand'
};

const supportedCurrencies = [
    'EUR',
    'AUD',
    'BGN',
    'BRL',
    'CAD',
    'CHF',
    'CNY',
    'CZK',
    'DKK',
    'GBP',
    'HKD',
    'HRK',
    'HUF',
    'IDR',
    'ILS',
    'INR',
    'JPY',
    'KRW',
    'MXN',
    'MYR',
    'NOK',
    'NZD',
    'PHP',
    'PLN',
    'RON',
    'RUB',
    'SEK',
    'SGD',
    'THB',
    'TRY',
    'USD',
    'ZAR'
];

const number = '(-?[0-9](,|[0-9])*(.[0-9]+)?) ?';
const currencies = `(${supportedCurrencies.join('|')})`;
const regex = `${number} ?${currencies}( in ${currencies})?`;
const re = new RegExp(regex, 'gi');

exports.match = (event, commandPrefix) => {
    let match = re.exec(event.body);
    re.lastIndex = 0;

    return match !== null;
};

exports.run = (api, event) => {
    // If no default currency has been specified, use NZD, 'cause it's cool.
    if (!exports.config.defaultToCurrency) {
        exports.config.defaultToCurrency = "NZD";
    }

    let match = re.exec(event.body),
        amount = match[1],
        fromCurrency = match[4],
        toCurrency = match[6] || exports.config.defaultToCurrency;

    re.lastIndex = 0;

    // If we don't have a to currency in the config or message, yell at the user
    // (it's always their fault).
    if (!toCurrency) {
        api.sendMessage("You don't seem to have a default to currency specified (either set one in the config.defaultToCurrency or specify it in the message)", event.thread_id);
        return;
    }

    // This should never happen but I'm paranoid.
    if (!amount || !fromCurrency) {
        api.sendMessage("That looks wrong. You should try harder.", event.thread_id);
        return;
    }

    getExchange()
        .then(result => {
            result = convert(fromCurrency, toCurrency, parseFloat(amount), result.rates);

            //If we couldn't convert, give up
            if (result.error) {
                api.sendMessage(result.error, event.thread_id);
                return;
            }

            api.sendMessage(`${amount} ${fromCurrency} is about ${result.result} ${toCurrency}`, event.thread_id);
        }, error => {
            //If we couldn't get the latest data, give up.
            api.sendMessage(error, event.thread_id);
        });
};

const convert = (f, to, amount, conversions) => {
    f = f.toUpperCase();
    to = to.toUpperCase();

    if (!conversions[f]) {
        return {
            error: "Unsupported currency '" + f + "'"
        };
    }

    if (!conversions[to]) {
        return {
            error: "Unsupported currency '" + to + "'"
        };
    }

    let a = amount / conversions[f] * conversions[to];
    a = Math.round(a * 100) / 100;

    return {
        result: a
    };
};

const getExchange = () => {
    return new Promise((accept, reject) => {
        request.get('http://api.fixer.io/latest', function (error, response, body) {
            if (response.statusCode === 200 && response.body) {
                const result = JSON.parse(response.body);
                // Add an entry for the Euro.
                result.rates.EUR = 1;
                accept(result);
            } else {
                reject("Couldn't talk to fixer.io for the exchange rate...");
            }
        });
    });
}