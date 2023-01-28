const ethers = require("ethers");
const express = require("express");
const chalk = require("chalk");
const dotenv = require("dotenv");
const inquirer = require("inquirer");
const fs = require("fs");
var player = require("play-sound")((opts = {}));

const app = express();
dotenv.config();
let counter;
fs.readFile("counter.txt", function (err, buf) {
  counter = parseFloat(buf.toString());
});

const addressArrayBNB = [];
const addressArrayBUSD = [];

const addAddress = (address, addressArray) => {
  let index;
  for (var i = 0; i < addressArray.length; i++) {
    if (address === addressArray[i]) {
      index = i;
    }
  }
  if (index === undefined) {
    if (addressArray.length == 1000) {
      addressArray.pop();
    }
    addressArray.unshift(address);
  }
};

const data = {
  WBNB: process.env.WBNB_CONTRACT, //wbnn

  BUSD: process.env.BUSD_CONTRACT, //busd

  to_PURCHASE: process.env.TO_PURCHASE, // token that you will purchase = BUSD for test '0xe9e7cea3dedca5984780bafc599bd69add087d56'

  AMOUNT_OF_WBNB: process.env.AMOUNT_OF_WBNB, // how much you want to buy in WBNB

  factory: process.env.FACTORY, //PancakeSwap V2 factory

  router: process.env.ROUTER, //PancakeSwap V2 router

  recipient: process.env.YOUR_ADDRESS, //your wallet address,

  Slippage: process.env.SLIPPAGE, //in Percentage

  gasPrice: ethers.utils.parseUnits(`${process.env.GWEI}`, "gwei"), //in gwei

  gasLimit: process.env.GAS_LIMIT, //at least 21000

  minBnb: process.env.MIN_LIQUIDITY_ADDED, //min liquidity added

  minBusd: process.env.MIN_LIQUIDITY_ADDED2,

  approveNum: ethers.utils.parseUnits(`${process.env.TO_APPROVE}`), //
};
let initialLiquidityDetected = false;
let jmlBnb,
  jmlBusd = 0;

const wss =
  "wss://patient-sparkling-fire.bsc.quiknode.pro/bca1fba1f92cf736f1b9bbd4814a4124c2eca5f7/";

let tokenIn, tokenOut, pairAddress, otherToken, pairAddressOther;

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

const erc2 = new ethers.Contract(
  data.BUSD,
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
  var today = new Date();
  var time =
    today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
  console.log(time);
  console.log(`
          New pair detected
          =================
          token0: ${token0}
          token1: ${token1}
          pairAddress: ${pairAddressx}
        `);

  tokenIn = "";
  tokenOut = "";

  if (token0 === data.WBNB) {
    console.log("found token BNB");
    tokenIn = token0;
    tokenOut = token1;
    otherToken = data.BUSD;
    pairAddress = pairAddressx;
    addAddress(token1, addressArrayBNB);
    if (addressArrayBUSD.includes(token1)) {
      console.log(chalk.blue("You find it bro"));
      player.play("audio_file.mp3", function (err) {
        if (err) throw err;
      });
    }
  }

  if (token1 === data.WBNB) {
    console.log("found token BNB");
    tokenIn = token1;
    tokenOut = token0;
    otherToken = data.BUSD;
    pairAddress = pairAddressx;
    addAddress(token0, addressArrayBNB);
    if (addressArrayBUSD.includes(token0)) {
      console.log(chalk.blue("You find it bro"));
      player.play("audio_file.mp3", function (err) {
        if (err) throw err;
      });
    }
  }

  if (token0 === data.BUSD) {
    console.log(chalk.green("found token BUSD"));
    console.log("by the way Gabi is gay ");
    tokenIn = token0;
    tokenOut = token1;
    otherToken = data.WBNB;
    pairAddress = pairAddressx;
    addAddress(token1, addressArrayBUSD);
    if (addressArrayBNB.includes(token1)) {
      console.log(chalk.blue("You find it bro"));
      player.play("audio_file.mp3", function (err) {
        if (err) throw err;
      });
    }
  }

  if (token1 === data.BUSD) {
    console.log(chalk.green("found token BUSD"));
    tokenIn = token1;
    tokenOut = token0;
    otherToken = data.WBNB;
    pairAddress = pairAddressx;
    addAddress(token0, addressArrayBUSD);
    if (addressArrayBNB.includes(token0)) {
      console.log(chalk.blue("You find it bro"));
      player.play("audio_file.mp3", function (err) {
        if (err) throw err;
      });
    }
  }

  //The quote currency is not WBNB
  if (typeof tokenIn == "undefined" || tokenIn === "") {
    console.log(" not found token");
    return;
  } else {
    const contractBuy = new ethers.Contract(
      tokenOut,
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
        "function totalSupply() external view returns (uint256)",
      ],
      account
    );
    const totalSupplyT = await contractBuy.totalSupply();
    const totalSupply = ethers.utils.formatEther(totalSupplyT);
    console.log("totalSuply is", totalSupply);

    run();
  }
});

