//SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/*▀███▀▀▀██▄                   ▀███          ▀███▀   ▀███▀▄█▀▀▀█▄████▀▀▀██▄  
   ██    ▀██▄                    ██           ██       █ ▄██    ▀█ ██    ▀██▄
   ██     ▀████▀   ▀██▀▄█▀██▄    ██   ▄██▀██▄ ██       █ ▀███▄     ██     ▀██
   ██      ██ ██   ▄█ ██   ██    ██  ██▀   ▀████       █   ▀█████▄ ██      ██
   ██     ▄██  ██ ▄█   ▄█████    ██  ██     ████       █ ▄     ▀██ ██     ▄██
   ██    ▄██▀   ███   ██   ██    ██  ██▄   ▄████▄     ▄█ ██     ██ ██    ▄██▀
 ▄████████▀     ▄█    ▀████▀██▄▄████▄ ▀█████▀  ▀██████▀▀ █▀█████▀▄████████▀  
               ██▀                                                      */

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "./DyaloNFT.sol";

interface ILido is IERC20 {
    function submit(address _referral) external payable returns (uint StETH);
    function withdraw(uint _amount, bytes32 _pubkeyHash) external; // wont be available until post-merge
    function sharesOf(address _owner) external returns (uint balance);
}

interface IWEth is IERC20 {
  function withdraw(uint256 wad) external;
  function deposit() external payable;
}

interface EACAggregatorProxy {
    function latestAnswer() external view returns (int256);
}

