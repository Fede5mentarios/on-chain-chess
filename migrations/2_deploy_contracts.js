const chunk = require('lodash/chunk');

const allConfig = require('./config');

const MathUtils = artifacts.require('MathUtils');
const MathUtilsTest = artifacts.require('MathUtilsTest');
const ChessState = artifacts.require('ChessState');
const ChessMoveValidator = artifacts.require('ChessMoveValidator');
const ChessMovements = artifacts.require('ChessMovements');
const ChessLogic = artifacts.require('ChessLogic');
const Elo = artifacts.require('ELO');

const EloTestContract = artifacts.require('EloTest');
const Chess = artifacts.require('Chess');

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
  await deployer.deploy(MathUtils);
  await executeBatched([
    () =>
      deployer
        .link(MathUtils, ChessState)
        .then(() => deployer.deploy(ChessState))
        .then(() => deployer.link(MathUtils, ChessMoveValidator))
        .then(() => deployer.link(ChessState, ChessMoveValidator))
        .then(() => deployer.deploy(ChessMoveValidator))
        .then(() => deployer.link(MathUtils, ChessMovements))
        .then(() => deployer.link(ChessState, ChessMovements))
        .then(() => deployer.link(ChessMoveValidator, ChessMovements))
        .then(() => deployer.deploy(ChessMovements))
        .then(() => deployer.link(MathUtils, ChessLogic))
        .then(() => deployer.link(ChessState, ChessLogic))
        .then(() => deployer.link(ChessMoveValidator, ChessLogic))
        .then(() => deployer.link(ChessMovements, ChessLogic))
        .then(() => deployer.deploy(ChessLogic)),
    () => deployer.link(MathUtils, Elo).then(() => deployer.deploy(Elo))
  ]);

  console.log('Linking libraries into');
  await Promise.all([
    deployer.link(MathUtils, Chess),
    deployer.link(ChessState, Chess),
    deployer.link(ChessMoveValidator, Chess),
    deployer.link(ChessMovements, Chess),
    deployer.link(ChessLogic, Chess),
    deployer.link(Elo, Chess),
    deployer.link(Elo, ChessState)
  ]);

  console.log('Getting contracts');
  await deployer.deploy(Chess, true);

  // deployer.deploy returns undefined. This is not documented in
  // https://www.trufflesuite.com/docs/truffle/getting-started/running-migrations
  const chess = await Chess.deployed();

  if (currentNetwork === 'development' || currentNetwork === 'coverage') {
    console.log('Deploying Contracts and Libraries for testing');
    await deployer
      .deploy(MathUtils)
      .then(() => deployer.link(MathUtils, MathUtilsTest))
      .then(() => deployer.deploy(MathUtilsTest));
    await deployer
      .deploy(MathUtils)
      .then(() => deployer.link(MathUtils, Elo))
      .then(() => deployer.deploy(Elo))
      .then(() => deployer.link(Elo, EloTestContract))
      .then(() => deployer.deploy(EloTestContract));
  }

  console.log('Minting for all the addresses');
  // const DECIMALS = 10 ** 18;
  // const mintFor = (token, address) => token.mint(address, new BN((99 * DECIMALS).toString()));
  // await Promise.all(addresses.map(address => mintFor(bpro, address)));

  console.log({
    chessAddress: chess.address
  });
};
