//SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/*▀███▀▀▀██▄                    ▀███          ▀███▀▀▀██▄      ██       ▄█▀▀█▄  
   ██    ▀██▄                    ██            ██    ▀██▄    ▄██▄    ▄██▀  ▀██▄
   ██     ▀████▀   ▀██▀▄█▀██▄    ██   ▄██▀██▄  ██     ▀██   ▄█▀██▄   ██▀    ▀██
   ██      ██ ██   ▄█ ██   ██    ██  ██▀   ▀██ ██      ██  ▄█  ▀██   ██      ██
   ██     ▄██  ██ ▄█   ▄█████    ██  ██     ██ ██     ▄██  ████████  ██▄    ▄██
   ██    ▄██▀   ███   ██   ██    ██  ██▄   ▄██ ██    ▄██▀  █▀    ██  ▀██▄  ▄██▀
 ▄████████▀     ▄█    ▀████▀██▄▄████▄ ▀█████▀▄████████▀  ▄███▄  ▄███▄  ▀▀██▀▀  
               ██▀                                                       */

//import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./DyaloUSD.sol";

contract DyaloDAO is ERC20 {
    address payable public dyaloUSDAddress;
    address public dyaloTreasury;
    address private usdcAddress;

    constructor(
        address _lidoAddress,
        address _chainlinkAddress,
        address _uniswapAddress,
        address _wethAddress,
        address _usdcAddress
    ) ERC20("DyaloDAO", "DYALO") {
        dyaloUSDAddress = payable(new DyaloUSD(_lidoAddress, _chainlinkAddress, _uniswapAddress, _wethAddress, _usdcAddress));
        dyaloTreasury = msg.sender;
        usdcAddress = _usdcAddress;
        _mint(msg.sender, 100_000_000 ether);
    }

    function updateLidoKey(bytes32 _lidoKey) public {
        require(msg.sender == dyaloTreasury, "Only Multisig");
        DyaloUSD(dyaloUSDAddress).updateLidoKey(_lidoKey);
    }

    function distributeFees(uint _amount) public {
        require(msg.sender == dyaloTreasury, "Only Multisig");
        IERC20(usdcAddress).transfer(msg.sender, _amount);
    }
}
