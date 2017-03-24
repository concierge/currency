const request = require('request');
const currencyInfo = require('./currencyInfo.json');

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

const re = (() => {
    const number = '(-?[0-9](,|[0-9])*(.[0-9]+)?) ?';

    const aliases = [];
    currencyInfo.aliasRegexes = {}
    for (let key in currencyInfo.aliases) {
        // Save the RegExp so we only make it once.
        currencyInfo.aliasRegexes[key] = new RegExp(key, 'i');
        aliases.push(key);
    }
    const currencies = `(${supportedCurrencies.join('|')}|${aliases.join('|')})`;
    const regex = `${number} ?${currencies}( in ${currencies})?`;
    return new RegExp(regex, 'gi');
})();

const findCurrency = (cur) => {
    cur = cur.toUpperCase();
    // If cur is already a currency, return it.
    if (currencyInfo.names[cur]) return cur;

    // Otherwise, we need to find an alias:
    for (var alias in currencyInfo.aliases) {
        let regex = currencyInfo.aliasRegexes[alias];
        regex.lastIndex = 0;

        if (cur.match(regex)) {
            return currencyInfo.aliases[alias];
        }
    }

    return null;
};

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
        fromCurrency = findCurrency(match[4]),
        toCurrency = findCurrency(match[29]) || exports.config.defaultToCurrency;

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