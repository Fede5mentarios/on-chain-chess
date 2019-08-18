/* eslint-disable mocha/no-setup-in-describe */
/** global describe, it, beforeEach */
const { getContracts } = require('../helpers/testHelper');
const { assertGame, assertRevert, assertEvent } = require('../helpers/assertHelper');

contract('Turn Based Game:', function(accounts) {
  const player1 = accounts[1];
  const player2 = accounts[2];
  const player3 = accounts[3];
  describe('FEATURE: offerDraw()', function() {
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

      describe('RULE: the player who wants to offer a draw should be part of the game', function() {
        describe('WHEN calling offerDraw with an address not related to the game', function() {
          it('THEN it should revert', function() {
            return assertRevert(
              turnBasedGame.offerDraw(gameId, { from: player3 }),
              'sender is not a player'
            );
          });
        });
      });

      describe('RULE: the game should be in plain execution or over the nextPlayer time limit', function() {
        describe('GIVEN that the player 1 clain its win', function() {
          before(async function() {
            return turnBasedGame.claimWin(gameId, { from: player1 });
          });
          describe('WHEN calling offerDraw as any player', function() {
            it('THEN it should revert', function() {
              return assertRevert(
                turnBasedGame.offerDraw(gameId, { from: player2 }),
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
          describe('WHEN calling offerDraw as any player', function() {
            it('THEN it should revert', function() {
              return assertRevert(
                turnBasedGame.offerDraw(gameId, { from: player1 }),
                'The game already ended'
              );
            });
          });
        });
      });
    });
    describe('RULE: any player can offer a draw', function() {
      const tesDrawOffer = playerNumber =>
        describe('GIVEN a started game', function() {
          let gameId;
          before(async function() {
            gameId = assertEvent.NewGameStarted(
              await turnBasedGame.initGame('Alice', 10, true, { from: player1 })
            );
            await turnBasedGame.joinGame(gameId, 'Avril', { from: player2 });
          });

          describe(`WHEN player ${playerNumber} call offerDraw`, function() {
            let tx;
            before(async function() {
              tx = await turnBasedGame.offerDraw(gameId, { from: accounts[playerNumber] });
            });
            it('THEN the GameTimeoutStarted event is emmited', function() {
              return assertEvent.GameTimeoutStarted(tx, { gameId, timeoutState: -playerNumber });
            });
            it('AND the game timeoutState has changed', function() {
              return assertGame(turnBasedGame, gameId, { timeoutState: -playerNumber });
            });
            it('AND reverts when trying to offer draw again', function() {
              return assertRevert(
                turnBasedGame.offerDraw(gameId, { from: accounts[playerNumber] }),
                'Timeout already running'
              );
            });
          });
        });
      tesDrawOffer(1);
      tesDrawOffer(2);
    });
  });
});
