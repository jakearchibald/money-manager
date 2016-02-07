const promisify = require("promisify-node");
const csvParser = promisify(require('csv-parse'));
const fs = require("fs");
const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const express = require('express');
const nunjucks = require('nunjucks');

function readData() {
  return readdir(`${__dirname}/data`).then(results => {
    return Promise.all(
      results.map(filename => {
        return readFile(`${__dirname}/data/${filename}`, 'utf8').then(data => {
          return csvParser(data, {columns: true});
        });
      })
    );
  }).then(data => {
    data = data.reduce((all, dataItem) => {
      return all.concat(dataItem);
    }, []);

    data.forEach(item => {
      const date = item['Transaction Date'];
      const result = /^(\d+)\/(\d+)\/(\d+)$/.exec(date);
      item['Transaction Date'] = new Date(result[3], result[2] - 1, result[1]);
      ['Debit Amount', 'Credit Amount'].forEach(prop => {
        item[prop] = Number(item[prop]);
      });
    });
    return data;
  });
}

function groupByDate(data, starting, groupSize) {
  const result = [];
  var from = starting;
  var to = starting;
  var resultItem;

  data = data.sort((a, b) => {
    return a['Transaction Date'] - b['Transaction Date'];
  });

  for (var item of data) {
    while (!resultItem || item['Transaction Date'] > to) {
      from = to;
      to = new Date(from.valueOf() + groupSize);
      resultItem = {
        starting: from,
        entries: [],
        totalOut: 0,
        totalIn: 0
      };
      result.push(resultItem);
    }
    resultItem.entries.push(item);
    resultItem.totalOut += item['Debit Amount'] || 0;
    resultItem.totalIn += item['Credit Amount'] || 0;
  }

  var runningTotal = 0;

  result.forEach(group => {
    runningTotal -= group.totalOut;
    runningTotal += group.totalIn;
    group.runningTotal = runningTotal;
  })

  return result;
}

function createFakeEntries(starting, ending, frequency, obj) {
  const entries = [];

  for (var date = starting; date < ending; date = new Date(date.valueOf() + frequency)) {
    entries.push(Object.assign({
      "Transaction Date": date
    }, obj));
  }

  return entries;
}

const app = express();
const day = 1000 * 60 * 60 * 24;
const env = nunjucks.configure('views', {
  autoescape: true,
  express: app,
  noCache: true
});
require('nunjucks-date-filter').install(env);

app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
  readData().then(data => {
    data = data.concat(createFakeEntries(
      new Date('2016-01-03'),
      new Date('2016-10-02'),
      day * 7,
      {
        "Transaction Description": "Allowance",
        "Credit Amount": 14549.21 / 39
      }
    ));
    res.render('index.html', {
      data,
      groupedData: groupByDate(data, new Date('2016-01-03'), day * 7)
    });
  }).catch(err => {
    res.status(500).send("Something went wrong, see console");
    console.log(err);
  });
});


app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
