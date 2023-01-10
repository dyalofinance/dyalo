# Dyalo Finance

Welcome to Dyalo Finance

https://dyalo.com

The leading DeFi protocol for fixed rate staking bonds on USDC. Our platform allows users to earn a stable and predictable return on their USDC investments by staking their tokens in our liquidity pool, which is collateralized by a Lido Finance stETH position. With DyaloUSD (DUSD), you can take advantage of the growing DeFi ecosystem and earn a high yield on your stablecoin holdings without the volatility and risk associated with other digital asset investments. Our unique fixed rate APR offer varies based on market conditions but is locked in at time of staking for a one year period.

Dyalo Finance is built on a fully decentralized and trustless architecture, ensuring the safety and security of your investments. The permissionless smart contracts ensure that all funds are securely locked for the term of the bond and cannot be tampered with, while also providing a transparent and auditable record of all transactions. Withdrawals will only be available when the Total Value Locked (TVL) is above a 100% health factor, ensuring that the protocol's long-term solvency.

It should be noted that while the protocol takes measures to mitigate risk, it is still present. In the event that the underlying asset (ETH) experiences significant decline and does not recover, it could lead to the failure of the protocol and result in the loss of funds. However, as the protocol is built on the Ethereum blockchain, this risk is an inherent aspect of utilizing this technology. In terms of returns, the Annual Percentage Rate (APR) offered on the platform ranges from 2-19%, with the standard rate being set at 10% APR when the price of the underlying asset is at its one-year moving average.

Dyalo is committed to providing our users with the next generation of DeFi products. Join us today and start earning a stable return on your USDC through our fixed rate staking bonds.

## Developers

### Smart Contracts

contracts/DyaloUSD.sol = A stablecoin offering a fixed term 1 year bond

contracts/DyaloNFT.sol = A unique representation of a staked DyaloUSD position

contracts/DyaloDAO.sol = Governance token and owner of the DyaloUSD contract

### Tests

test/dyaloUnitTests.js = Unit tests for the three contracts above

test/dyaloFiveYearModel.js = Modelling using previous 5 years price data

### Bugs & Security

Auditors please contact us via dm or email for responsible security disclosures.
