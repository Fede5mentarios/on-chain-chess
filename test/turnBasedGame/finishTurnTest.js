/* eslint-disable mocha/no-setup-in-describe */
/** global describe, it, beforeEach */
const {
  constants: { ZERO_ADDRESS }
} = require('openzeppelin-test-helpers');
const { getContracts } = require('../helpers/testHelper');
const { assertRevert, assertEvent, assertGame } = require('../helpers/assertHelper');

contract('Turn Based Game:', function(accounts) {
  const player1 = accounts[1];
  const player2 = accounts[2];
  const player3 = accounts[3];
  describe('FEATURE: finishTurn()', function() {
    let turnBasedGame;
    before(async function() {
      [, turnBasedGame] = await getContracts();
    });

    describe('GIVEN a started game', function() {
      let gameId;
      before(async function() {
        gameId = assertEvent.NewGameStarted(
          await turnBasedGame.initGame('Alice', 10, true, { from: player1, value: 10000 })
        );
        await turnBasedGame.joinGame(gameId, 'Avril', { from: player2, value: 10000 });
      });
      describe('RULE: the player who wants to finish its turn should be part of the game', function() {
        it('WHEN calling surrender with an address not related to the game, THEN it should revert', function() {
          return assertRevert(
            turnBasedGame.finishTurn(gameId, { from: player3 }),
            'sender is not a player'
          );
        });
      });

      describe('RULE: the game should no have ended', function() {
        describe('GIVEN the game has started and ended', function() {
          before(function() {
            return turnBasedGame.surrender(gameId, { from: player2 });
          });
          describe('WHEN player 1 try to finish its turn', function() {
            it('THEN it should revert', function() {
              return assertRevert(
                turnBasedGame.finishTurn(gameId, { from: player1 }),
                'The game already ended'
              );
            });
          });
        });
      });
    });

    describe('GIVEN a started game whit player 1 as first to play', function() {
      let gameId;
      before(async function() {
        gameId = assertEvent.NewGameStarted(
          await turnBasedGame.initGame('Alice', 10, true, { from: player1, value: 10000 })
        );
        await turnBasedGame.joinGame(gameId, 'Avril', { from: player2, value: 10000 });
      });

      describe('RULE: a natural flow for a game requires multiple turn finished', function() {
        describe('WHEN player 2 try to finish its turn', function() {
          it('THEN it should revert', function() {
            return assertRevert(
              turnBasedGame.finishTurn(gameId, { from: player2 }),
              'It is not the players turn'
            );
          });
        });
        describe('BUT WHEN player 1 try to finish its turn', function() {
          before(function() {
            return turnBasedGame.finishTurn(gameId, { from: player1 });
          });
          it('THEN the nextPlayer should be the player 2', function() {
            return assertGame(turnBasedGame, gameId, { nextPlayer: player2 });
          });
        });
        describe('AND WHEN player 2 now finish its turn', function() {
          before(function() {
            return turnBasedGame.finishTurn(gameId, { from: player2 });
          });
          it('THEN the nextPlayer should be the player 1 again', function() {
            return assertGame(turnBasedGame, gameId, { nextPlayer: player1 });
          });
        });
      });

      describe('RULE: finishing its turn should clear any timeout clock', function() {
        describe('GIVEN it is player 1 turn and the player 2 claims timeout', function() {
          before(async function() {
            await turnBasedGame.claimTimeout(gameId, { from: player2 });
            return assertGame(turnBasedGame, gameId, {
              winner: player2,
              timeoutState: 2,
              timeoutStarted: true
            });
          });

          describe('WHEN player 1 finally finish its turn', function() {
            before(function() {
              return turnBasedGame.finishTurn(gameId, { from: player1 });
            });
            it('THEN the nextPlayer should be the player 2', function() {
              return assertGame(turnBasedGame, gameId, { nextPlayer: player2 });
            });
            it('AND the game timeout should be reset', function() {
              return assertGame(turnBasedGame, gameId, {
                winner: ZERO_ADDRESS,
                timeoutState: 0,
                timeoutStarted: false
              });
            });
          });
        });
      });
    });
  });
});
