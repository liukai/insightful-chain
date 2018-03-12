const https = require("https");
const buildUrl = require("build-url");
const fs = require("fs");
const csvWriter = require("csv-write-stream");
const program = require("commander");

DEFAULT_OFFSET = 1000;

function constructUrl(address, action, apikey, params = {}) {
  const {page, offset, sort} = params;
  return buildUrl("https://api.etherscan.io", {
    path: "api",
    queryParams: {
      module: "account",
      apikey: apikey,
      page: page || 1,
      offset: offset || 10000,
      sort: sort || "desc",
      address,
      action
    }
  });
}

// read all the transactions from Etherscan
function fetchTransactions(address, action, apikey, outputFilename) {
  const writer = csvWriter();
  writer.pipe(fs.createWriteStream(outputFilename));

  const url = constructUrl(address, action, apikey);
  let page = 1; // important, the page starts from 1
  const offset = 5000;

  // TODO(kai) Etherscan has rate limit of 5 req/sec. Should add a rate limiter on
  // our side.
  const handleComplete = data => {
    const txs = JSON.parse(data).result;

    if (txs.length > 0) {
      txs.forEach(tx => writer.write(tx));
      page += 1;
      readFromEtherscan(address, action, apikey, handleComplete, {
        page,
        offset
      });
    } else {
      writer.end();
    }
  };

  readFromEtherscan(address, action, apikey, handleComplete, {page, offset});
}

function readFromEtherscan(address, action, apikey, onComplete, params = {}) {
  const url = constructUrl(address, action, apikey, params);
  https
    .get(url, resp => {
      let data = "";

      resp.on("data", chuck => (data += chuck));
      resp.on("end", () => {
        onComplete(data);
      });
    })
    .on("error", err => {
      console.log("Error: " + err.message);
    });
}

function writeAsCSV(data, outputFilename) {
  const writer = csvWriter();
  writer.pipe(fs.createWriteStream(outputFilename, {flags: "a"}));
  data.map(entry => {
    writer.write(entry);
  });
  writer.end();
}

function run() {
  program
    .version("0.1.0")
    .option("-k, --apikey <api-key>", "API Key")
    .option("-a, --account <account>", "API Key")
    .option("-i --internal", "fetching internal transactions")
    .option("-o --output <output>", "output file path")
    .parse(process.argv);

  fetchTransactions(
    program.account,
    program.internal ? "txlistinternal" : "txlist",
    program.apikey,
    program.output
  );
}

run();
