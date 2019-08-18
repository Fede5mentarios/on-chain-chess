/* eslint-disable mocha/no-setup-in-describe */
/** global describe, it, beforeEach */
const { getContracts } = require('../helpers/testHelper');
const { assertGame, assertRevert, assertEvent } = require('../helpers/assertHelper');

contract('Turn Based Game:', function(accounts) {
  const player1 = accounts[1];
  const player2 = accounts[2];
  const player3 = accounts[3];
  describe('FEATURE: rejectCurrentPlayerDraw()', function() {
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

      describe('RULE: the player who wants to reject the draw offer should be part of the game', function() {
        describe('WHEN calling rejectCurrentPlayerDraw with an address not related to the game', function() {
          it('THEN it should revert', function() {
            return assertRevert(
              turnBasedGame.rejectCurrentPlayerDraw(gameId, { from: player3 }),
              'sender is not a player'
            );
          });
        });
      });

      describe('RULE: the game should be timeout', function() {
        describe('GIVEN that the game its in plain execution', function() {
          describe('WHEN calling rejectCurrentPlayerDraw as any player', function() {
            it('THEN it should revert', function() {
              return assertRevert(
                turnBasedGame.rejectCurrentPlayerDraw(gameId, { from: player2 }),
                'There is no timeout running for a draw'
              );
            });
          });
        });

        describe('OR GIVEN that the player 1 clain its win', function() {
          before(async function() {
            return turnBasedGame.claimWin(gameId, { from: player1 });
          });
          describe('WHEN calling rejectCurrentPlayerDraw as any player', function() {
            it('THEN it should revert', function() {
              return assertRevert(
                turnBasedGame.rejectCurrentPlayerDraw(gameId, { from: player2 }),
                'There is no timeout running for a draw'
              );
            });
          });
        });
      });

      describe('RULE: the game should not have ended already', function() {
        describe('GIVEN that the player 2 ended the game', function() {
          before(async function() {
            return turnBasedGame.surrender(gameId, { from: player2 });
          });
          describe('WHEN calling rejectCurrentPlayerDraw as any player', function() {
            it('THEN it should revert', function() {
              return assertRevert(
                turnBasedGame.rejectCurrentPlayerDraw(gameId, { from: player1 }),
                'The game already ended'
              );
            });
          });
        });
      });
    });

    describe('RULE: the current player can reject the draw offer', function() {
      describe('GIVEN a started game where the player 1 has offered a draw', function() {
        let gameId;
        before(async function() {
          gameId = assertEvent.NewGameStarted(
            await turnBasedGame.initGame('Alice', 10, false, { from: player1 })
          );
          await turnBasedGame.joinGame(gameId, 'Avril', { from: player2 });
          await turnBasedGame.offerDraw(gameId, { from: player1 });
        });

        describe('WHEN any player decide to reject the draw', function() {
          let tx;
          before(async function() {
            tx = await turnBasedGame.rejectCurrentPlayerDraw(gameId, { from: player2 });
          });
          it('THEN the GameDrawOfferRejected event is emmited', function() {
            return assertEvent.GameDrawOfferRejected(tx, { gameId });
          });
          it('AND the game timeoutState has changed', function() {
            return assertGame(turnBasedGame, gameId, { timeoutState: 0 });
          });
        });
      });
    });
  });
});
