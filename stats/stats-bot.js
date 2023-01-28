import ethers from "ethers";
import express from "express";
import chalk from "chalk";
import dotenv from "dotenv";
import fs from "fs";
import { exit } from "process";

let count = 0;
let writer = "";

const app = express();
dotenv.config();

//window.location.href = "http://example.com/";

let addressArray = [];
const data = {
  WBNB: process.env.WBNB_CONTRACT, //wbnn

  to_PURCHASE: process.env.TO_PURCHASE, // token that you will purchase = BUSD for test '0xe9e7cea3dedca5984780bafc599bd69add087d56'

  AMOUNT_OF_WBNB: process.env.AMOUNT_OF_WBNB, // how much you want to buy in WBNB

  factory: process.env.FACTORY, //PancakeSwap V2 factory

  router: process.env.ROUTER, //PancakeSwap V2 router

  recipient: process.env.YOUR_ADDRESS, //your wallet address,

  Slippage: process.env.SLIPPAGE, //in Percentage

  gasPrice: ethers.utils.parseUnits(`${process.env.GWEI}`, "gwei"), //in gwei

  gasLimit: process.env.GAS_LIMIT, //at least 21000

  minBnb: process.env.MIN_LIQUIDITY_ADDED, //min liquidity added

  approveNum: ethers.utils.parseUnits(`${process.env.TO_APPROVE}`), //
};
let initialLiquidityDetected = false;
let jmlBnb = 0;
const bscMainnetUrl = "https://bsc-dataseed1.defibit.io/"; //https://bsc-dataseed1.defibit.io/ https://bsc-dataseed.binance.org/
const wss = "wss://bsc-ws-node.nariox.org:443";
let tokenIn, tokenOut, pairAddress;

const mnemonic =
  "Your menmonic phrase";

const provider = new ethers.providers.WebSocketProvider(wss);
const wallet = ethers.Wallet.fromMnemonic(mnemonic);
const account = wallet.connect(provider);
const factory = new ethers.Contract(
  data.factory,
  [
    "event PairCreated(address indexed token0, address indexed token1, address pair, uint)",
    "function getPair(address tokenA, address tokenB) external view returns (address pair)",
  ],
  account
);

const router = new ethers.Contract(
  data.router,
  [
    "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  ],
  account
);
const erc = new ethers.Contract(
  data.WBNB,
  [
    {
      constant: true,
      inputs: [{ name: "_owner", type: "address" }],
      name: "balanceOf",
      outputs: [{ name: "balance", type: "uint256" }],
      payable: false,
      type: "function",
    },
    "function approve(address spender, uint amount) public returns(bool)",
  ],
  account
);

factory.on("PairCreated", async (token0, token1, pairAddressx) => {
  console.log(`
    New pair detected
    =================
    token0: ${token0}
    token1: ${token1}
    pairAddress: ${pairAddressx}
  `);
  //The quote currency needs to be WBNB (we will pay with WBNB)

  if (token0 === data.WBNB) {
    console.log("found token");
    console.log(token1);
    tokenIn = token0;
    tokenOut = token1;
    pairAddress = pairAddressx;
  }

  if (token1 == data.WBNB) {
    console.log("found token");
    console.log(token0);
    tokenIn = token1;
    tokenOut = token0;
    pairAddress = pairAddressx;
  }

  //The quote currency is not WBNB
  if (typeof tokenIn === "undefined") {
    console.log(" not found token");
    return;
  } else {
    run();
  }
});

const run = async () => {
  console.log("starting checkLiq");
  await checkLiq();
};

const getInfo = (tokenOut) => {
  const tokenInfo = new ethers.Contract(
    tokenOut.toString(),
    [
      {
        constant: true,
        inputs: [{ name: "_owner", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "balance", type: "uint256" }],
        payable: false,
        type: "function",
      },
      "function approve(address spender, uint amount) public returns(bool)",
    ],
    account
  );
};
let checkLiq = async () => {
  if (pairAddress !== null && pairAddress !== undefined) {
    // console.log("pairAddress.toString().indexOf('0x0000000000000')", pairAddress.toString().indexOf('0x0000000000000'));
    if (pairAddress.toString().indexOf("0x0000000000000") > -1) {
      console.log(
        chalk.red(`pairAddress ${pairAddress} not detected. Auto restart`)
      );
      return;
    }
  }

  const pairBNBvalue = await erc.balanceOf(pairAddress);
  jmlBnb = ethers.utils.formatEther(pairBNBvalue);
  var today = new Date();
  var time =
    today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
  console.log(tokenOut + ` ` + `value BNB : ${jmlBnb}` + ` ` + time + "\n");

  writer += tokenOut + ` ` + `value BNB : ${jmlBnb}` + ` ` + time + "\n";
  count += 1;

  if (parseInt(jmlBnb) > parseInt(data.minBnb)) {
    getInfo(tokenOut);
  } else {
    initialLiquidityDetected = false;
    console.log(" run again...");
  }
};

const PORT = 5000;

app.listen(
  PORT,
  console.log(
    chalk.yellow(
      `Listening for Liquidity Addition to token ${data.to_PURCHASE}`
    )
  )
);
