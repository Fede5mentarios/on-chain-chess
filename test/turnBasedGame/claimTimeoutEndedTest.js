/* eslint-disable mocha/no-setup-in-describe */
/** global describe, it, beforeEach */
const {
  constants: { ZERO_ADDRESS }
} = require('openzeppelin-test-helpers');
const { getContracts } = require('../helpers/testHelper');
const { assertGame, assertRevert, assertEvent } = require('../helpers/assertHelper');

contract('Turn Based Game:', function(accounts) {
  const player1 = accounts[1];
  const player2 = accounts[2];
  const player3 = accounts[3];
  describe('FEATURE: claimTimeoutEnded()', function() {
    let turnBasedGame;
    before(async function() {
      [, turnBasedGame] = await getContracts();
    });

    describe('GIVEN a started game', function() {
      let gameId;
      before(async function() {
        gameId = assertEvent.NewGameStarted(
          await turnBasedGame.initGame('Alice', 10, true, { from: player1 })
        );
        await turnBasedGame.joinGame(gameId, 'Avril', { from: player2 });
      });

      describe('RULE: the player who wants to claim timeout end should be part of the game', function() {
        describe('WHEN calling claimTimeoutEnded with an address not related to the game', function() {
          it('THEN it should revert', function() {
            return assertRevert(
              turnBasedGame.claimTimeoutEnded(gameId, { from: player3 }),
              'sender is not a player'
            );
          });
        });
      });

      describe('RULE: someone should have started the timeout clock previously', function() {
        describe('WHEN calling claimTimeoutEnded whith the game in normal excecution', function() {
          it('THEN it should revert', function() {
            return assertRevert(
              turnBasedGame.claimTimeoutEnded(gameId, { from: player1 }),
              'Timeout coutdown never started'
            );
          });
        });
      });

      describe('RULE: the game should not be ended', function() {
        describe('GIVEN that the player 2 ended the game', function() {
          before(async function() {
            return turnBasedGame.surrender(gameId, { from: player2 });
          });

          describe('WHEN calling claimTimeoutEnded as any player', function() {
            it('THEN it should revert', function() {
              return assertRevert(
                turnBasedGame.claimTimeoutEnded(gameId, { from: player1 }),
                'The game already ended'
              );
            });
          });
        });
      });
    });

    describe('RULE: Claiming timeout ended over its win', function() {
      describe('GIVEN that the player 2 have claimed timeout', function() {
        let gameId;
        before(async function() {
          gameId = assertEvent.NewGameStarted(
            await turnBasedGame.initGame('Alice', 5, true, { from: player1, value: 1000 })
          );
          await turnBasedGame.joinGame(gameId, 'Avril', { from: player2, value: 1000 });
          await turnBasedGame.claimTimeout(gameId, { from: player2 });
        });

        describe('WHEN claiming timeout ended right after', function() {
          it('THEN it should revert', function() {
            return assertRevert(
              turnBasedGame.claimTimeoutEnded(gameId, { from: player2 }),
              'timeout has not been reached'
            );
          });
        });

        describe('BUT WHEN claiming timeout ended after the time has past', function() {
          let tx;
          before(async function() {
            await turnBasedGame.moveTimeoutCounter(gameId, 5);
            tx = await turnBasedGame.claimTimeoutEnded(gameId, { from: player2 });
          });
          it('THEN an GameEnded event is emmited', function() {
            return assertEvent.GameEnded(tx, { gameId });
          });
          it('AND the game timeoutState have changed', async function() {
            return assertGame(turnBasedGame, gameId, {
              ended: true,
              player2Winnings: 2000,
              winner: player2,
              pot: 0
            });
          });
          it('AND reverts when claiming timeout again', function() {
            return assertRevert(
              turnBasedGame.claimTimeout(gameId, { from: player2 }),
              'The game already ended'
            );
          });
        });
      });

      describe('GIVEN that the player 1 have claimed its win', function() {
        let gameId;
        before(async function() {
          gameId = assertEvent.NewGameStarted(
            await turnBasedGame.initGame('Alice', 5, true, { from: player1 })
          );
          await turnBasedGame.joinGame(gameId, 'Avril', { from: player2 });
          await turnBasedGame.claimWin(gameId, { from: player1 });
        });
        describe('WHEN claiming timeout ended even as player 2', function() {
          let tx;
          before(async function() {
            await turnBasedGame.moveTimeoutCounter(gameId, 5);
            tx = await turnBasedGame.claimTimeoutEnded(gameId, { from: player2 });
          });
          it('THEN an GameEnded event is emmited', function() {
            return assertEvent.GameEnded(tx, { gameId });
          });
          it('AND the game have changed as expected', async function() {
            return assertGame(turnBasedGame, gameId, {
              ended: true,
              winner: player1,
              player1Winnings: 0,
              player1,
              player2,
              pot: 0
            });
          });
        });
      });

      describe('GIVEN that the player 1 have offered draw', function() {
        let gameId;
        before(async function() {
          gameId = assertEvent.NewGameStarted(
            await turnBasedGame.initGame('Alice', 5, true, { from: player1, value: 5000 })
          );
          await turnBasedGame.joinGame(gameId, 'Avril', { from: player2, value: 5000 });
          await turnBasedGame.offerDraw(gameId, { from: player1 });
        });
        describe('WHEN claiming timeout ended even as player 2', function() {
          let tx;
          before(async function() {
            await turnBasedGame.moveTimeoutCounter(gameId, 5);
            tx = await turnBasedGame.claimTimeoutEnded(gameId, { from: player2 });
          });
          it('THEN an GameEnded event is emmited', function() {
            return assertEvent.GameEnded(tx, { gameId });
          });
          it('AND the pot is divided equaly', async function() {
            return assertGame(turnBasedGame, gameId, {
              ended: true,
              winner: ZERO_ADDRESS,
              player1Winnings: 5000,
              player2Winnings: 5000,
              pot: 0
            });
          });
        });
      });
    });
  });
});
