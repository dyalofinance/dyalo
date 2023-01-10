//SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/*▀███▀▀▀██▄                    ▀███          ▀███    ▀██  ███▀▀▀██ ██▀▀██▀▀██
   ██    ▀██▄                    ██            ███▄    █   ██    ▀  ▀   ██   ▀
   ██     ▀████▀   ▀██▀▄█▀██▄    ██   ▄██▀██▄  █ ███   █   ██   █       ██     
   ██      ██ ██   ▄█ ██   ██    ██  ██▀   ▀██ █  ▀██▄ █   ██▀▀██       ██     
   ██     ▄██  ██ ▄█   ▄█████    ██  ██     ██ █   ▀██▄█   ██   █       ██     
   ██    ▄██▀   ███   ██   ██    ██  ██▄   ▄██ █     ███   ██           ██     
 ▄████████▀     ▄█    ▀████▀██▄▄████▄ ▀█████▀▄███▄    ██ ▄████▄       ▄████▄   
               ██▀                                                       */
               
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract DyaloNFT is ERC721 {
    uint256 public tokenId;
    address public DyaloUSDAddress;
    mapping(uint256 => uint256) public unlockTime;
    mapping(uint256 => uint256) public stakedAmount;

    constructor() ERC721("Dyalo USDC Bond NFT", "DNFT") {
        DyaloUSDAddress = msg.sender;
    }

    function tokenURI(uint256) override public pure returns (string memory) {
        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{"name": "Dyalo Bond NFT", "description": "Staked Dyalo Bond Position", "image": "https://dyalo.com/static/nft.png"}'
        ))));
        return string(abi.encodePacked('data:application/json;base64,', json));
    }

    function mint(address _to, uint _unlockTime, uint _stakedAmount) public {
        require(msg.sender == DyaloUSDAddress, "Only Contract");
        unlockTime[tokenId] = _unlockTime;
        stakedAmount[tokenId] = _stakedAmount;
        _mint(_to, tokenId);
        tokenId = tokenId + 1;
    }

    function burn(uint _tokenId) public {
        require(msg.sender == DyaloUSDAddress, "Only Contract");
        unlockTime[_tokenId] = 0;
        stakedAmount[_tokenId] = 0;
        _burn(_tokenId);
    }
}