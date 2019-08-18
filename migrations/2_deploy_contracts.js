const chunk = require('lodash/chunk');

const allConfig = require('./config');

const Chess = artifacts.require('Chess');
const ChessLogic = artifacts.require('ChessLogic');
const Elo = artifacts.require('ELO');

const MAX_PENDING_TXS = 4;

const executeBatched = actions =>
  chunk(actions, MAX_PENDING_TXS).reduce(
    (previous, batch) =>
      previous.then(previousResults =>
        Promise.all(batch.map(it => it())).then(result => [...previousResults, ...result])
      ),
    Promise.resolve([])
  );

module.exports = async function(deployer, currentNetwork, [owner]) {
  const config = allConfig[currentNetwork];

  const addresses = config.addressesToHaveBalance || [];
  addresses.push(owner);

  console.log('Deploying Contracts and Libraries');
  await executeBatched([() => deployer.deploy(ChessLogic), () => deployer.deploy(Elo)]);

  console.log('Linking libraries into');
  await Promise.all([deployer.link(ChessLogic, Chess), deployer.link(Elo, Chess)]);

  console.log('Getting contracts');
  await deployer.deploy(Chess, true);

  // deployer.deploy returns undefined. This is not documented in
  // https://www.trufflesuite.com/docs/truffle/getting-started/running-migrations
  const chess = await Chess.deployed();

  if (currentNetwork === 'development' || currentNetwork === 'coverage') {
    // to run only when testing
  }

  console.log('Minting for all the addresses');
  // const DECIMALS = 10 ** 18;
  // const mintFor = (token, address) => token.mint(address, new BN((99 * DECIMALS).toString()));
  // await Promise.all(addresses.map(address => mintFor(bpro, address)));

  console.log({
    chessAddress: chess.address
  });
};
