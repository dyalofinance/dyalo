const { expect } = require("chai");
require("@nomicfoundation/hardhat-chai-matchers")
const { time } = require("@nomicfoundation/hardhat-network-helpers");
let owner, user, dao, oracle, usdc, weth, lido, uniswap, usd, nft;
const priceData = [853,393,670,577,454,432,281,232,198,113,131,106,135,141,161,267,292,218,171,180,182,151,129,179,217,132,206,231,225,346,433,359,386,616,736,1312,1419,1919,2772,2706,2275,2531,3429,3000,4287,4630,3676,2686,2920,3281,2726,1941,1071,1678,1554,1328,1572,1294,1196,1327];

const logging = false;

describe("5 Year Historical Model", function () {
  // mainnet
  let lidoAddress = '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84';
  let chainlinkAddress = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419';
  let uniswapAddress = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
  let wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
  let usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

  describe("Deployment", function () {
    it("Should Get Signers", async function () {
      [owner, user] = await ethers.getSigners();
    });

    it("Should Deploy Mocks", async function () {
      const Chainlink = await ethers.getContractFactory("Chainlink");
      oracle = await Chainlink.deploy();
      const USDC = await ethers.getContractFactory("USDC");
      usdc = await USDC.deploy();
      const oneMilUDSC = ethers.utils.parseUnits("1000000",6);
      await usdc.testMint(user.address, oneMilUDSC);
      const usdcBal = await usdc.balanceOf(user.address);
      expect(usdcBal).eq(oneMilUDSC);
      const WETH9 = await ethers.getContractFactory("WETH9");
      weth = await WETH9.deploy();
      const LIDO = await ethers.getContractFactory("LIDO");
      lido = await LIDO.deploy();
      const UniswapV3 = await ethers.getContractFactory("UniswapV3");
      uniswap = await UniswapV3.deploy();
      const wethMint = ethers.utils.parseUnits("100000000000",18);
      weth.testMint(uniswap.address,wethMint)
      await network.provider.send("hardhat_setBalance", [weth.address,"0x100000000000000000000000000000000000"]);
      const usdcMint = ethers.utils.parseUnits("100000000",6);
      await usdc.testMint(uniswap.address,usdcMint)
      // 1300e6 * x = 1e18;   x = 1e18 / 1300e6
      await uniswap.testSetExchangeRate(usdc.address, weth.address, 769230769);
    });

    it("Should Deploy DAO,USD,NFT", async function () {
      const DyaloDAO = await ethers.getContractFactory("DyaloDAO");
      dao = await DyaloDAO.deploy(lido.address, oracle.address, uniswap.address, weth.address, usdc.address);
      const DyaloUSD = await ethers.getContractFactory("DyaloUSD");
      const DyaloUSDAddress = await dao.dyaloUSDAddress();
      usd = await DyaloUSD.attach(DyaloUSDAddress);
      const DyaloNFT = await ethers.getContractFactory("DyaloNFT");
      const DyaloNFTAddress = await usd.nftAddress();
      nft = await DyaloNFT.attach(DyaloNFTAddress);
    });

    it("Check DyaloUSD deployed", async function () {
      const name = await usd.name();
      expect(name).eq('Dyalo USD');
    });

    it("Check priceHistory updated correctly", async function () {
      const lastPrice = await usd.priceHistory(11);
      const ethPrice = await usd.getEthPrice();
      expect(lastPrice).eq(ethPrice);
    });

    it("Check DyaloNFT deployed", async function () {
      const name = await nft.name();
      expect(name).eq('Dyalo USDC Bond NFT');
    });
  });

  describe("Setup Model", function () {
    it("Should update first 12 prices", async function () {
        for (let i = 0; i < 12; i++) {
            const newPrice = priceData.shift();
            oracle.testUpdate(newPrice);
            await usd.updateEthPrice();
            const unlockTime = (await time.latest()) + 2628001; // 1 month
            await time.increaseTo(unlockTime);      
        }
    });

    it("Create Model", async function () {
        for (let i = 0; i < 48; i++) {
            const newPrice = priceData.shift();
            oracle.testUpdate(newPrice);
            await usd.updateEthPrice();
            // 1300e6 * x = 1e18;   x = 1e18 / 1300e6 = 769230769 = 1000000000000 / 1300
            const bn = ethers.BigNumber.from("1000000000000");
            const exchangeRate = bn.div(newPrice);
            await uniswap.testSetExchangeRate(usdc.address, weth.address, exchangeRate);
            const unlockTime = (await time.latest()) + 2628001; // 1 month
            await time.increaseTo(unlockTime);
            // mint and stake
            let healthCheck = 100;
            if (i > 0) healthCheck = await usd.health();
            const monthlyStaked = healthCheck; // healthier = more contributions, apr balances market cycle demand;
            const oneThousandUDSC = ethers.utils.parseUnits(monthlyStaked.toString(),6);
            await usdc.connect(user).approve(usd.address,oneThousandUDSC);
            await usd.connect(user).mint(oneThousandUDSC);
            await usd.connect(user).stake(oneThousandUDSC);
            if (logging) console.log("\tPeriod: "+i+"   Price: "+newPrice);
            if (logging) console.log("\t\tStake",Number(monthlyStaked).toFixed());
            // unstake and burn
            const positions = await nft.tokenId();
            const timestamp = await time.latest();
            healthCheck = await usd.health();
            if (Number(healthCheck) > 100) {
                for (let p = 0; p < Number(positions); p++) {
                    const unlockTime = await nft.unlockTime(p);
                    const stakedAmount = await nft.stakedAmount(p);
                    if (Number(stakedAmount) != 0 && Number(unlockTime) < Number(timestamp)) {
                        await usd.connect(user).unstake(p);
                        const bal1 = await usd.balanceOf(user.address);
                        // percentage restake?
                        const balUSD = ethers.utils.formatUnits(bal1,6);
                        if (logging) console.log("\t\tUnstake",Number(balUSD).toFixed());
                        await usd.connect(user).burn(bal1);
                    }
                }
            } else {
                if (logging) console.log("\t\tWithdrawals Not Available");
            }
            const health = await usd.health();
            const tvl = await usd.tvl();
            const tvlUSD = ethers.utils.formatUnits(tvl,6);
            const aprBasisPoints = await usd.aprBasisPoints();
            
            if (logging) console.log("\t\tHealth",Number(health));
            if (logging) console.log("\t\tTVL",Number(tvlUSD).toFixed());
            if (logging) console.log("\t\tAPR",Number(aprBasisPoints));
            
        }
    });

  });

});
