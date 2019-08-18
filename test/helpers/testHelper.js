const Chess = artifacts.require('../../contracts/chess/Chess.sol');
const TurnBasedGame = artifacts.require('../../contracts/TurnBasedGame.sol');

const CONSTANTS = {
  b32EMPTY: '0x0000000000000000000000000000000000000000000000000000000000000000',
  b32ENDOFLIST: '0x656e640000000000000000000000000000000000000000000000000000000000'
};

const adjustPot = value => value * 2; // for testing in testrpc
const solSha3 = (...args) => {
  const newArgs = args.map(arg => {
    if (typeof arg === 'string') {
      if (arg.substring(0, 2) === '0x') {
        return arg.slice(2);
      }
      return web3.toHex(arg).slice(2);
    }

    if (typeof arg === 'number') {
      if (arg < 0) {
        return leftPad((arg >>> 0).toString(16), 64, 'F');
      }
      return leftPad(arg.toString(16), 64, 0);
    }
    return '';
  });

  return '0x' + web3.sha3(newArgs.join(''), { encoding: 'hex' });
};

const leftPad = (nr, n, str) => Array(n - String(nr).length + 1).join(str || '0') + nr;

const getContracts = async () => Promise.all([Chess.new(true), TurnBasedGame.new(true)]);

module.exports = {
  CONSTANTS,
  solSha3,
  adjustPot,
  getContracts
};
