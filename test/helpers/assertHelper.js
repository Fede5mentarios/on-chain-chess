const { expect, use } = require('chai');
const { expectRevert } = require('openzeppelin-test-helpers');
const abiDecoder = require('abi-decoder');
const { gameStateDisplay } = require('./utils');

const Chess = artifacts.require('../../contracts/chss/Chess.sol');

const { BN, isBN } = web3.utils;
use(require('bn-chai')(BN));
use(require('chai-as-promised'));

abiDecoder.addABI(Chess.abi);
const decodeLogs = txReceipt => abiDecoder.decodeLogs(txReceipt.rawLogs);

const transformContractOutput = output => {
  const obj = {};
  output.forEach(({ name, type, value }) => {
    switch (type) {
      case 'address':
        obj[name] = web3.utils.toChecksumAddress(value);
        break;
      case 'bool':
        obj[name] = value === 'true';
        break;
      default:
        // uints and string
        obj[name] = value;
    }
  });

  return obj;
};

const findEvents = (tx, eventName, eventArgs) => {
  const txLogs = decodeLogs(tx.receipt);
  const logs = txLogs.filter(log => log && log.name === eventName);
  const events = logs.map(log => transformContractOutput(log.events));
  // Filter
  if (eventArgs) {
    return events.filter(ev => Object.entries(eventArgs).every(([k, v]) => ev[k] === v));
  }
  return events;
};

const compareParams = (output, expected) =>
  expect(output, 'event not found').to.not.be.undefined &&
  Object.entries(output).every(([k, v]) => {
    if (k === 'timeoutStarted' && expected[k] !== undefined) {
      return expected[k] ? expect(v, k).to.not.be.equals(0) : expect(v, k).to.be.equals(0);
    }
    return expected[k] && expect(v, k).to.be.equals(expected[k]);
  });

const NewGameStarted = tx => {
  const [event] = findEvents(tx, 'NewGameStarted');
  return event.gameId;
};

const GameInitialized = (tx, expected) => {
  const [event] = findEvents(tx, 'GameInitialized');
  // await expectEvent.inTransaction(tx.tx, Chess, 'GameInitialize', expected);
  compareParams(event, expected);
  return event.gameId;
};

const GameStateChanged = (tx, expected) => {
  const [event] = findEvents(tx, 'GameStateChanged');
  // await expectEvent.inTransaction(tx.tx, Chess, 'GameStateChanged', expected);
  const state = event.state.map(n => Number(n));
  expect(gameStateDisplay(state)).to.be.deep.equals.to(gameStateDisplay(expected));
};

const GameEnded = (tx, expected) => {
  const [event] = findEvents(tx, 'GameEnded');
  // await expectEvent.inTransaction(tx.tx, Chess, 'GameStateChanged', expected);
  compareParams(event, expected);
};

const GameClosed = (tx, expected) => {
  const [event] = findEvents(tx, 'GameClosed');
  // await expectEvent.inTransaction(tx.tx, Chess, 'GameStateChanged', expected);
  compareParams(event, expected);
};

const GameTimeoutStarted = (tx, expected) => {
  const [event] = findEvents(tx, 'GameTimeoutStarted');
  // await expectEvent.inTransaction(tx.tx, Chess, 'GameStateChanged', expected);
  compareParams(event, expected);
};

const GameDrawOfferRejected = (tx, expected) => {
  const [event] = findEvents(tx, 'GameDrawOfferRejected');
  // await expectEvent.inTransaction(tx.tx, Chess, 'GameStateChanged', expected);
  compareParams(event, expected);
};

const assertGame = async (contract, gameId, expected) =>
  compareParams(await contract.games(gameId), Object.assign({}, expected, { gameId }));

const assertNewGame = (contract, gameId, expected) =>
  assertGame(
    contract,
    gameId,
    Object.assign({}, expected, {
      ended: false,
      timeoutState: 0,
      player1Winnings: 0,
      player2Winnings: 0
    })
  );

const assertRevert = expectRevert;

module.exports = {
  expect,
  assertEvent: {
    NewGameStarted,
    GameInitialized,
    GameStateChanged,
    GameEnded,
    GameClosed,
    GameTimeoutStarted,
    GameDrawOfferRejected
  },
  assertGame,
  assertNewGame,
  assertRevert
};
