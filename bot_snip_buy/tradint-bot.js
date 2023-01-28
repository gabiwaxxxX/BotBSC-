import ethers from "ethers";
import express from "express";
import chalk from "chalk";
import dotenv from "dotenv";
import inquirer from "inquirer";
import fs from "fs";

const app = express();
dotenv.config();
let counter;
fs.readFile("counter.txt", function (err, buf) {
  counter = parseInt(buf.toString());
});

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

const init = async () => {
  if (counter == 1000) {
    try {
      const tx = await erc.approve(router.address, data.approveNum);
      const receipt = await tx.wait();
      console.log("Transaction receipt");
      console.log(receipt);
    } catch (err) {
      let error = JSON.parse(JSON.stringify(err));
      console.log(`Error caused by : 
      {
      reason : ${error.reason},
      transactionHash : ${error.transactionHash}
      message : Please check your BNB/WBNB balance, maybe its due because insufficient balance or approve your token manually on pancakeSwap
      }`);
      console.log(error);
    }
  }
};

factory.on("PairCreated", async (token0, token1, pairAddressx) => {
  console.log(`
    New pair detected
    =================
    token0: ${token0}
    token1: ${token1}
    pairAddress: ${pairAddressx}
  `);

  console.log("coucous");

  //The quote currency needs to be WBNB (we will pay with WBNB)

  console.log(data.WBNB);
  if (token0 === data.WBNB) {
    console.log("found token");
    tokenIn = token0;
    tokenOut = token1;
    pairAddress = pairAddressx;
  }

  if (token1 == data.WBNB) {
    console.log("found token");
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
let checkLiq = async () => {
  if (pairAddress !== null && pairAddress !== undefined) {
    // console.log("pairAddress.toString().indexOf('0x0000000000000')", pairAddress.toString().indexOf('0x0000000000000'));
    if (pairAddress.toString().indexOf("0x0000000000000") > -1) {
      console.log(
        chalk.red(`pairAddress ${pairAddress} not detected. Auto restart`)
      );
      return await init();
    }
  }

  const pairBNBvalue = await erc.balanceOf(pairAddress);
  jmlBnb = ethers.utils.formatEther(pairBNBvalue);
  console.log(`value BNB : ${jmlBnb}`);

  console.log(`value minBNB : ${data.minBnb}`);
  console.log("value du if : ", jmlBnb > data.minBnb);

  if (parseInt(jmlBnb) > parseInt(data.minBnb)) {
    setTimeout(() => buyAction(), 3000);
  } else {
    initialLiquidityDetected = false;
    console.log(" run again...");
    return await init();
  }
};
let buyAction = async () => {
  console.log(initialLiquidityDetected);
  if (initialLiquidityDetected === true) {
    console.log("not buy cause already buy");
    return null;
  }
  console.log("ready to buy");
  try {
    initialLiquidityDetected = true;

    let amountOutMin = 0;
    //We buy x amount of the new token for our wbnb
    const amountIn = ethers.utils.parseUnits(`${data.AMOUNT_OF_WBNB}`, "ether");
    if (parseInt(data.Slippage) !== 0) {
      const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
      //Our execution price will be a bit different, we need some flexbility
      const amountOutMin = amounts[1].sub(amounts[1].div(`${data.Slippage}`));
    }

    console.log(
      chalk.green.inverse(`Start to buy \n`) +
        `Buying Token
       =================
       tokenIn: ${(amountIn * 1e-18).toString()} ${tokenIn} (BNB)
       tokenOut: ${amountOutMin.toString()} ${tokenOut}
     `
    );

    console.log("Processing Transaction.....");
    console.log(chalk.yellow(`amountIn: ${amountIn * 1e-18} ${tokenIn} (BNB)`));
    console.log(chalk.yellow(`amountOutMin: ${amountOutMin}`));
    console.log(chalk.yellow(`tokenIn: ${tokenIn}`));
    console.log(chalk.yellow(`tokenOut: ${tokenOut}`));
    console.log(chalk.yellow(`data.recipient: ${data.recipient}`));
    console.log(chalk.yellow(`data.gasLimit: ${data.gasLimit}`));
    console.log(chalk.yellow(`data.gasPrice: ${data.gasPrice}`));

    const tx =
      await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        //uncomment this if you want to buy deflationary token
        // const tx = await router.swapExactTokensForTokens( //uncomment here if you want to buy token
        amountIn,
        amountOutMin,
        [tokenIn, tokenOut],
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
    setTimeout(() => {
      process.exit();
    }, 2000);
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
          init();
        } else {
          process.exit();
        }
      });
  }
};
init();
const PORT = 5000;

app.listen(
  PORT,
  console.log(
    chalk.yellow(
      `Listening for Liquidity Addition to token ${data.to_PURCHASE}`
    )
  )
);
