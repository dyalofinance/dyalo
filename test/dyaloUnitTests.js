const { expect } = require("chai");
require("@nomicfoundation/hardhat-chai-matchers")
const { time } = require("@nomicfoundation/hardhat-network-helpers");
let owner, user, dao, oracle, usdc, weth, lido, uniswap, usd, nft;

describe("Dyalo", function () {
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

  describe("DyaloUSD", function () {
    it("Should approve and mint", async function () {
      const oneThousandUDSC = ethers.utils.parseUnits("1000",6);
      await usdc.connect(user).approve(usd.address,oneThousandUDSC);
      await usd.connect(user).mint(oneThousandUDSC);
      const bal = await usd.balanceOf(user.address);
      expect(bal).eq(oneThousandUDSC);
    });

    it("Should previewStake and stake", async function () {
      const sevenHundredUDSC = ethers.utils.parseUnits("700",6);
      const threeHundredUDSC = ethers.utils.parseUnits("300",6);
      const preview = await usd.previewStake(sevenHundredUDSC);
      await usd.connect(user).stake(sevenHundredUDSC);
      const bal = await usd.balanceOf(user.address);
      expect(bal).eq(threeHundredUDSC);
      const nftOwner = await nft.ownerOf(0);
      expect(nftOwner).eq(user.address);
      const stakedAmount = await nft.stakedAmount(0);
      expect(stakedAmount).eq(preview);
      const totalStaked = await usd.totalStaked();
      expect(totalStaked).eq(preview);
      const tvl = await usd.tvl();
      expect(tvl).gt(sevenHundredUDSC);
    });

    it("Check fees went to DAO", async function () {
      const bal = await usdc.balanceOf(dao.address);
      expect(bal).gt(0);
    });


    it("Unstake too soon should fail", async function () {
      await expect(usd.connect(user).unstake(0))
      .to.be.revertedWith('Unlock too soon');
    });

    it("Should add one year and some yield", async function () {
      const health1 = await usd.health();
      const tvl1 = await usd.tvl();
      const unlockTime = (await time.latest()) + 4e7;
      await time.increaseTo(unlockTime);
      const testYield = ethers.utils.parseUnits("150",6);
      await usdc.testMint(usd.address, testYield);
      const tvl2 = await usd.tvl();
      expect(tvl2).gt(tvl1);
      expect(tvl2).gt(1000);
      const health2 = await usd.health();
      expect(health2).gt(100);
      expect(health2).lt(150);
    });

    it("Should unstake", async function () {
      const bal1 = await usd.balanceOf(user.address);
      await usd.connect(user).unstake(0);
      const bal2 = await usd.balanceOf(user.address);
      expect(bal2).gt(bal1);
      const oneThousandUDSC = ethers.utils.parseUnits("1000",6);
      expect(bal2).gt(oneThousandUDSC);
    });

    it("Should burn for USDC", async function () {
      const bal1 = await usd.balanceOf(user.address);
      await usd.connect(user).burn(bal1);
      const bal2 = await usd.balanceOf(user.address);
      const usdc2 = await usdc.balanceOf(user.address);
      const oneMilUDSC = ethers.utils.parseUnits("1000000",6);
      expect(bal2).eq(0);
      expect(usdc2).gt(oneMilUDSC);
    });
    
  });

  describe("DyaloDAO", function () {
    it("Should update lido key", async function () {
      const newKey = "0x7465737400000000000000000000000000000000000000000000000000000000";
      await dao.updateLidoKey(newKey);
      const key = await usd.lidoKey();
      expect(key).eq(newKey);
    });

    it("Should distribute fees to treasury", async function () {
      const bal = await usdc.balanceOf(dao.address);
      expect(bal).gt(0);
      const ownerBal1 = await usdc.balanceOf(owner.address);
      await dao.distributeFees(bal);
      const ownerBal2 = await usdc.balanceOf(owner.address);
      expect(ownerBal2).gt(ownerBal1);
    });
  });

});
