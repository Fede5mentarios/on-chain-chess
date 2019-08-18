/* eslint-disable no-unused-expressions */
/** global describe, it, beforeEach */
const { getContracts } = require('../helpers/testHelper');
const { expect, assertEvent } = require('../helpers/assertHelper');

contract('Turn Based Game:', function(accounts) {
  const player1 = accounts[1];
  const player2 = accounts[2];
  describe('FEATURE: getGameOfPlayer() && getOpenGameIds()', function() {
    let turnBasedGame;
    before(async function() {
      [, turnBasedGame] = await getContracts();
    });

    describe('RULE: If called with a unknown player, should return an empty array', function() {
      describe('WHEN calling getGameOfPlayer with an unknown address', function() {
        let result;
        before(async function() {
          result = await turnBasedGame.getGamesOfPlayer(player1);
        });
        it('THEN the resulting array is empty', function() {
          expect(result).to.be.empty;
        });
      });
    });

    describe('RULE: it should return a gameId for every game ever created by the given address', function() {
      describe('GIVEN 5 exising games, 2 from player 2 and 3 for player 1', function() {
        let createdGamesIdsPalyer1;
        let createdGamesIdsPalyer2;
        before(async function() {
          const crateGames = async (names, playerAddress) =>
            (await Promise.all(
              names.map(name => turnBasedGame.initGame(name, 10, true, { from: playerAddress }))
            )).map(assertEvent.NewGameStarted);
          createdGamesIdsPalyer1 = await crateGames(['Jhon1', 'Jhon2', 'Jhon3'], player1);
          createdGamesIdsPalyer2 = await crateGames(['Jhon4', 'Jhon5'], player2);
        });
        describe('WHEN calling getGameOfPlayer form player1', function() {
          let result;
          before(async function() {
            result = await turnBasedGame.getGamesOfPlayer(player1);
          });
          it('THEN the resulting array has the expected games Ids', function() {
            expect(result).to.include.members(createdGamesIdsPalyer1);
          });
          it('AND not some other player games Ids', function() {
            expect(result).to.not.include.members(createdGamesIdsPalyer2);
          });
          it('BUT getOpenGameIds() has all this ids', async function() {
            const openGames = await turnBasedGame.getOpenGameIds();
            expect(openGames).to.include.members(createdGamesIdsPalyer1);
            expect(openGames).to.include.members(createdGamesIdsPalyer2);
          });
        });
      });
    });
  });
});