contract DyaloUSD is ERC20 {
    mapping(address => uint) public staked;
    address private daoAddress;
    address private lidoAddress;
    address private chainlinkAddress;
    address private uniswapAddress;
    address private wethAddress;
    address private usdcAddress;
    address private constant stakerAddress = 0x00000000000000000000000000000000000d7a10;
    address public nftAddress;
    // https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=1M&limit=12
    uint32[12] public priceHistory = [2686,2920,3281,2726,1941,1071,1678,1554,1328,1572,1294,1196];
    uint public priceLastUpdate;
    uint public aprBasisPoints;
    uint public totalStaked;
    bytes32 public lidoKey;

    constructor(
        address _lidoAddress,
        address _chainlinkAddress,
        address _uniswapAddress,
        address _wethAddress,
        address _usdcAddress
    ) ERC20("Dyalo USD", "DUSD") {
        daoAddress = msg.sender;
        lidoAddress = _lidoAddress;
        chainlinkAddress = _chainlinkAddress;
        uniswapAddress = _uniswapAddress;
        wethAddress = _wethAddress;
        usdcAddress = _usdcAddress;
        updateEthPrice();
        nftAddress = address(new DyaloNFT());
    }

    function updateLidoKey(bytes32 _lidoKey) public {
        // This needs looking at once withdrawals are live
        require(msg.sender == daoAddress, "Only DAO");
        lidoKey = _lidoKey;
    }

    function swap(address _tokenIn, address _tokenOut, uint256 _amountIn) internal returns (uint256) {
        uint24 poolFee = 500;
        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: _tokenIn,
                tokenOut: _tokenOut,
                fee: poolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: _amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });
        uint256 amountOut = ISwapRouter(uniswapAddress).exactInputSingle(params);
        return amountOut;
    }

    function getEthPrice() public view returns (uint) {
        int256 ethPriceInt = EACAggregatorProxy(chainlinkAddress).latestAnswer();
        uint ethDollarPrice = uint(ethPriceInt) / 10e7;
        return ethDollarPrice;
    }

    function updateEthPrice() public returns (uint) {
        int256 ethPriceInt = EACAggregatorProxy(chainlinkAddress).latestAnswer();
        uint ethDollarPrice = uint(ethPriceInt) / 10e7;
        if (block.timestamp > priceLastUpdate + 30 days) {
            priceLastUpdate = block.timestamp;
            uint sum = 0;
            for (uint i = 0; i < 12; i++) {
                if (i < 11) {
                    priceHistory[i] = priceHistory[i+1];
                } else {
                    priceHistory[i] = uint32(ethDollarPrice);
                }
                sum += priceHistory[i];
            }
            uint averagePrice = sum / 12;
            uint formula = 200;
            for (uint f = 1; f < 17; f++) {
                if (ethDollarPrice < averagePrice * f / 8) formula += 100;      
                if (ethDollarPrice < averagePrice / f / 64) formula += 100;
            }
            aprBasisPoints = formula;
        }
        return ethDollarPrice;
    }

    function mint(uint _amount) public {
        IERC20(usdcAddress).transferFrom(msg.sender, address(this), _amount);
        _mint(msg.sender, _amount);
    }

    function burn(uint _amount) public {
        _burn(msg.sender, _amount);
        if (IERC20(usdcAddress).balanceOf(address(this)) < _amount) {
            uint ethPrice = getEthPrice();
            uint additionalUSDC = _amount - IERC20(usdcAddress).balanceOf(address(this));
            uint ethToRemove = additionalUSDC * 100 / ethPrice / 99 * 1e12;
            removeETH(ethToRemove);
        }
        IERC20(usdcAddress).transfer(msg.sender, _amount);
    }

    function addEth(uint _amount) internal {
        IERC20(usdcAddress).approve(uniswapAddress,_amount);
        uint wethOut = swap(usdcAddress, wethAddress, _amount);        
        IWEth(wethAddress).withdraw(wethOut);
        ILido(lidoAddress).submit{value: wethOut}(stakerAddress);
    }

    function removeETH(uint _amount) internal {
        if (ILido(lidoAddress).balanceOf(address(this)) < _amount) return;
        ILido(lidoAddress).withdraw(_amount, lidoKey);
        IWEth(wethAddress).deposit{value:_amount}();
        IWEth(wethAddress).approve(uniswapAddress,_amount);
        swap(wethAddress, usdcAddress, _amount);
    }

    function previewStake(uint _amount) public view returns (uint) {
        return _amount + (_amount * aprBasisPoints / 10000);
    }    

    function stake(uint _amount) public {
        _transfer(msg.sender, stakerAddress, _amount);
        uint fees = _amount * 85 / 10000; // 0.85%
        IERC20(usdcAddress).transfer(daoAddress, fees);
        uint usdcToAdd = _amount - fees;
        addEth(usdcToAdd);
        uint stakedAmount = previewStake(_amount);
        uint unlockTime = block.timestamp + 365 days;
        totalStaked += stakedAmount;
        DyaloNFT(nftAddress).mint(msg.sender, unlockTime, stakedAmount);
    }

    function unstake(uint _tokenId) public {
        require(DyaloNFT(nftAddress).ownerOf(_tokenId) == msg.sender, "Not your position");
        require(DyaloNFT(nftAddress).unlockTime(_tokenId) < block.timestamp, "Unlock too soon");
        require (health() > 100, "Pool health too low");
        uint usdAmount = DyaloNFT(nftAddress).stakedAmount(_tokenId);
        DyaloNFT(nftAddress).burn(_tokenId);
        totalStaked -= usdAmount;
        uint ethPrice = updateEthPrice();
        uint ethToRemove = usdAmount * 100 / ethPrice / 99 * 1e12;
        removeETH(ethToRemove);
        if (balanceOf(stakerAddress) < usdAmount) {
            _mint(stakerAddress, usdAmount - balanceOf(stakerAddress) + 1);
        }
        _transfer(stakerAddress, msg.sender, usdAmount);
    }

    function tvl() public view returns (uint) {
        uint stEthBal = ILido(lidoAddress).balanceOf(address(this));
        uint ethPrice = getEthPrice();
        uint usdcValue = stEthBal * ethPrice / 1e12;
        uint usdcBal = IERC20(usdcAddress).balanceOf(address(this));
        //console.log('usdcValue',usdcValue);
        //console.log('usdcBal',usdcBal);
        return usdcValue + usdcBal;
    }

    function health() public view returns (uint) {
        return tvl() * 100 / totalSupply();
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    fallback() external payable {}
    receive() external payable {}

}