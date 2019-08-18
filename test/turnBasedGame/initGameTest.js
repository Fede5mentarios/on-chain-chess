/** global describe, it, beforeEach */
const {
  constants: { ZERO_ADDRESS }
} = require('openzeppelin-test-helpers');
const { getContracts, CONSTANTS } = require('../helpers/testHelper');
const { expect, assertRevert, assertEvent, assertNewGame } = require('../helpers/assertHelper');

contract('Turn Based Game:', function(accounts) {
  const player1 = accounts[1];
  describe('FEATURE: initGame()', function() {
    let turnBasedGame;
    before(async function() {
      [, turnBasedGame] = await getContracts();
    });

    describe('RULE: the turn time should bew greater or equals to 5', function() {
      it('WHEN calling initGame whit turnTime 2, THEN it should revert', async function() {
        await assertRevert(
          turnBasedGame.initGame('Alice', 2, false),
          'the turn time should be greater or equals to 5'
        );
      });
    });

    describe('RULE: should be possible to initialize a game without pot', function() {
      describe('WHEN calling initGame', function() {
        let gameId;
        let tx;
        before(async function() {
          tx = await turnBasedGame.initGame('Alice', 10, true, { from: player1 });
        });
        it('THEN an NewGameStarted is emitted whith the gameId', async function() {
          gameId = assertEvent.NewGameStarted(tx);
        });
        it('AND the game appears in the games mapping', function() {
          return assertNewGame(turnBasedGame, gameId, {
            player1,
            turnTime: 10,
            player1Alias: 'Alice',
            pot: 0,
            nextPlayer: player1
          });
        });
        it('AND the game Id is the new head of the games Id list', async function() {
          expect(await turnBasedGame.head()).to.be.equals(gameId);
        });
        it('AND the game Id appears as the last element in the openGameIds mapping', async function() {
          expect(await turnBasedGame.openGameIds(gameId)).to.not.be.equals(CONSTANTS.b32EMPTY);
          expect(await turnBasedGame.openGameIds(gameId)).to.be.equals(CONSTANTS.b32ENDOFLIST);
        });
        it('AND appears first in the games of player array', async function() {
          expect(await turnBasedGame.getGamesOfPlayer(player1)).to.have.ordered.members([gameId]);
        });
      });
    });

    describe('RULE: should be possible to initialize a game with pot', function() {
      describe('WHEN calling initGame with a value transfer', function() {
        let gameId;
        before(async function() {
          gameId = assertEvent.NewGameStarted(
            await turnBasedGame.initGame('Jhon', 10, false, { from: player1, value: 100000 })
          );
        });
        it('THEN the game appears in the games mapping whit a expected pot of 2 times the value transferred', function() {
          return assertNewGame(turnBasedGame, gameId, { pot: 100000 * 2 });
        });
        it('AND the game appears in the games mapping', function() {
          return assertNewGame(turnBasedGame, gameId, {
            player1,
            turnTime: 10,
            player1Alias: 'Alice',
            pot: 0,
            nextPlayer: ZERO_ADDRESS
          });
        });
      });
    });
  });
});
