/* eslint-disable mocha/no-setup-in-describe */
/** global describe, it, beforeEach */
const { getContracts } = require('../helpers/testHelper');
const { assertGame, assertRevert, assertEvent } = require('../helpers/assertHelper');

contract('Turn Based Game:', function(accounts) {
  const player1 = accounts[1];
  const player2 = accounts[2];
  const player3 = accounts[3];
  describe('FEATURE: claimTimeout()', function() {
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

      describe('RULE: the player who wants to claim timeout should be part of the game', function() {
        describe('WHEN calling claimTimeout with an address not related to the game', function() {
          it('THEN it should revert', function() {
            return assertRevert(
              turnBasedGame.claimTimeout(gameId, { from: player3 }),
              'sender is not a player'
            );
          });
        });
      });

      describe('RULE: a player can not claim timeout in its own turn', function() {
        describe('WHEN player 1 calling claimTimeout in its own turn', function() {
          it('THEN it should revert', function() {
            return assertRevert(
              turnBasedGame.claimTimeout(gameId, { from: player1 }),
              'You can only claim that the opponent abandoned in its turn'
            );
          });
        });
      });

      describe('RULE: the game should not be in timeout already', function() {
        describe('GIVEN that the player 1 clain its win', function() {
          before(async function() {
            return turnBasedGame.claimWin(gameId, { from: player1 });
          });
          describe('WHEN calling claimTimeout as any player', function() {
            it('THEN it should revert', function() {
              return assertRevert(
                turnBasedGame.claimTimeout(gameId, { from: player2 }),
                'Timeout already running'
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
          describe('WHEN calling claimTimeout as any player', function() {
            it('THEN it should revert', function() {
              return assertRevert(
                turnBasedGame.claimTimeout(gameId, { from: player1 }),
                'The game already ended'
              );
            });
          });
        });
      });
    });

    describe('RULE: Any player should be capable of claiming timeout', function() {
      describe('GIVEN a started game', function() {
        let gameId;
        before(async function() {
          gameId = assertEvent.NewGameStarted(
            await turnBasedGame.initGame('Alice', 10, false, { from: player1 })
          );
          await turnBasedGame.joinGame(gameId, 'Avril', { from: player2 });
        });

        describe('WHEN claiming timeout as any player', function() {
          let tx;
          before(async function() {
            tx = await turnBasedGame.claimTimeout(gameId, { from: player1 });
          });
          it('THEN an GameTimeoutStarted event is emmited', function() {
            return assertEvent.GameTimeoutStarted(tx, { gameId, timeoutState: 2 });
          });
          it('AND the game timeoutState have changed', async function() {
            return assertGame(turnBasedGame, gameId, {
              timeoutState: 2,
              player1,
              player2
            });
          });
          it('AND reverts when claiming timeout again', function() {
            return assertRevert(
              turnBasedGame.claimTimeout(gameId, { from: player2 }),
              'Timeout already running'
            );
          });
        });
      });
    });
  });
});
