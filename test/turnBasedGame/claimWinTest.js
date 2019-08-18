/** global describe, it, beforeEach */
const { getContracts } = require('../helpers/testHelper');
const { assertGame, assertRevert, assertEvent } = require('../helpers/assertHelper');

contract('Turn Based Game:', function(accounts) {
  const player1 = accounts[1];
  const player2 = accounts[2];
  describe('FEATURE: claimWin()', function() {
    let turnBasedGame;
    before(async function() {
      [, turnBasedGame] = await getContracts();
    });

    describe('GIVEN an existing game', function() {
      let gameId;
      before(async function() {
        gameId = assertEvent.NewGameStarted(
          await turnBasedGame.initGame('Alice', 10, true, { from: player1 })
        );
      });
      describe('WHEN trying to claim win without been part of the game', function() {
        it('THEN it should revert', function() {
          return assertRevert(
            turnBasedGame.claimWin(gameId, { from: player2 }),
            'sender is not a player'
          );
        });
      });
      describe('GIVEN the game has started and ended', function() {
        before(async function() {
          await turnBasedGame.joinGame(gameId, 'Chester', { from: player2 });
          await turnBasedGame.surrender(gameId, { from: player1 });
        });

        describe('WHEN trying to claim win', function() {
          it('THEN it should revert', function() {
            return assertRevert(
              turnBasedGame.claimWin(gameId, { from: player2 }),
              'The game already ended'
            );
          });
        });
      });
    });

    describe('GIVEN a started game', function() {
      let gameId;
      before(async function() {
        gameId = assertEvent.NewGameStarted(
          await turnBasedGame.initGame('Alice', 10, true, { from: player1 })
        );
        await turnBasedGame.joinGame(gameId, 'chester', { from: player2 });
      });
      describe('WHEN player 2 claim win', function() {
        let tx;
        before(async function() {
          tx = await turnBasedGame.claimWin(gameId, { from: player2 });
        });
        it('THEN an GameTimeoutStarted event is emmited', function() {
          return assertEvent.GameTimeoutStarted(tx, { gameId, timeoutState: 1 });
        });
        it('AND the game timeoutState and timeourStarted have changed', async function() {
          return assertGame(turnBasedGame, gameId, {
            timeoutState: 1,
            winner: player2,
            ended: false,
            player1,
            player2
          });
        });
        it('AND reverts when claiming win again', function() {
          return assertRevert(
            turnBasedGame.claimWin(gameId, { from: player2 }),
            'Timeout already running'
          );
        });
      });
    });
  });
});
