var request = require('request');

let supportedCurrencies = ['EUR',"AUD","BGN","BRL","CAD","CHF","CNY","CZK","DKK","GBP","HKD","HRK","HUF","IDR","ILS","INR","JPY","KRW","MXN","MYR","NOK","NZD","PHP","PLN","RON","RUB","SEK","SGD","THB","TRY","USD","ZAR"];

let conversions = null;
let number = '(-?[0-9](,|[0-9])+(.[0-9]+)?) ?';
let currencies = `(${supportedCurrencies.join('|')})`;

let regex = `${number} ?${currencies}( in ${currencies})?`;

let re = new RegExp(regex, 'gi');

exports.match = (event, commandPrefix) => {
    let match = re.exec(event.body);
    return match !== null;
};

exports.run = (api, event) => {
    var query = event.body.substr(10),
        parts = query.split(' ');

    //If we don't have the right number of parts, give up
    if (parts.length !== 4) {
        api.sendMessage("That looks wrong. You should try harder.", event.thread_id);
        return;
    }

    getExchange()
        .then(result => {
            //Add an entry for the Euro
            result.rates.EUR = 1;
            result = convert(parts[1], parts[3], parseInt(parts[0]), result.rates);

            //If we couldn't convert, give up
            if (result.error) {
            api.sendMessage(result.error, event.thread_id);
            return;
            }

            api.sendMessage("It's about " + result.result + ' ' + parts[3], event.thread_id);
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

    var a = amount/conversions[f] * conversions[to];
    a = Math.round(a*100) / 100;

    return {
        result: a
    };
};

const getExchange = () => {
    return new Promise((accept, reject) => {
        request.get('http://api.fixer.io/latest', function(error, response, body) {
            if (response.statusCode === 200 && response.body) {
                console.log(response.body);
                var result = JSON.parse(response.body);
                accept(result);
            }
            else {
                reject("Couldn't talk to fixer.io for the exchange rate...");
            }
        });
    });
}
