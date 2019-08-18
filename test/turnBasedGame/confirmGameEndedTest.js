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
  describe('FEATURE: confirmGameEnded()', function() {
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
        describe('WHEN calling confirmGameEnded with an address not related to the game', function() {
          it('THEN it should revert', function() {
            return assertRevert(
              turnBasedGame.confirmGameEnded(gameId, { from: player3 }),
              'sender is not a player'
            );
          });
        });
      });

      describe('RULE: someone should have started the timeout clock previously', function() {
        describe('WHEN calling confirmGameEnded whith the game in normal excecution', function() {
          it('THEN it should revert', function() {
            return assertRevert(
              turnBasedGame.confirmGameEnded(gameId, { from: player1 }),
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

          describe('WHEN calling confirmGameEnded as any player', function() {
            it('THEN it should revert', function() {
              return assertRevert(
                turnBasedGame.confirmGameEnded(gameId, { from: player1 }),
                'The game already ended'
              );
            });
          });
        });
      });
    });

    describe('RULE: Confirm game ended over player 1 timeout', function() {
      describe('GIVEN that the player 2 have claimed timeout', function() {
        let gameId;
        before(async function() {
          gameId = assertEvent.NewGameStarted(
            await turnBasedGame.initGame('Alice', 5, true, { from: player1, value: 1000 })
          );
          await turnBasedGame.joinGame(gameId, 'Avril', { from: player2, value: 1000 });
          await turnBasedGame.claimTimeout(gameId, { from: player2 });
        });

        describe('WHEN confirming that the game ended as player2', function() {
          it('THEN it should revert', function() {
            return assertRevert(
              turnBasedGame.confirmGameEnded(gameId, { from: player2 }),
              'A player can not confirm its own victory'
            );
          });
        });

        describe('BUT WHEN player 1 confirms the game ended', function() {
          let tx;
          before(async function() {
            tx = await turnBasedGame.confirmGameEnded(gameId, { from: player1 });
          });
          it('THEN an GameEnded event is emmited', function() {
            return assertEvent.GameEnded(tx, { gameId });
          });
          it('AND the game has changed', async function() {
            return assertGame(turnBasedGame, gameId, {
              ended: true,
              player2Winnings: 2000,
              winner: player2,
              pot: 0,
              timeoutState: 2
            });
          });
        });
      });
    });

    describe('RULE: Confirm game ended over its win', function() {
      describe('GIVEN that the player 1 have claimed its win', function() {
        let gameId;
        before(async function() {
          gameId = assertEvent.NewGameStarted(
            await turnBasedGame.initGame('Alice', 5, true, { from: player1, value: 1000 })
          );
          await turnBasedGame.joinGame(gameId, 'Avril', { from: player2, value: 1000 });
          await turnBasedGame.claimWin(gameId, { from: player1 });
        });

        describe('WHEN confirming that the game ended as player 1', function() {
          it('THEN it should revert', function() {
            return assertRevert(
              turnBasedGame.confirmGameEnded(gameId, { from: player1 }),
              'A player can not confirm its own victory'
            );
          });
        });

        describe('BUT WHEN the player 2 confirms that the game ended', function() {
          let tx;
          before(async function() {
            tx = await turnBasedGame.confirmGameEnded(gameId, { from: player2 });
          });
          it('THEN an GameEnded event is emmited', function() {
            return assertEvent.GameEnded(tx, { gameId });
          });
          it('AND the game has changed', function() {
            return assertGame(turnBasedGame, gameId, {
              ended: true,
              player1Winnings: 2000,
              winner: player1,
              pot: 0,
              timeoutState: 1
            });
          });
        });
      });
    });

    describe('RULE: Confirm game ended over a draw', function() {
      describe('GIVEN that the player 1 have offer draw', function() {
        let gameId;
        before(async function() {
          gameId = assertEvent.NewGameStarted(
            await turnBasedGame.initGame('Alice', 5, true, { from: player1, value: 1000 })
          );
          await turnBasedGame.joinGame(gameId, 'Avril', { from: player2, value: 1000 });
          await turnBasedGame.offerDraw(gameId, { from: player1 });
        });

        describe('WHEN confirming that the game ended as player 1', function() {
          it('THEN it should revert', function() {
            return assertRevert(
              turnBasedGame.confirmGameEnded(gameId, { from: player1 }),
              'A player can not confirm its own draw offer'
            );
          });
        });

        describe('BUT WHEN the player 2 confirms that the game ended', function() {
          let tx;
          before(async function() {
            tx = await turnBasedGame.confirmGameEnded(gameId, { from: player2 });
          });
          it('THEN an GameEnded event is emmited', function() {
            return assertEvent.GameEnded(tx, { gameId });
          });
          it('AND the game has changed', function() {
            return assertGame(turnBasedGame, gameId, {
              ended: true,
              player1Winnings: 1000,
              player2Winnings: 1000,
              pot: 0,
              timeoutState: -1
            });
          });
        });
      });

      describe('GIVEN that the player 2 have offered draw', function() {
        let gameId;
        before(async function() {
          gameId = assertEvent.NewGameStarted(
            await turnBasedGame.initGame('Alice', 5, true, { from: player1, value: 5000 })
          );
          await turnBasedGame.joinGame(gameId, 'Avril', { from: player2, value: 5000 });
          await turnBasedGame.offerDraw(gameId, { from: player2 });
        });

        describe('WHEN confirming that the game ended as player 2', function() {
          it('THEN it should revert', function() {
            return assertRevert(
              turnBasedGame.confirmGameEnded(gameId, { from: player2 }),
              'A player can not confirm its own draw offer'
            );
          });
        });

        describe('BUT WHEN the player 1 confirms that the game ended', function() {
          let tx;
          before(async function() {
            tx = await turnBasedGame.confirmGameEnded(gameId, { from: player1 });
          });
          it('THEN an GameEnded event is emmited', function() {
            return assertEvent.GameEnded(tx, { gameId });
          });
          it('AND the game has changed', function() {
            return assertGame(turnBasedGame, gameId, {
              ended: true,
              player1Winnings: 1000,
              player2Winnings: 1000,
              pot: 0,
              timeoutState: -2
            });
          });
        });
      });
    });
  });
});