const run = async () => {
  console.log("starting checkLiq");
  await checkLiqPin();
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let checkLiqPin = async () => {
  if (tokenIn === data.WBNB) {
    const pairBNBvalue = await erc.balanceOf(pairAddress);
    jmlBnb = ethers.utils.formatEther(pairBNBvalue);
    console.log(`value BNB : ${jmlBnb}`);

    console.log("value du if : ", parseFloat(jmlBnb) > parseFloat(data.minBnb));

    if (parseFloat(jmlBnb) > parseFloat(data.minBnb)) {
      await checkLiqOther(otherToken, tokenOut);
    } else {
      initialLiquidityDetected = false;
      console.log(" run again...");
      wait = 0;
      return;
    }
  } else {
    const pairBUSDvalue = await erc2.balanceOf(pairAddress);
    jmlBusd = ethers.utils.formatEther(pairBUSDvalue);
    console.log(
      "value du if : ",
      parseFloat(jmlBusd) > parseFloat(data.minBusd)
    );
    console.log(`value BUSD : ${jmlBusd}`);
    if (parseFloat(jmlBusd) > parseFloat(data.minBusd)) {
      player.play("audio_file.mp3", function (err) {
        if (err) throw err;
      });
      await checkLiqOther(otherToken, tokenOut);
    } else {
      initialLiquidityDetected = false;
      console.log(" run again...");
      wait = 0;
      return;
    }
  }
};

let checkLiqOther = async (otherTokenbis, tokenOutbis) => {
  console.log(`
    Checcking
    =================
    outherToken: ${otherTokenbis}
    tokenTouy: ${tokenOutbis}
    
  `);
  let pairAddressOther;
  if (otherTokenbis === data.WBNB) {
    pairAddressOther = await factory.getPair(otherTokenbis, tokenOutbis);
  } else {
    pairAddressOther = await factory.getPair(otherTokenbis, tokenOutbis);
  }
  if (pairAddressOther !== null && pairAddressOther !== undefined) {
    // console.log("pairAddress.toString().indexOf('0x0000000000000')", pairAddress.toString().indexOf('0x0000000000000'));
    if (pairAddressOther.toString().indexOf("0x0000000000000") > -1) {
      console.log(
        chalk.red(
          `pairAddressOther ${pairAddressOther} not detected. Auto restart for token ${tokenOutbis}`
        )
      );
      return;
    }
  } else {
    console.log(
      chalk.blue(
        ` Liquidity found on other token pairAddress: ${pairAddressOther}`
      )
    );
  }

  if (otherTokenbis === data.WBNB) {
    const pairBNBvalue = await erc.balanceOf(pairAddressOther);
    jmlBnb = ethers.utils.formatEther(pairBNBvalue);
    console.log(`value BNB : ${jmlBnb}`);

    console.log("value du if : ", parseFloat(jmlBnb) > parseFloat(data.minBnb));

    buyAction(data.WBNB, tokenOutbis);
    player.play("audio_file.mp3", function (err) {
      if (err) throw err;
    });
  } else {
    const pairBUSDvalue = await erc2.balanceOf(pairAddressOther);
    jmlBusd = ethers.utils.formatEther(pairBUSDvalue);
    console.log(`value BUSD : ${jmlBusd}`);

    console.log(
      "value du if : ",
      parseFloat(jmlBusd) > parseFloat(data.minBusd)
    );
    player.play("audio_file.mp3", function (err) {
      if (err) throw err;
    });
    setTimeout(() => buyAction(data.WBNB, tokenOutbis), 3000);
  }
};
let buyAction = async (tokenInBis, tokenOutBis) => {
  console.log(initialLiquidityDetected);
  if (initialLiquidityDetected === true) {
    console.log("not buy cause already buy");
    wait = 0;
    return null;
  }
  console.log("ready to buy");
  try {
    initialLiquidityDetected = true;

    let amountOutMin = 0;
    //We buy x amount of the new token for our wbnb
    const amountIn = ethers.utils.parseUnits(`${data.AMOUNT_OF_WBNB}`, "ether");
    if (parseFloat(data.Slippage) !== 0) {
      const amounts = await router.getAmountsOut(amountIn, [
        tokenInBis,
        tokenOutBis,
      ]);
      //Our execution price will be a bit different, we need some flexbility
      const amountOutMin = amounts[1].sub(amounts[1].div(`${data.Slippage}`));
    }

    console.log(
      chalk.green.inverse(`Start to buy \n`) +
        `Buying Token
       =================
       tokenIn: ${(amountIn * 1e-18).toString()} ${tokenInBis} (BNB)
       tokenOut: ${amountOutMin.toString()} ${tokenOutBis}
     `
    );

    console.log("Processing Transaction.....");
    console.log(
      chalk.yellow(`amountIn: ${amountIn * 1e-18} ${tokenInBis} (BNB)`)
    );
    console.log(chalk.yellow(`amountOutMin: ${amountOutMin}`));
    console.log(chalk.yellow(`tokenIn: ${tokenInBis}`));
    console.log(chalk.yellow(`tokenOut: ${tokenOutBis}`));
    console.log(chalk.yellow(`data.recipient: ${data.recipient}`));
    console.log(chalk.yellow(`data.gasLimit: ${data.gasLimit}`));
    console.log(chalk.yellow(`data.gasPrice: ${data.gasPrice}`));

    const tx =
      await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        //uncomment this if you want to buy deflationary token
        // const tx = await router.swapExactTokensForTokens( //uncomment here if you want to buy token
        amountIn,
        amountOutMin,
        [tokenInBis, tokenOutBis],
        data.recipient,
        Date.now() + 1000 * 60 * 5, //5 minutes
        {
          gasLimit: data.gasLimit,
          gasPrice: data.gasPrice,
          nonce: null, //set you want buy at where position in blocks
        }
      );
    const receipt = await tx.wait();
    console.log(
      `Transaction receipt : https://www.bscscan.com/tx/${receipt.logs[1].transactionHash}`
    );
    counter -= 1;
    if (counter == 0) {
      counter = 1000;
    }
    fs.writeFile("counter.txt", counter.toString(), (err) => {
      if (err) console.log(err);
      console.log("Successfully Written to File.");
    });
    return;
  } catch (err) {
    let error = JSON.parse(JSON.stringify(err));
    console.log(`Error caused by : 
    {
    reason : ${error.reason},
    transactionHash : ${error.transactionHash}
    message : Please check your BNB/WBNB balance, maybe its due because insufficient balance or approve your token manually on pancakeSwap
    }`);
    console.log(error);

    inquirer
      .prompt([
        {
          type: "confirm",
          name: "runAgain",
          message: "Do you want to run again thi bot?",
        },
      ])
      .then((answers) => {
        if (answers.runAgain === true) {
          console.log(
            "= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = ="
          );
          console.log("Run again");
          console.log(
            "= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = ="
          );
          initialLiquidityDetected = false;
        } else {
          process.exit();
        }
      });
  }
};

const PORT = 5001;
