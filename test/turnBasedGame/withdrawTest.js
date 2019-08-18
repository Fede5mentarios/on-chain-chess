/** global describe, it, beforeEach */
const { balance } = require('openzeppelin-test-helpers');
const { getContracts } = require('../helpers/testHelper');
const { expect, assertRevert, assertEvent } = require('../helpers/assertHelper');

contract('Turn Based Game:', function(accounts) {
  const player1 = accounts[1];
  const player2 = accounts[2];
  describe('FEATURE: withdraw()', function() {
    let turnBasedGame;
    before(async function() {
      [, turnBasedGame] = await getContracts();
    });

    describe('RULE: Withdraw pot as player 1 been the winner', function() {
      describe('GIVEN an existing game that costed 1000000 eth to the player 1', function() {
        let gameId;
        let contractBalanceTracker;
        let player1BalanceTracker;
        let player2BalanceTracker;
        before(async function() {
          player1BalanceTracker = await balance.tracker(player1);
          contractBalanceTracker = await balance.tracker(turnBasedGame.address);
          gameId = assertEvent.NewGameStarted(
            await turnBasedGame.initGame('Alice', 10, true, { from: player1, value: 1000000 })
          );
          await expect(contractBalanceTracker.delta()).to.eventually.eq.BN(1000000);
          return expect(player1BalanceTracker.delta()).to.eventually.be.lt.BN(-1000000);
        });
        describe('WHEN trying to withdraw the pot as the game is still open', function() {
          it('THEN it should revert', function() {
            return assertRevert(
              turnBasedGame.withdraw(gameId, { from: player1 }),
              'sender is not the winner'
            );
          });
        });
        describe('AND WHEN trying to withdraw the pot as a player not part of the game', function() {
          it('THEN it should revert', function() {
            return assertRevert(
              turnBasedGame.withdraw(gameId, { from: player2 }),
              'sender is not a player'
            );
          });
        });
        describe('GIVEN the game has started', function() {
          before(async function() {
            player2BalanceTracker = await balance.tracker(player2);
            await turnBasedGame.joinGame(gameId, 'Avril', { from: player2, value: 1000000 });
            await expect(contractBalanceTracker.delta()).to.eventually.eq.BN(1000000);
            return expect(player2BalanceTracker.delta()).to.eventually.be.lt.BN(-1000000);
          });

          describe('WHEN trying to withdraw the pot as the game has not ended', function() {
            it('THEN it should revert', function() {
              return assertRevert(
                turnBasedGame.withdraw(gameId, { from: player2 }),
                'sender is not the winner'
              );
            });
          });

          describe('BUT GIVEN that the game has ended with player 1 as the winner', function() {
            before(function() {
              return turnBasedGame.surrender(gameId, { from: player2 });
            });
            describe('WHEN trying to withdraw the pot as the player 1', function() {
              before(async function() {
                await contractBalanceTracker.get();
                await player1BalanceTracker.get();
                await turnBasedGame.withdraw(gameId, { from: player1 });
              });
              it('THEN the player 1 balance has incresed', async function() {
                return expect(player1BalanceTracker.delta()).to.eventually.be.lt.BN(2000000);
              });
              it('AND the contract balance has decresed', async function() {
                return expect(contractBalanceTracker.delta()).to.eventually.eq.BN(-2000000);
              });
            });
          });
        });
      });
    });

    describe('RULE: Withdraw pot as player 2 been the winner', function() {
      describe('GIVEN an exisitng game that has ended with player 2 as the winner', function() {
        let gameId;
        let contractBalanceTracker;
        let player2BalanceTracker;
        before(async function() {
          gameId = assertEvent.NewGameStarted(
            await turnBasedGame.initGame('Alice', 10, true, { from: player1, value: 2000000 })
          );
          await turnBasedGame.joinGame(gameId, 'Avril', { from: player2, value: 2000000 });
          await turnBasedGame.surrender(gameId, { from: player1 });
          player2BalanceTracker = await balance.tracker(player2);
          contractBalanceTracker = await balance.tracker(turnBasedGame.address);
        });
        describe('WHEN trying to withdraw the pot as the player 1', function() {
          it('THEN it should revert', function() {
            return assertRevert(
              turnBasedGame.withdraw(gameId, { from: player1 }),
              'sender is not the winner'
            );
          });
        });
        describe('BUT WHEN trying to withdraw the pot as the player 2', function() {
          before(async function() {
            await turnBasedGame.withdraw(gameId, { from: player2 });
          });
          it('THEN the player 2 balance has incresed', async function() {
            return expect(player2BalanceTracker.delta()).to.eventually.be.lt.BN(4000000);
          });
          it('AND the contract balance has decresed', async function() {
            return expect(contractBalanceTracker.delta()).to.eventually.eq.BN(-4000000);
          });
        });
      });
    });

    // TODO a case when both players have part of the pot to withdraw
  });
});
