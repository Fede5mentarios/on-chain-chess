/** global describe, it, beforeEach */
const { getContracts } = require('../helpers/testHelper');
const { expect, assertRevert, assertEvent, assertNewGame } = require('../helpers/assertHelper');

contract('Turn Based Game:', function(accounts) {
  const player1 = accounts[1];
  const player2 = accounts[2];
  const player3 = accounts[3];
  describe('FEATURE: joinGame()', function() {
    let turnBasedGame;
    before(async function() {
      [, turnBasedGame] = await getContracts();
    });

    describe('RULE: should be possible to join a game without pot', function() {
      describe('GIVEN an existing game without pot', function() {
        let gameId;
        before(async function() {
          gameId = assertEvent.NewGameStarted(
            await turnBasedGame.initGame('Alice', 10, false, { from: player1 })
          );
        });

        describe('WHEN calling joinGame', function() {
          before(async function() {
            await turnBasedGame.joinGame(gameId, 'Avril', { from: player2 });
          });
          it('THEN the game appears first in the games of player 2 array', function() {
            return expect(turnBasedGame.getGamesOfPlayer(player2)).to.eventually.include(gameId);
          });
          it('AND should be no longer possible to join the same game', function() {
            return assertRevert(
              turnBasedGame.joinGame(gameId, 'Chester', { from: player3 }),
              'player 2 already in game'
            );
          });
          it('AND the next player is the joined one', function() {
            return assertNewGame(turnBasedGame, gameId, {
              player2,
              nextPlayer: player2
            });
          });
        });
      });
    });

    describe('RULE: should be possible to initialize a game with pot', function() {
      describe('GIVEN an existing game', function() {
        let gameId;
        before(async function() {
          gameId = assertEvent.NewGameStarted(
            await turnBasedGame.initGame('Alice2', 10, true, { from: player1, value: 100000 })
          );
        });
        describe('WHEN calling joinGame with a value transfer to the second one', function() {
          before(function() {
            return turnBasedGame.joinGame(gameId, 'Avril', { from: player2, value: 100000 });
          });
          it('THEN the game appears in the games mapping whit a expected pot of 2 times the value transferred', function() {
            return assertNewGame(turnBasedGame, gameId, {
              player1,
              player2,
              pot: 100000 * 2,
              nextPlayer: player1
            });
          });
        });
      });
    });

    describe('RULE: player 2 should match the bet', function() {
      describe('CASE: there is not bet, the pot is 0', function() {
        describe('GIVEN an existing game', function() {
          let gameId;
          before(async function() {
            gameId = assertEvent.NewGameStarted(
              await turnBasedGame.initGame('Alice', 10, true, { from: player1 })
            );
          });
          it('WHEN calling joinGame with a value transfer, THEN it should revert', function() {
            return assertRevert(
              turnBasedGame.joinGame(gameId, 'Chester', { from: player3, value: 10000 }),
              'player 2 did not match the bet'
            );
          });
        });
      });

      describe('CASE: there is a pot to fill', function() {
        describe('GIVEN an existing game', function() {
          let gameId;
          before(async function() {
            gameId = assertEvent.NewGameStarted(
              await turnBasedGame.initGame('Alice', 10, true, { from: player1, value: 25000 })
            );
          });
          it('WHEN calling joinGame without a value transfer, THEN it should revert', async function() {
            return assertRevert(
              turnBasedGame.joinGame(gameId, 'Chester', { from: player3 }),
              'player 2 did not match the bet'
            );
          });
          it('AND calling joinGame with a different value transfer than expected, THEN it should revert', async function() {
            await assertRevert(
              turnBasedGame.joinGame(gameId, 'Chester', { from: player3, value: 25001 }),
              'player 2 did not match the bet'
            );
            await assertRevert(
              turnBasedGame.joinGame(gameId, 'Chester', { from: player3, value: 24999 }),
              'player 2 did not match the bet'
            );
          });
        });
      });
    });

    // TODO To test into Chess game, not TurnBasedGame contract
    // it('should join player2 as black if player1 is white', function(done) {
    //   assert.doesNotThrow(function() {
    //     Chess.joinGame(testGames[0], 'Bob', {
    //       from: player2,
    //       gas: 500000,
    //       value: adjustPot(1000000)
    //     });
    //   }, Error);

    //   // Watch for event from contract to check if it worked
    //   const filter = Chess.GameJoined({ gameId: testGames[0] });
    //   filter.watch(function(error, result) {
    //     assert.equal(testGames[0], result.args.gameId);
    //     assert.equal(player2, result.args.player2);
    //     assert.equal(player1, result.args.player1);
    //     assert.equal('Bob', result.args.player2Alias);
    //     assert.equal('Alice', result.args.player1Alias);
    //     assert.equal(player1, result.args.playerWhite);
    //     filter.stopWatching(); // Need to remove filter again
    //     done();
    //   });
    // });
    // it('should join player2 as white if player1 is black', function(done) {
    //   assert.doesNotThrow(function() {
    //     Chess.joinGame(testGames[1], 'Bob', { from: player2, gas: 500000 });
    //   }, Error);

    //   // Watch for event from contract to check if it worked
    //   const filter = Chess.GameJoined({ gameId: testGames[1] });
    //   filter.watch(function(error, result) {
    //     assert.equal(testGames[1], result.args.gameId);
    //     assert.equal(player2, result.args.playerWhite);
    //     filter.stopWatching(); // Need to remove filter again
    //     done();
    //   });
    // });
  });
});
